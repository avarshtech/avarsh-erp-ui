/**
 * Mock of Material In (plan Phase 2 "Party Inward"): the principal's fabric rolls, trims or cut panels
 * arrive on their challan and become lots they own — never our stock, never valued. A GRN with no PO.
 * Never reaches the API.
 */
import {
  INWARD_STATUS, MATERIAL_KIND, SUPPLIED_BY,
} from '../../../utils/jobWorkInward/inwardConstants';
import { challanShort, materialStatus, validateInward } from '../../../utils/jobWorkInward/materialRules';
import { isInterState } from '../../../utils/jobWorkInward/chargeRules';
import {
  clone, latency, mockError, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { liveLots } from './inwardMockLedger';
import { lotSummary } from './inwardMockOrderView';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const principalOf = (db, jo) => db.principals.find((p) => p.id === jo.principalId);

const shortLinesOf = (lots, tolerancePct) => lots.filter((l) => challanShort({ ...l, tolerancePct }) > 0);

export const searchInwards = (filters = {}) => {
  const db = loadInwardDb();
  const q = (filters.q || '').trim().toLowerCase();
  const rows = db.inwards.map((i) => {
    const jo = db.jobOrders.find((j) => j.id === i.jobOrderId);
    const p = principalOf(db, jo);
    const lots = db.lots.filter((l) => l.inwardId === i.id && !l.origin);
    return {
      ...i, principalName: p.name, orderNo: jo.orderNo, styleNo: jo.styleNo, summary: lotSummary(lots),
      shortLines: shortLinesOf(lots, p.weightTolerancePct).length, defectCount: i.defects.length,
      declaredValue: Math.round(sum(lots.map((l) => l.receivedQty * (l.declaredRate || 0)))),
    };
  }).filter((r) => (!filters.principalId || r.principalId === filters.principalId) && (!filters.jobOrderId || r.jobOrderId === filters.jobOrderId)
    && (!filters.status || r.status === filters.status)
    && (!q || [r.inwardNo, r.theirDcNo, r.orderNo, r.styleNo, r.principalName, r.ewayBillNo].some((v) => String(v || '').toLowerCase().includes(q))))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return latency(rows);
};

/** What the Record drawer needs for a job order: its principal-supplied lines, required and received so far. */
export const getInwardForm = (jobOrderId) => {
  const db = loadInwardDb();
  const jo = db.jobOrders.find((j) => j.id === Number(jobOrderId));
  if (!jo) return Promise.reject(mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 }));
  const p = principalOf(db, jo);
  const status = materialStatus(jo, liveLots(db, (l) => l.jobOrderId === jo.id));
  return latency(clone({
    jobOrder: { id: jo.id, orderNo: jo.orderNo, styleNo: jo.styleNo, styleName: jo.styleName, scope: jo.scope, sizes: jo.sizes, colours: jo.colours },
    principal: { id: p.id, name: p.name, gstin: p.gstin, weightTolerancePct: p.weightTolerancePct, city: p.city },
    interState: isInterState(p, db.branch),
    materials: status.filter((m) => m.suppliedBy === SUPPLIED_BY.PRINCIPAL)
      .map((m) => ({ id: m.id, kind: m.kind, itemName: m.itemName, colour: m.colour, uom: m.uom, required: m.required, received: m.usable, short: m.short })),
  }));
};

