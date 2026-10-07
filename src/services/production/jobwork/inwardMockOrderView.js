/**
 * What the job order drawer shows (plan Phase 2): materials and the fabric account, progress by colour
 * with the day-wise history, Material In and returns with their charges, our production documents and
 * what still blocks closing.
 */
import { INWARD_STATUS, MATERIAL_KIND } from '../../../utils/jobWorkInward/inwardConstants';
import { challanShort, qtyByColour } from '../../../utils/jobWorkInward/materialRules';
import { challanOfLots } from './inwardMockLedger';
import { toRow } from './inwardMockContext';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const r1 = (n) => Math.round(n * 10) / 10;
const sizesTotal = (bySize) => sum(Object.values(bySize || {}));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "8 rolls · 505 kg", "3 trim lines", "1,414 sets" for a document's lots. */
export const lotSummary = (lots) => ({
  rolls: sum(lots.map((l) => l.rolls?.length || 0)),
  fabricKg: r1(sum(lots.filter((l) => l.kind === MATERIAL_KIND.FABRIC).map((l) => l.receivedQty))),
  trimLines: lots.filter((l) => l.kind === MATERIAL_KIND.TRIM).length,
  panelSets: sum(lots.filter((l) => l.kind === MATERIAL_KIND.PANELS).map((l) => l.receivedQty)),
});

const fabricAccount = (ctx) => ctx.status.filter((m) => m.kind === MATERIAL_KIND.FABRIC).map((m) => {
  const mine = ctx.lots.filter((l) => l.materialId === m.id);
  const L = (k) => r1(sum(mine.map((l) => l.ledger[k])));
  const usedInLays = ctx.fabricUse.find((f) => f.materialId === m.id)?.usedInLays || 0;
  const waste = ctx.waste.byMaterial[m.id] || { held: 0, returned: 0, sold: 0, onHand: 0 };
  return {
    materialId: m.id, itemName: m.itemName, uom: m.uom, received: L('received'), issued: L('issued'), back: L('back'), usedInLays, waste,
    variance: r1(L('issued') - L('back') - usedInLays - waste.held), inStore: L('inStore'), returned: L('returned'),
    writtenOff: L('writtenOff'), movedOut: L('movedOut'), outstanding: r1(sum(mine.map((l) => l.outstanding))),
  };
});

const progressView = (ctx) => {
  const colourQty = qtyByColour(ctx.jo);
  const byColour = ctx.jo.colours.map(({ colour }) => ({
    colour, orderQty: colourQty[colour], cut: ctx.prog.cut[colour] || 0, packed: ctx.prog.packed[colour] || 0, rejects: ctx.prog.rejects[colour] || 0,
    returned: sizesTotal(ctx.returnedBySize[colour]), rejectsReturned: sizesTotal(ctx.rejectsReturnedBySize[colour]), ready: sizesTotal(ctx.ready[colour]),
  }));
  const returnedOn = {};
  ctx.rets.forEach((r) => { returnedOn[r.date] = (returnedOn[r.date] || 0) + sum([...r.garments, ...r.rejects].map((g) => g.qty)); });
  const dates = [...new Set([...ctx.prog.days.map((d) => d.date), ...Object.keys(returnedOn)])].sort().slice(-12).reverse();
  const days = dates.map((date) => {
    const d = ctx.prog.days.find((x) => x.date === date) || { cut: 0, stitched: 0, packed: 0 };
    return { date, cut: d.cut, stitched: d.stitched, packed: d.packed, returned: returnedOn[date] || 0 };
  });
  return { byColour, stitched: ctx.prog.stitched, days };
};

export const jobOrderView = (db, ctx) => {
  const { jo } = ctx;
  const challanOf = challanOfLots(db, ctx.lots);
  const consumedChallans = [...new Set([...ctx.lots].sort((a, b) => a.date.localeCompare(b.date)).filter((l) => l.ledger.consumable > 0).map((l) => challanOf[l.id]))];
  const chargeOf = Object.fromEntries(ctx.charges.map((c) => [c.returnId, c]));
  const inwards = db.inwards.filter((i) => i.jobOrderId === jo.id).map((i) => {
    const lots = db.lots.filter((l) => l.inwardId === i.id && !l.origin);
    return {
      ...i, summary: lotSummary(lots), defectCount: i.defects.length,
      shortLines: lots.filter((l) => challanShort({ ...l, tolerancePct: ctx.principal.weightTolerancePct }) > 0).length,
    };
  });
  const returns = db.returns.filter((r) => r.jobOrderId === jo.id).map((r) => ({
    ...r, pieces: sum(r.garments.map((g) => g.qty)), rejectPieces: sum(r.rejects.map((g) => g.qty)), charge: chargeOf[r.id] || null,
    settles: [...new Set([...r.lotLines.map((l) => challanOf[l.lotId]), ...consumedChallans])].filter(Boolean),
  }));
  const unbilled = ctx.charges.filter((c) => !c.tally);
  const blockers = [];
  if (ctx.inStoreLots.length) blockers.push(`Their material is still in store (${plural(ctx.inStoreLots.length, 'lot')}): return it, move it to their next order or write it off.`);
  if (ctx.waste.onHand > 0) blockers.push(`${ctx.waste.onHand} kg of cutting waste is still held: return it or record the sale.`);
  if (unbilled.length) blockers.push(`${plural(unbilled.length, 'return')} not in Tally yet (${unbilled.map((c) => c.returnNo).join(', ')}).`);
  const accounts = fabricAccount(ctx);
  return {
    row: toRow(ctx), jo, principal: ctx.principal, branch: ctx.branch, interState: ctx.interState,
    materials: ctx.status, fabricAccount: accounts, progress: progressView(ctx), inwards, returns,
    charges: {
      pieces: sum(ctx.charges.map((c) => c.pieces)), taxable: r1(sum(ctx.charges.map((c) => c.taxable))), tax: r1(sum(ctx.charges.map((c) => c.tax))),
      total: r1(sum(ctx.charges.map((c) => c.total))), unbilled: r1(sum(unbilled.map((c) => c.total))),
    },
    production: { ...jo.production, processDocs: jo.production.processDocs.map((p) => ({ ...p, atVendor: sum(ctx.lots.map((l) => l.ledger.atVendor)) })) },
    closeCheck: {
      blockers, piecesOut: Math.max(0, ctx.qty - ctx.goodReturned - ctx.rejectsReturned),
      variance: r1(sum(accounts.map((f) => f.variance))), canClose: !blockers.length && jo.status === 'OPEN',
    },
    cancellable: jo.status === 'OPEN' && !inwards.some((i) => i.status === INWARD_STATUS.POSTED),
    waste: ctx.waste,
  };
};
