/**
 * Mock of Return to Principal (plan Phase 2): good garments up to what is packed, rejected garments at
 * no charge, leftover lots and — when the principal's rule says so — cutting waste go back on our
 * challan. Job charges come from the good pieces only. Challan and e-way numbers are typed by hand until
 * Phase 3. Never reaches the API.
 */
import { RETURN_STATUS, WASTE_RULE } from '../../../utils/jobWorkInward/inwardConstants';
import { MOVEMENT } from '../../../utils/jobWorkInward/partyStockRules';
import { validateReturn } from '../../../utils/jobWorkInward/returnRules';
import { billingOverdue, returnCharges } from '../../../utils/jobWorkInward/chargeRules';
import {
  clone, latency, mockError, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { jobOrderContext } from './inwardMockContext';
import { challanOfLots } from './inwardMockLedger';
import { jobOrderView } from './inwardMockOrderView';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const ctxOf = (db, jobOrderId, today) => jobOrderContext(db, db.jobOrders.find((j) => j.id === Number(jobOrderId)), today);

export const searchReturns = (filters = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const q = (filters.q || '').trim().toLowerCase();
  const rows = db.returns.map((r) => {
    const jo = db.jobOrders.find((j) => j.id === r.jobOrderId);
    const principal = db.principals.find((p) => p.id === jo.principalId);
    const charge = returnCharges({ jo, principal, branch: db.branch, garments: r.garments });
    return {
      ...r, orderNo: jo.orderNo, styleNo: jo.styleNo, principalId: principal.id, principalName: principal.name,
      pieces: sum(r.garments.map((g) => g.qty)), rejectPieces: sum(r.rejects.map((g) => g.qty)), lotCount: r.lotLines.length, charge,
      overdue: r.status === RETURN_STATUS.DISPATCHED && billingOverdue({ returnDate: r.date, today, invoiced: !!r.tally }),
    };
  }).filter((r) => (!filters.principalId || r.principalId === filters.principalId) && (!filters.jobOrderId || r.jobOrderId === filters.jobOrderId)
    && (!filters.tally || (filters.tally === 'RECORDED' ? !!r.tally : !r.tally && r.status === RETURN_STATUS.DISPATCHED))
    && (!q || [r.returnNo, r.ourChallanNo, r.orderNo, r.styleNo, r.principalName, r.tally?.invoiceNo].some((v) => String(v || '').toLowerCase().includes(q))))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return latency(rows);
};

/** What the Return drawer needs: what is ready, rejects held, lots in store with their challans, waste. */
export const getReturnForm = (jobOrderId) => {
  const db = loadInwardDb();
  const jo = db.jobOrders.find((j) => j.id === Number(jobOrderId));
  if (!jo) return Promise.reject(mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 }));
  const ctx = jobOrderContext(db, jo, todayIso());
  const challanOf = challanOfLots(db, ctx.lots);
  return latency(clone({
    jobOrder: { id: jo.id, orderNo: jo.orderNo, styleNo: jo.styleNo, styleName: jo.styleName, sizes: jo.sizes, colours: jo.colours, rate: jo.rate, ratesBySize: jo.ratesBySize, gstRatePct: jo.gstRatePct, sacCode: jo.sacCode },
    principal: ctx.principal, branch: db.branch, interState: ctx.interState, ready: ctx.ready, rejectsAvailable: ctx.rejectsAvailable,
    lots: ctx.inStoreLots.map((l) => ({ id: l.id, lotNo: l.lotNo, itemName: jo.materials.find((m) => m.id === l.materialId)?.itemName, colour: l.colour, size: l.size, uom: l.uom, inStore: l.ledger.inStore, theirDcNo: challanOf[l.id] })),
    wasteOnHand: ctx.waste.onHand,
  }));
};

