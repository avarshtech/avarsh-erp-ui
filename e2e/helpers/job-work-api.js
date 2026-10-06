/**
 * Job-work fixtures through the API (no UI): Cut Panel / Garment Process Requirements and POs, and the in-house
 * cutting PO and work order production issues against them. The e2e seed has orders ORD/0002 and ORD/0003 with
 * CREATED BOMs and the PP sample completed, the job workers Annai Panel Printers (Panel Printing, Panel
 * Embroidery) and Kongu Garment Wash (Garment Washing), and HR unit 1. With no approval flow configured, a PO's
 * submit approves it at once.
 *
 * Every builder throws with the server's message when a call fails, so a broken fixture reads as one.
 */

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

export const VENDOR = { printers: 'Annai Panel Printers', wash: 'Kongu Garment Wash' };

/** An order the requirements may be raised on, by number (ORD/0002, ORD/0003): { id, orderNo, styleNo, buyer }. */
export async function orderOf(api, orderNo) {
  const list = ok(await api.get('/garment-process-requirements/eligible-orders'), 'eligible orders');
  const order = list.find((o) => o.orderNo === orderNo);
  if (!order) throw new Error(`orderOf: ${orderNo} is not open to requirements`);
  return order;
}

export const orderId = async (api, orderNo) => (await orderOf(api, orderNo)).id;

const idOf = async (api, path, field, value, what) => {
  const list = ok(await api.get(path), what);
  const row = (Array.isArray(list) ? list : list.content || []).find((r) => r[field] === value);
  if (!row) throw new Error(`${what}: no ${value}`);
  return row.id;
};

export const vendorId = (api, name) => idOf(api, '/vendors/options', 'name', name, 'vendor');
export const processId = (api, name, category) => idOf(api, `/processes/active?category=${encodeURIComponent(category)}`, 'processName', name, 'process');
export const partId = (api, name) => idOf(api, '/parts/active', 'partName', name, 'part');

/** A submitted Cut Panel Requirement: one line of the first fabric, one colour, one panel, one process. */
export async function submittedCpr(api, { orderNo = 'ORD/0002', colour, panel = 'Front Panel', process = 'Panel Printing' } = {}) {
  const id = await orderId(api, orderNo);
  const ctx = ok(await api.get(`/cut-panel-requirements/order-context/${id}`), 'order context');
  const line = {
    key: 'L1', fabricId: ctx.fabrics[0].id, colorName: colour || ctx.colors[0].name, panelId: await partId(api, panel),
    processId: await processId(api, process, 'Cut Panel'), sequenceNo: 1, allowancePct: 0, sizes: {},
  };
  const draft = ok(await api.post('/cut-panel-requirements', { orderId: id, orderQtySnapshot: ctx.totalQty, lastLineNo: 1, lines: [line] }), 'create CPR');
  return ok(await api.post(`/cut-panel-requirements/${draft.id}/submit`, { version: draft.version }), 'submit CPR');
}

/** A submitted Garment Process Requirement: one process line over every colour and size of the order. */
export async function submittedGpr(api, { orderNo = 'ORD/0003', process = 'Garment Washing' } = {}) {
  const id = await orderId(api, orderNo);
  const ctx = ok(await api.get(`/garment-process-requirements/order-context/${id}`), 'order context');
  const line = { key: 'G1', seqNo: 1, processId: await processId(api, process, 'Garment'), colors: ctx.colors.map((c) => c.name), sizes: ctx.sizes };
  const draft = ok(await api.post('/garment-process-requirements', { orderId: id, lastLineNo: 1, lines: [line] }), 'create GPR');
  return ok(await api.post(`/garment-process-requirements/${draft.id}/submit`, { version: draft.version }), 'submit GPR');
}

/**
 * A Cut Panel PO on every size of a CPR line, at its required quantity; submitted (approved, with no flow) unless
 * `draft`. A rate more than 10% above the job worker's last one needs `rateRemark` (VR-12).
 */
