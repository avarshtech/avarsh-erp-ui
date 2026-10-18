/**
 * The upstream chain the production-flow specs start from, built through the API: an approved cost
 * sheet, a confirmed order on it, a released BOM, the PP sample completed, a supplier PO for the BOM
 * fabric sent to the supplier, and its GRN passed by QC — so the fabric is in stock, earmarked to the
 * order. Every order the chain creates carries FLOW_MARK in its remarks, which is how the later specs
 * find the chain again (`findFlowOrder`) without sharing state between files.
 *
 * Each step throws with the server's message when a call fails, so a broken fixture reads as one.
 */
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from './order-seed.js';
import { loadBomRefs, buildBomPayload } from './bom-seed.js';
import { loadPoRefs, buildGeneralPo } from './po-seed.js';
import { fabricGrnPayload, fabricQcPayload, refreshPO, submitGrn, submitQc, approveQc } from './grn-qc-data.js';

export const FLOW_MARK = 'E2E production flow';

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

/** YYYY-MM-DD, `n` days from today. */
export const day = (n = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Costing → order → BOM → PO → GRN → QC → stock. `fabricQty` is what the supplier PO buys and the GRN
 * receives, split over two rolls. Returns { order, bom, po, grn, qc, item, rolls }.
 */
export async function buildUpstreamChain(api, { stamp, fabricQty = 200 } = {}) {
  const costing = await seedApprovedCosting(api);
  const orderRefs = await loadOrderRefs(api, costing.buyerId);
  const created = ok(await api.post('/orders', buildOrderPayload(costing, orderRefs, { remarks: `${FLOW_MARK} ${stamp}` })), 'create order');
  ok(await api.put(`/orders/${created.id}/status`, { status: 'CONFIRMED', version: created.version }), 'confirm order');
  const order = ok(await api.get(`/orders/${created.id}`), 'read order');

  const bomRefs = await loadBomRefs(api);
  const bomDraft = ok(await api.post('/boms', buildBomPayload(order, bomRefs)), 'create BOM');
  const bomNow = ok(await api.get(`/boms/${bomDraft.id}`), 'read BOM');
  ok(await api.post(`/boms/${bomDraft.id}/release`, { version: bomNow.version }), 'release BOM');
  const bom = ok(await api.get(`/boms/${bomDraft.id}`), 'read released BOM');

  ok(await api.patch(`/production/pp-status/${order.id}`, { status: 'COMPLETED' }), 'complete PP sample');

  const poRefs = await loadPoRefs(api);
  const draft = buildGeneralPo(poRefs.localSupplier, poRefs.item, poRefs.terms, { qty: fabricQty, unitPrice: 120 });
  draft.orderReferences = [{ orderId: order.id, orderNo: order.orderNo, styleName: order.styleNo }];
  draft.remarks = `${FLOW_MARK} ${stamp}`;
  let po = ok(await api.post('/purchase-orders', draft), 'create supplier PO');
  const poNow = ok(await api.get(`/purchase-orders/${po.id}`), 'read supplier PO');
  po = ok(await api.post(`/purchase-orders/${po.id}/submit`, { version: poNow.version }), 'submit supplier PO');
  // One approval level per call; with no flow the submit itself sends it.
  for (let level = 0; po.status === 'Pending_Approval' && level < 5; level++) {
    po = ok(await api.put(`/purchase-orders/${po.id}/approve`, { comment: 'e2e: production flow' }), 'approve supplier PO');
  }
  if (po.status !== 'Sent_To_Supplier') throw new Error(`supplier PO stopped at ${po.status}`);

  const full = ok(await api.get(`/purchase-orders/${po.id}`), 'read sent PO');
  const enriched = await refreshPO(api, {
    ...full,
    items: full.lineItems.map((li) => ({
      id: li.id, itemId: li.itemId, itemCode: li.itemCode, itemName: li.itemName, description: li.description || li.itemName,
      variantId: li.variantId, categoryName: li.categoryName, orderedQty: Number(li.quantity), rate: Number(li.unitPrice || 0),
      uom: li.uomName || 'Mtr', color: '', size: '', width: null, gsm: null,
    })),
  });
  const line = enriched.items[0];
  const half = Math.round(fabricQty / 2);
  const rolls = [
    { rollNumber: `PF-${stamp}-1`, receivingQty: half, shadeLot: `PF-SL-${stamp}` },
    { rollNumber: `PF-${stamp}-2`, receivingQty: fabricQty - half, shadeLot: `PF-SL-${stamp}` },
  ];
  const grn = await submitGrn(api, fabricGrnPayload(enriched, [line], { [line.id]: rolls }, { remarks: `${FLOW_MARK} ${stamp}` }));
  const qc = await submitQc(api, fabricQcPayload(grn, line.id, { inspector: 'E2E Production Flow' }));
  const approved = await approveQc(api, qc.id, 'e2e: production flow fabric passes');

  return { order, bom, po: full, grn, qc: approved, item: { id: line.itemId, code: line.itemCode, name: line.itemName }, rolls };
}

/** The production line the flow specs sew on: created on the Production Masters screen by 02. */
export const FLOW_LINE_PREFIX = 'E2E Flow Line';

export async function findFlowLine(api) {
  const lines = ok(await api.get('/production-lines'), 'production lines');
  const line = [...lines].reverse().find((l) => String(l.name).startsWith(FLOW_LINE_PREFIX));
  if (!line) throw new Error('no production-flow line yet: run 02-production-masters first');
  return line;
}

/**
 * An active shift and an employee of HR unit 1 (the unit the flow's Cutting PO and Work Order run at):
 * the hourly sheet needs a shift and the measurement report an inspector, and the e2e seed has neither.
 */
export async function ensureFlowStaff(api, { stamp }) {
  const shifts = ok(await api.get('/hr/shifts/active'), 'shifts');
  const shift = shifts[0] || ok(await api.post('/hr/shifts', {
    code: `PF-SFT-${stamp}`, name: `General Shift ${stamp}`, startTime: '08:00', endTime: '17:00',
    breakMinutes: 30, isNightShift: false, isActive: true,
  }), 'create shift');

  const depts = ok(await api.get('/hr/departments/active'), 'departments');
  const dept = depts.find((d) => d.unitId === 1) || ok(await api.post('/hr/departments', {
    code: `PF-DEP-${stamp}`, name: `Sewing ${stamp}`, unitId: 1, isActive: true,
  }), 'create department');
  const desigs = ok(await api.get('/hr/designations/active'), 'designations');
  const desig = desigs.find((d) => d.departmentId === dept.id) || ok(await api.post('/hr/designations', {
    code: `PF-DES-${stamp}`, name: `Quality Inspector ${stamp}`, departmentId: dept.id, category: 'WORKER', isActive: true,
  }), 'create designation');

  const employee = ok(await api.post('/hr/employees', {
    employeeNo: `PF${stamp}`, fullName: `Flow Inspector ${stamp}`, gender: 'FEMALE', dateOfBirth: '1996-04-12', dateOfJoining: day(-30),
    maritalStatus: 'SINGLE', unitId: 1, departmentId: dept.id, designationId: desig.id, shiftId: shift.id,
    category: 'WORKER', employeeType: 'PERMANENT', mobileNumber: `98${stamp}12`.slice(0, 10), status: 'ACTIVE',
    presentAddress: '12 Mill Road, Tiruppur', isMigrantWorker: false,
  }), 'create employee');
  return { shift, employee };
}

/** The newest order the chain created (by FLOW_MARK in its remarks), as the server has it now. */
export async function findFlowOrder(api) {
  const { data } = await api.get('/orders/search', { page: 0, size: 50, sort: 'id', direction: 'desc' });
  const hit = (data?.content || []).find((o) => String(o.remarks || '').startsWith(FLOW_MARK));
  if (!hit) throw new Error('no production-flow order yet: run 01-upstream-chain first');
  return ok(await api.get(`/orders/${hit.id}`), 'read flow order');
}