/** payload: { jobOrderId, date, theirDcNo, theirDcDate, dispatchedFrom, vehicleNo, ewayBillNo, defects, lines } */
export const postInward = (payload) => mutateInwardDb((db) => {
  const today = todayIso();
  const jo = db.jobOrders.find((j) => j.id === Number(payload.jobOrderId));
  if (!jo || jo.status !== 'OPEN') throw mockError('Material comes in only on an open job order.', { status: 409, code: 'CONFLICT' });
  const p = principalOf(db, jo);
  const lines = (payload.lines || []).map((l) => (l.rolls?.length ? { ...l, receivedQty: Math.round(sum(l.rolls.map((r) => r.qty)) * 10) / 10 } : l))
    .filter((l) => (Number(l.receivedQty) || 0) > 0);
  const postedDcNos = db.inwards.filter((i) => i.principalId === p.id && i.status === INWARD_STATUS.POSTED).map((i) => i.theirDcNo);
  const errors = validateInward({ ...payload, today, lines, interState: isInterState(p, db.branch), postedDcNos });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const inwardNo = nextDocNo(db, 'JWI');
  const n = inwardNo.split('/').pop();
  const doc = {
    id: nextId(db, 'inward'), inwardNo, jobOrderId: jo.id, principalId: p.id, date: payload.date, theirDcNo: payload.theirDcNo.trim(), theirDcDate: payload.theirDcDate,
    dispatchedFrom: payload.dispatchedFrom || p.name, vehicleNo: payload.vehicleNo || '', ewayBillNo: payload.ewayBillNo || '', status: INWARD_STATUS.POSTED,
    cancelReason: null, receivedBy: 'You', defects: (payload.defects || []).filter((d) => d.text?.trim()),
  };
  db.inwards.push(doc);
  const made = lines.map((l, i) => {
    const m = jo.materials.find((x) => x.id === l.materialId);
    const lot = {
      id: nextId(db, 'lot'), lotNo: `JWI${n}-${i + 1}`, inwardId: doc.id, jobOrderId: jo.id, materialId: m.id, kind: m.kind, colour: m.colour, size: l.size || null,
      uom: m.uom, challanQty: Number(l.challanQty) || Number(l.receivedQty), receivedQty: Number(l.receivedQty), defectiveQty: Number(l.defectiveQty) || 0,
      declaredRate: Number(l.declaredRate) || 0, location: `Party rack P-0${p.id}`, date: payload.theirDcDate, receivedOn: payload.date, origin: null,
      rolls: m.kind === MATERIAL_KIND.FABRIC && l.rolls?.length ? l.rolls.map((r) => ({ ...r, qty: Number(r.qty) })) : null,
    };
    db.lots.push(lot);
    return lot;
  });
  const short = shortLinesOf(made, p.weightTolerancePct);
  return latency({ id: doc.id, inwardNo, shortLines: short.length });
});

export const cancelInward = (id, { reason = '' } = {}) => mutateInwardDb((db) => {
  const doc = db.inwards.find((i) => i.id === Number(id));
  if (!doc || doc.status !== INWARD_STATUS.POSTED) throw mockError('Only a posted Material In can be cancelled.', { status: 409, code: 'CONFLICT' });
  const lotIds = db.lots.filter((l) => l.inwardId === doc.id).map((l) => l.id);
  if (db.movements.some((m) => lotIds.includes(m.lotId) && !m.cancelled)) throw mockError('Some of this material has already moved (issued, returned or written off); it cannot be cancelled.', { status: 409, code: 'CONFLICT' });
  if (!reason.trim()) throw mockError('Give a reason for cancelling.');
  doc.status = INWARD_STATUS.CANCELLED;
  doc.cancelReason = reason.trim();
  return latency({ id: doc.id, status: doc.status });
});

/** The shortage and defect report the principal gets for one Material In. */
export const getInwardReport = (id) => {
  const db = loadInwardDb();
  const doc = db.inwards.find((i) => i.id === Number(id));
  if (!doc) return Promise.reject(mockError('Material In not found.', { code: 'NOT_FOUND', status: 404 }));
  const jo = db.jobOrders.find((j) => j.id === doc.jobOrderId);
  const p = principalOf(db, jo);
  const lines = db.lots.filter((l) => l.inwardId === doc.id && !l.origin).map((l) => ({
    ...l, itemName: jo.materials.find((m) => m.id === l.materialId)?.itemName,
    short: challanShort({ ...l, tolerancePct: p.weightTolerancePct }),
  }));
  return latency(clone({ doc, jobOrder: { orderNo: jo.orderNo, styleNo: jo.styleNo, styleName: jo.styleName, principalRef: jo.principalRef }, principal: p, branch: db.branch, lines }));
};
