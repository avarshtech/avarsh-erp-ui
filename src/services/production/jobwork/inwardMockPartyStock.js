/**
 * Mock of Party Stock (plan Phase 2): the principal's material with us, principal → job order → lot,
 * and the moves it can make — issue to our production (or a process vendor, decision 21), move to
 * the principal's next order with their consent, write off, and sell cutting waste with consent
 * (decision 22). Never reaches the API.
 */
import {
  JO_STATUS, MATERIAL_KIND, TARGET_TYPE, WASTE_RULE,
} from '../../../utils/jobWorkInward/inwardConstants';
import { MOVEMENT, validateIssue, validateLotAction } from '../../../utils/jobWorkInward/partyStockRules';
import {
  clone, latency, mockError, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { jobOrderContext } from './inwardMockContext';
import { challanOfLots, liveLots, wasteFor } from './inwardMockLedger';

const r3 = (n) => Math.round(n * 1000) / 1000;
const byUom = (lots, key) => lots.reduce((acc, l) => { acc[l.uom] = r3((acc[l.uom] || 0) + (key(l) || 0)); return acc; }, {});
const uomList = (obj) => Object.entries(obj).filter(([, q]) => q > 0).map(([uom, qty]) => ({ uom, qty }));

/** Tree rows: principal → job order → lot, for an expandable table. */
export const getPartyStock = (filters = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const q = (filters.q || '').trim().toLowerCase();
  const tree = db.principals.filter((p) => !filters.principalId || p.id === filters.principalId).map((p) => {
    const orders = db.jobOrders.filter((j) => j.principalId === p.id && (!filters.jobOrderId || j.id === filters.jobOrderId)).map((jo) => {
      const ctx = jobOrderContext(db, jo, today);
      const challanOf = challanOfLots(db, ctx.lots);
      const lots = ctx.lots.filter((l) => filters.showAll || l.ledger.inStore > 1e-9 || l.outstanding > 1e-9)
        .map((l) => ({ ...l, key: `l${l.id}`, row: 'LOT', itemName: jo.materials.find((m) => m.id === l.materialId)?.itemName, theirDcNo: challanOf[l.id], jobOrderId: jo.id, orderNo: jo.orderNo, principalId: p.id }))
        .filter((l) => !q || [l.lotNo, l.itemName, l.theirDcNo, l.colour, jo.orderNo, jo.styleNo, p.name].some((v) => String(v || '').toLowerCase().includes(q)));
      return {
        key: `o${jo.id}`, row: 'ORDER', id: jo.id, orderNo: jo.orderNo, styleNo: jo.styleNo, styleName: jo.styleName, status: ctx.derived, principalId: p.id, wasteRule: p.wasteRule,
        inStore: uomList(byUom(lots, (l) => l.ledger.inStore)), outstanding: uomList(byUom(lots, (l) => l.outstanding)),
        wasteOnHand: ctx.waste.onHand, ageLevel: Math.max(0, ...lots.map((l) => l.ageLevel)), children: lots,
      };
    }).filter((o) => o.children.length || o.wasteOnHand > 0);
    const lots = orders.flatMap((o) => o.children);
    return {
      key: `p${p.id}`, row: 'PRINCIPAL', id: p.id, name: p.name, wasteRule: p.wasteRule,
      inStore: uomList(byUom(lots, (l) => l.ledger.inStore)), outstanding: uomList(byUom(lots, (l) => l.outstanding)), children: orders,
    };
  }).filter((p) => p.children.length);
  return latency(clone(tree));
};

/** Where a job order's material can go: its Cutting POs (fabric, by colour), Work Order, Finishing PO, process vendors. */
export const getIssueTargets = (jobOrderId) => {
  const db = loadInwardDb();
  const jo = db.jobOrders.find((j) => j.id === Number(jobOrderId));
  if (!jo) return Promise.reject(mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 }));
  const { production: pr } = jo;
  return latency([
    ...pr.cuttingPos.map((c) => ({ type: TARGET_TYPE.CUTTING_PO, docNo: c.docNo, name: 'Unit 1 · Cutting', colour: c.colour })),
    ...(pr.workOrderNo ? [{ type: TARGET_TYPE.WORK_ORDER, docNo: pr.workOrderNo, name: pr.unit }] : []),
    ...(pr.finishingPoNo ? [{ type: TARGET_TYPE.FINISHING_PO, docNo: pr.finishingPoNo, name: 'Unit 1 · Finishing' }] : []),
    ...pr.processDocs.map((d) => ({ type: TARGET_TYPE.PROCESS_PO, docNo: d.docNo, name: `${d.vendorName} (${d.process})` })),
  ]);
};

/** payload: { jobOrderId, target, date, lines: [{ lotId, qty }] } */
export const issueToProduction = (payload) => mutateInwardDb((db) => {
  const date = payload.date || todayIso();
  const lots = liveLots(db, (l) => l.jobOrderId === Number(payload.jobOrderId));
  const lines = (payload.lines || []).filter((l) => (Number(l.qty) || 0) > 0);
  const errors = validateIssue({
    target: payload.target, lines, jobOrderId: Number(payload.jobOrderId),
    inStoreByLot: Object.fromEntries(lots.map((l) => [l.id, l.ledger.inStore])),
    lotJobOrder: Object.fromEntries(db.lots.map((l) => [l.id, l.jobOrderId])),
  });
  lines.forEach((l) => {
    const lot = lots.find((x) => x.id === l.lotId);
    if (payload.target?.type === TARGET_TYPE.CUTTING_PO && lot?.kind !== MATERIAL_KIND.FABRIC) errors.push({ message: 'Only fabric goes to a Cutting PO.' });
    if (payload.target?.colour && lot?.colour && payload.target.colour !== lot.colour) errors.push({ message: `${lot.colour} fabric goes to the ${lot.colour} Cutting PO.` });
  });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const docNo = nextDocNo(db, 'MIS');
  lines.forEach((l) => {
    db.movements.push({ id: nextId(db, 'movement'), type: MOVEMENT.ISSUE, date, docNo, lotId: l.lotId, qty: Number(l.qty), target: payload.target, backFromVendor: null, cancelled: false });
  });
  db.jobOrders.find((j) => j.id === Number(payload.jobOrderId)).events.push({ at: date, by: 'You', text: `${docNo}: their material issued to ${payload.target.docNo}` });
  return latency({ issueNo: docNo });
});

