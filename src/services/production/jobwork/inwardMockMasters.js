/**
 * Mock of the two masters inward job work needs (plan Phase 2): principals (the Buyer master's new
 * fields — GSTIN, billing address, state, waste rule) and new job orders (an Order of type Job work,
 * no costing). Never reaches the API.
 */
import { JO_STATUS } from '../../../utils/jobWorkInward/inwardConstants';
import { validateJobOrder, validatePrincipal } from '../../../utils/jobWorkInward/orderRules';
import { getStateName } from '../../../utils/indianStates';
import { isInterState } from '../../../utils/jobWorkInward/chargeRules';
import {
  latency, mockError, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { jobOrderContext } from './inwardMockContext';
import { liveReturns } from './inwardMockLedger';

const byUom = (lots) => lots.reduce((acc, l) => { acc[l.uom] = Math.round(((acc[l.uom] || 0) + l.ledger.inStore) * 10) / 10; return acc; }, {});

export const listPrincipals = () => {
  const db = loadInwardDb();
  const today = todayIso();
  return latency(db.principals.map((p) => {
    const ctxs = db.jobOrders.filter((j) => j.principalId === p.id).map((jo) => jobOrderContext(db, jo, today));
    const lots = ctxs.flatMap((c) => c.lots);
    const lastReturn = liveReturns(db).filter((r) => ctxs.some((c) => c.jo.id === r.jobOrderId)).map((r) => r.date).sort().pop() || null;
    return {
      ...p, registered: !!p.gstin, stateName: getStateName(p.stateCode), interState: isInterState(p, db.branch),
      openOrders: ctxs.filter((c) => c.open).length, heldByUom: Object.entries(byUom(lots)).filter(([, q]) => q > 0).map(([uom, qty]) => ({ uom, qty })),
      ageLevel: Math.max(0, ...lots.map((l) => l.ageLevel)), lastReturn,
      unbilled: ctxs.reduce((a, c) => a + c.charges.filter((x) => !x.tally).length, 0),
    };
  }));
};

export const savePrincipal = (payload) => mutateInwardDb((db) => {
  const errors = validatePrincipal(payload);
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const gstin = (payload.gstin || '').trim().toUpperCase() || null;
  const record = {
    name: payload.name.trim(), gstin, stateCode: gstin ? gstin.slice(0, 2) : payload.stateCode, city: payload.city || '', address: payload.address.trim(),
    pincode: payload.pincode, contactPerson: payload.contactPerson || '', phone: payload.phone || '', email: payload.email || '',
    wasteRule: payload.wasteRule, weightTolerancePct: Number(payload.weightTolerancePct),
  };
  record.state = getStateName(record.stateCode);
  if (payload.id) Object.assign(db.principals.find((p) => p.id === payload.id), record);
  else db.principals.push({ id: nextId(db, 'principal'), ...record });
  return latency({ ok: true });
});

export const createJobOrder = (payload) => mutateInwardDb((db) => {
  const today = todayIso();
  const errors = validateJobOrder(payload, today);
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const id = nextId(db, 'jobOrder');
  let materialId = Math.max(0, ...db.jobOrders.flatMap((j) => j.materials.map((m) => m.id)));
  const jo = {
    id, orderNo: nextDocNo(db, 'SG'), principalId: payload.principalId, principalRef: payload.principalRef.trim(), styleNo: payload.styleNo.trim(),
    styleName: payload.styleName.trim(), scope: payload.scope, sizes: payload.sizes,
    colours: payload.colours.filter((c) => c.colour.trim()).map((c) => ({ colour: c.colour.trim(), qty: c.qty })),
    rate: Number(payload.rate), ratesBySize: payload.ratesBySize || null, sacCode: payload.sacCode, gstRatePct: Number(payload.gstRatePct),
    orderDate: today, dueDate: payload.dueDate, ppSample: payload.ppSample, status: 'OPEN', closedAt: null, closedReason: null,
    materials: payload.materials.map((m) => { materialId += 1; return { ...m, id: materialId, colour: m.colour || null, consumption: Number(m.consumption), allowancePct: Number(m.allowancePct) }; }),
    production: { cuttingPos: [], workOrderNo: null, finishingPoNo: null, unit: null, processDocs: [] },
    events: [],
  };
  db.jobOrders.push(jo);
  return latency({ id, orderNo: jo.orderNo, status: JO_STATUS.AWAITING_MATERIAL });
});
