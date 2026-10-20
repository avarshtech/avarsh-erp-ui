/**
 * The principal's material, read from the inward demo: live lots with their ledgers, cutting waste per
 * fabric line, and what is still to be accounted for lot by lot (oldest challan first). Used by every
 * inward mock module.
 */
import { INWARD_STATUS, MATERIAL_KIND, RETURN_STATUS } from '../../../utils/jobWorkInward/inwardConstants';
import { ageDays, ageLevel, lotLedger } from '../../../utils/jobWorkInward/partyStockRules';
import { accountedByPieces, knockOff } from '../../../utils/jobWorkInward/knockOff';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Lots of posted Material In documents (and lots moved in from another order), each with its ledger. */
export const liveLots = (db, filter = () => true) => {
  const posted = new Set(db.inwards.filter((i) => i.status === INWARD_STATUS.POSTED).map((i) => i.id));
  return db.lots.filter((l) => (l.origin || posted.has(l.inwardId)) && filter(l)).map((l) => ({
    ...l, ledger: lotLedger(l, db.movements.filter((m) => m.lotId === l.id && !m.cancelled)),
  }));
};

export const liveReturns = (db, jobOrderId) => db.returns
  .filter((r) => r.status === RETURN_STATUS.DISPATCHED && (jobOrderId === undefined || r.jobOrderId === jobOrderId));

/** Cutting waste per fabric line: held, returned, sold and still on hand (kg). */
export const wasteFor = (db, jobOrderId) => {
  const byMaterial = {};
  db.waste.filter((w) => w.jobOrderId === jobOrderId && !w.cancelled).forEach((w) => {
    const t = byMaterial[w.materialId] || { held: 0, returned: 0, sold: 0 };
    if (w.type === 'HELD') t.held += w.kg;
    if (w.type === 'RETURNED') t.returned += w.kg;
    if (w.type === 'SOLD') t.sold += w.kg;
    byMaterial[w.materialId] = t;
  });
  Object.values(byMaterial).forEach((t) => { t.onHand = r3(t.held - t.returned - t.sold); });
  return { byMaterial, onHand: r3(sum(Object.values(byMaterial).map((t) => t.onHand))) };
};

/**
 * Still to be accounted for per lot: returned, written-off and moved quantities settle their own lot;
 * returned pieces (good + rejected) × the agreed consumption and disposed waste settle the oldest
 * challan first. Adds `outstanding`, `ageDays` and `ageLevel` to each lot.
 */
export const withOutstanding = (jo, lots, rets, waste, today) => {
  const pieces = {};
  rets.forEach((r) => [...r.garments, ...r.rejects].forEach((g) => { pieces[g.colour] = (pieces[g.colour] || 0) + g.qty; }));
  const all = sum(Object.values(pieces));
  const outstanding = {};
  jo.materials.forEach((m) => {
    const mine = lots.filter((l) => l.materialId === m.id);
    if (!mine.length) return;
    let accounted = accountedByPieces({ consumption: m.consumption, pieces: m.colour ? pieces[m.colour] || 0 : all });
    if (m.kind === MATERIAL_KIND.FABRIC) accounted += (waste.byMaterial[m.id]?.returned || 0) + (waste.byMaterial[m.id]?.sold || 0);
    const k = knockOff(mine.map((l) => ({
      id: l.id, date: l.date, received: l.receivedQty, returned: l.ledger.returned, writtenOff: l.ledger.writtenOff, movedOut: l.ledger.movedOut, consumable: l.ledger.consumable,
    })), accounted);
    Object.entries(k.byLot).forEach(([id, v]) => { outstanding[id] = v.outstanding; });
  });
  return lots.map((l) => {
    const days = ageDays(l.date, today);
    const left = outstanding[l.id] ?? l.ledger.inStore;
    return { ...l, outstanding: left, ageDays: days, ageLevel: left > 0 ? ageLevel(days) : 0 };
  });
};

/** The principal's challan each lot came on: { lotId: their DC no }. */
export const challanOfLots = (db, lots) => {
  const byInward = Object.fromEntries(db.inwards.map((i) => [i.id, i.theirDcNo]));
  return Object.fromEntries(lots.map((l) => [l.id, byInward[l.inwardId]]));
};