/** payload: { jobOrderId, date, ourChallanNo, ewayBillNo, vehicleNo, shipTo, garments, rejects, lotLines, wasteKg } */
export const postReturn = (payload) => mutateInwardDb((db) => {
  const today = todayIso();
  const ctx = ctxOf(db, payload.jobOrderId, today);
  if (!ctx.open) throw mockError('Returns are made on an open job order.', { status: 409, code: 'CONFLICT' });
  const garments = (payload.garments || []).filter((g) => g.qty > 0);
  const rejects = (payload.rejects || []).filter((g) => g.qty > 0);
  const lotLines = (payload.lotLines || []).filter((l) => l.qty > 0);
  const errors = validateReturn({
    ...payload, garments, rejects, lotLines, ready: ctx.ready, rejectsAvailable: ctx.rejectsAvailable, wasteHeld: ctx.waste.onHand,
    wasteRule: ctx.principal.wasteRule, inStoreByLot: Object.fromEntries(ctx.lots.map((l) => [l.id, l.ledger.inStore])),
  });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const r = {
    id: nextId(db, 'ret'), returnNo: nextDocNo(db, 'RTP'), date: payload.date || today, jobOrderId: ctx.jo.id, ourChallanNo: payload.ourChallanNo.trim(),
    ewayBillNo: payload.ewayBillNo || '', vehicleNo: payload.vehicleNo || '', shipTo: payload.shipTo || null, status: RETURN_STATUS.DISPATCHED,
    cancelReason: null, createdBy: 'You', garments, rejects, lotLines, wasteKg: Number(payload.wasteKg) || 0, tally: null,
  };
  db.returns.push(r);
  lotLines.forEach((l) => db.movements.push({ id: nextId(db, 'movement'), type: MOVEMENT.RETURN, date: r.date, docNo: r.returnNo, lotId: l.lotId, qty: Number(l.qty), returnId: r.id, cancelled: false }));
  let left = r.wasteKg;
  if (left > 0 && ctx.principal.wasteRule === WASTE_RULE.RETURN) {
    Object.entries(ctx.waste.byMaterial).forEach(([materialId, t]) => {
      const take = Math.min(left, t.onHand);
      if (take <= 0) return;
      left = r3(left - take);
      db.waste.push({ id: nextId(db, 'waste'), jobOrderId: ctx.jo.id, materialId: Number(materialId), date: r.date, type: 'RETURNED', kg: take, docNo: r.returnNo, returnId: r.id });
    });
  }
  const charge = returnCharges({ jo: ctx.jo, principal: ctx.principal, branch: db.branch, garments });
  return latency({ id: r.id, returnNo: r.returnNo, total: charge.total });
});

/** Cancel a return that is not yet billed in Tally; its lots and waste come back on hand. */
export const cancelReturn = (id, { reason = '' } = {}) => mutateInwardDb((db) => {
  const r = db.returns.find((x) => x.id === Number(id));
  if (!r || r.status !== RETURN_STATUS.DISPATCHED) throw mockError('Only a dispatched return can be cancelled.', { status: 409, code: 'CONFLICT' });
  if (r.tally) throw mockError(`It is already billed in Tally (${r.tally.invoiceNo}); raise a credit note there first.`, { status: 409, code: 'CONFLICT' });
  if (!reason.trim()) throw mockError('Give a reason for cancelling.');
  r.status = RETURN_STATUS.CANCELLED;
  r.cancelReason = reason.trim();
  db.movements.filter((m) => m.returnId === r.id).forEach((m) => { m.cancelled = true; });
  db.waste.filter((w) => w.returnId === r.id).forEach((w) => { w.cancelled = true; });
  return latency({ id: r.id, status: r.status });
});

/** Everything the return challan prints. */
export const getReturnPrint = (id) => {
  const db = loadInwardDb();
  const r = db.returns.find((x) => x.id === Number(id));
  if (!r) return Promise.reject(mockError('Return not found.', { code: 'NOT_FOUND', status: 404 }));
  const ctx = ctxOf(db, r.jobOrderId, todayIso());
  const view = jobOrderView(db, ctx);
  const lotById = Object.fromEntries(db.lots.map((l) => [l.id, l]));
  const challanOf = challanOfLots(db, r.lotLines.map((l) => lotById[l.lotId]));
  return latency(clone({
    ret: r, jobOrder: ctx.jo, principal: ctx.principal, branch: db.branch,
    lotLines: r.lotLines.map((l) => ({ ...l, lot: lotById[l.lotId], itemName: ctx.jo.materials.find((m) => m.id === lotById[l.lotId].materialId)?.itemName, theirDcNo: challanOf[l.lotId] })),
    settles: view.returns.find((x) => x.id === r.id)?.settles || [],
  }));
};