export async function cutPanelPo(api, cpr, { vendor = VENDOR.printers, rate = 5, rateRemark = null, draft = false, process = 'Panel Printing' } = {}) {
  const line = cpr.lines[0];
  const lines = Object.entries(line.sizes).filter(([, c]) => c.requiredQty > 0).map(([size, c], i) => ({
    key: `L${i + 1}`, cprId: cpr.id, cprLineKey: line.key, size, poQty: c.requiredQty, uom: 'PIECE', rate, rateRemark,
    prevPoQty: 0, snapshot: { required: c.requiredQty, sequenceNo: line.sequenceNo },
  }));
  const po = ok(await api.post('/cut-panel-pos', {
    poDate: day(0), processName: process, vendorId: await vendorId(api, vendor), requiredDeliveryDate: day(10),
    returnTo: 'CUTTING', returnUnitId: 1, instructions: 'Print to the approved strike-off', otherCharges: 0,
    lastLineNo: lines.length, lines,
  }), 'create Cut Panel PO');
  return draft ? po : ok(await api.post(`/cut-panel-pos/${po.id}/submit`, { version: po.version }), 'submit Cut Panel PO');
}

/** A Garment Process PO on the first `cells` cells of a GPR at their required quantity; submitted unless `draft`. */
export async function garmentProcessPo(api, gpr, { vendor = VENDOR.wash, rate = 4, cells = 2, draft = false } = {}) {
  const all = ok(await api.get(`/garment-process-pos/lookups/requirements/${gpr.id}/cells`), 'GPR cells');
  const lines = all.slice(0, cells).map((c, i) => ({
    key: `L${i + 1}`, gprId: c.gprId, gprLineKey: c.gprLineKey, color: c.color, size: c.size, required: c.required,
    prevPoQty: 0, snapshot: { required: c.required, seqNo: c.seqNo }, poQty: c.required, uom: 'PIECE', rate,
  }));
  const po = ok(await api.post('/garment-process-pos', {
    poDate: day(0), vendorId: await vendorId(api, vendor), requiredDate: day(20), returnTo: 'FINISHING', returnUnitId: 1,
    expectedReturnDate: day(15), instructions: 'Enzyme wash, soft hand feel', otherCharges: 0, lastLineNo: lines.length, lines,
  }), 'create Garment Process PO');
  return draft ? po : ok(await api.post(`/garment-process-pos/${po.id}/submit`, { version: po.version }), 'submit Garment Process PO');
}

/**
 * An approved cutting PO cutting `rows` ({ color, size, qty }): in-house at HR unit 1, or outsourced (`unitType`
 * VENDOR) to the seeded Velan Stitching Unit — an outsourced PO's processing unit is a vendor.
 */
export async function approvedCuttingPo(api, { orderNo, rows, unitType = 'UNIT' }) {
  const order = await orderOf(api, orderNo);
  const cut = ok(await api.post('/cutting-po', {
    orderId: order.id, orderNo: order.orderNo, styleNo: order.styleNo, buyer: order.buyer, processingUnitType: unitType,
    processingUnitId: unitType === 'VENDOR' ? await vendorId(api, 'Velan Stitching Unit') : 1, allowancePercent: 0,
    plannedCutDate: day(1), plannedDeliveryDate: day(5),
    items: rows.map((r) => ({ color: r.color, size: r.size, orderQty: r.qty, plannedQty: r.qty, allowancePercent: 0, ratePerPiece: 10 })),
  }), 'create cutting PO');
  return ok(await api.post(`/cutting-po/${cut.id}/submit`, { version: cut.version }), 'submit cutting PO');
}

/** An approved work order on an approved cutting PO, planning `rows` ({ color, size, qty }): in-house unless `unitType` is VENDOR. */
export async function approvedWorkOrder(api, { orderNo, cuttingPoId, rows, unitType = 'UNIT' }) {
  const order = await orderOf(api, orderNo);
  const wo = ok(await api.post('/work-order', {
    orderId: order.id, orderNo: order.orderNo, styleNo: order.styleNo, buyer: order.buyer, cuttingPoId,
    processingUnitType: unitType, processingUnitId: unitType === 'VENDOR' ? await vendorId(api, 'Velan Stitching Unit') : 1, allowancePercent: 0,
    plannedStartDate: day(1), plannedEndDate: day(10), plannedDeliveryDate: day(12),
    items: rows.map((r) => ({ color: r.color, size: r.size, orderQty: r.qty, plannedQty: r.qty, allowancePercent: 0, ratePerPiece: 20 })),
  }), 'create work order');
  return ok(await api.post(`/work-order/${wo.id}/submit`, { version: wo.version }), 'submit work order');
}

/** The Cut Panel PO as the server has it now. */
export const getCutPanelPo = async (api, id) => ok(await api.get(`/cut-panel-pos/${id}`), 'read Cut Panel PO');
export const getGarmentProcessPo = async (api, id) => ok(await api.get(`/garment-process-pos/${id}`), 'read Garment Process PO');