/** Move part of a lot to the principal's next order (their consent), or write it off (a reason). */
export const lotAction = ({ mode, lotId, qty, toJobOrderId, consentRef, reason, date }) => mutateInwardDb((db) => {
  const today = date || todayIso();
  const lot = liveLots(db, (l) => l.id === Number(lotId))[0];
  if (!lot) throw mockError('Lot not found.', { code: 'NOT_FOUND', status: 404 });
  const errors = validateLotAction({ mode, qty, inStore: lot.ledger.inStore, toJobOrderId, consentRef, reason });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const from = db.jobOrders.find((j) => j.id === lot.jobOrderId);
  const material = from.materials.find((m) => m.id === lot.materialId);
  if (mode === 'MOVE') {
    const to = db.jobOrders.find((j) => j.id === Number(toJobOrderId));
    if (!to || to.status !== 'OPEN' || to.principalId !== from.principalId || to.id === from.id) throw mockError('Material moves only to another open order of the same principal.', { status: 409, code: 'CONFLICT' });
    if (jobOrderContext(db, to, today).derived === JO_STATUS.RETURNED) throw mockError(`${to.orderNo} is already returned in full; move it to an order that still needs material.`, { status: 409, code: 'CONFLICT' });
    const target = to.materials.find((m) => m.kind === material.kind && (m.kind === MATERIAL_KIND.TRIM ? m.itemName === material.itemName : m.colour === material.colour));
    if (!target) throw mockError(`${to.orderNo} has no matching material line for ${material.itemName}.`, { status: 409, code: 'CONFLICT' });
    const docNo = nextDocNo(db, 'PSM');
    db.movements.push({ id: nextId(db, 'movement'), type: MOVEMENT.MOVE_OUT, date: today, docNo, lotId: lot.id, qty: Number(qty), consentRef, toJobOrderId: to.id, cancelled: false });
    const moved = { ...db.lots.find((l) => l.id === lot.id), id: nextId(db, 'lot'), lotNo: `${lot.lotNo}-M`, jobOrderId: to.id, materialId: target.id,
      challanQty: Number(qty), receivedQty: Number(qty), defectiveQty: 0, rolls: null, receivedOn: today, origin: { lotId: lot.id, docNo } };
    db.lots.push(moved);
    [from, to].forEach((j) => j.events.push({ at: today, by: 'You', text: `${docNo}: ${qty} ${lot.uom} of ${material.itemName} moved ${from.orderNo} → ${to.orderNo} (consent ${consentRef})` }));
    return latency({ docNo });
  }
  const docNo = nextDocNo(db, 'PSW');
  db.movements.push({ id: nextId(db, 'movement'), type: MOVEMENT.WRITE_OFF, date: today, docNo, lotId: lot.id, qty: Number(qty), reason: reason.trim(), cancelled: false });
  from.events.push({ at: today, by: 'You', text: `${docNo}: ${qty} ${lot.uom} of ${material.itemName} written off — ${reason.trim()}` });
  return latency({ docNo });
});

/** Cutting waste sold by us with the principal's consent (their rule must be "sell"). */
export const recordWasteSale = ({ jobOrderId, kg, buyer, invoiceNo, consentRef, date }) => mutateInwardDb((db) => {
  const jo = db.jobOrders.find((j) => j.id === Number(jobOrderId));
  const p = db.principals.find((x) => x.id === jo?.principalId);
  if (!jo || !p) throw mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 });
  if (p.wasteRule !== WASTE_RULE.SELL) throw mockError(`${p.name}'s waste goes back to them on a return challan.`, { status: 409, code: 'CONFLICT' });
  const waste = wasteFor(db, jo.id);
  let left = Number(kg) || 0;
  if (left <= 0 || left > waste.onHand + 1e-9) throw mockError(`Enter up to ${waste.onHand} kg.`);
  if (![buyer, invoiceNo, consentRef].every((v) => String(v || '').trim())) throw mockError('Enter the buyer, our invoice number and the principal\'s consent reference.');
  const docNo = nextDocNo(db, 'WST');
  Object.entries(waste.byMaterial).forEach(([materialId, t]) => {
    const take = Math.min(left, t.onHand);
    if (take <= 0) return;
    left = r3(left - take);
    db.waste.push({ id: nextId(db, 'waste'), jobOrderId: jo.id, materialId: Number(materialId), date: date || todayIso(), type: 'SOLD', kg: take, docNo, buyer, invoiceNo, consentRef });
  });
  jo.events.push({ at: date || todayIso(), by: 'You', text: `${docNo}: ${kg} kg of cutting waste sold to ${buyer} (consent ${consentRef})` });
  return latency({ docNo });
});
