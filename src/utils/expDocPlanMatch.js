/**
 * The buyer's plan against what was packed (owner, 2026-10-09: the buyer's packing list
 * sometimes fixes the carton breakdown). A plan row is a carton range in the BUYER's
 * numbers, for one PO, with what each carton should hold; the packed rows are the list's
 * cartons, numbered as they print. Pure.
 *
 * Per plan row: PACKED (every carton packed as planned), PARTLY_PACKED (some not yet),
 * DIFFERS (packed, but holding something else), NOT_PACKED, or NOT_SHIPPING (marked so,
 * with a reason, when the shipment goes short). Packed cartons outside every plan row of
 * their PO are EXTRA.
 */
import {
  toRanges, intersectRanges, mergeRanges, countCartons, formatRanges, sizeQtyPerCarton, cartonCount,
} from './expDocCalc';

export const PLAN_STATUS = {
  PACKED: 'PACKED', PARTLY_PACKED: 'PARTLY_PACKED', DIFFERS: 'DIFFERS', NOT_PACKED: 'NOT_PACKED', NOT_SHIPPING: 'NOT_SHIPPING',
};

export const PLAN_STATUS_LABELS = {
  [PLAN_STATUS.PACKED]: 'Packed',
  [PLAN_STATUS.PARTLY_PACKED]: 'Partly packed',
  [PLAN_STATUS.DIFFERS]: 'Differs',
  [PLAN_STATUS.NOT_PACKED]: 'Not packed',
  [PLAN_STATUS.NOT_SHIPPING]: 'Not shipping',
};

const lower = (v) => String(v ?? '').trim().toLowerCase();
const rangeOf = (r) => ({ from: Number(r.cartonFrom) || 0, to: Number(r.cartonTo) || 0 });
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sizesOf = (r) => Object.fromEntries(Object.entries(sizeQtyPerCarton(r)).filter(([, q]) => Number(q) > 0));

/** What differs between a planned and a packed carton, in the words the screen uses. */
export const contentDiff = (plan, packed) => {
  const out = [];
  if (plan.packingType !== packed.packingType) out.push('packing type');
  if (plan.packingType !== 'MIXED' && lower(plan.colorName) !== lower(packed.colorName)) out.push('colour');
  if (!same(sizesOf(plan), sizesOf(packed))) out.push('sizes per carton');
  if (plan.packingType === 'MIXED' && !same(
    (plan.mixedRows || []).map((m) => lower(m.colorName)).sort(),
    (packed.mixedRows || []).map((m) => lower(m.colorName)).sort(),
  )) out.push('colours in the carton');
  return out;
};

/**
 * Match one PO's plan rows with its packed rows. Returns each plan row with its status,
 * `toPack` (its ranges not yet packed) and `differs` (ranges packed differently, and
 * what differs), plus the EXTRA ranges packed outside the plan.
 */
export const matchPlan = (planRows = [], packedRows = []) => {
  const packed = toRanges(packedRows);
  const rows = planRows.map((plan) => {
    const want = [rangeOf(plan)];
    const hits = packed.filter((p) => intersectRanges(want, [p]).length);
    const covered = mergeRanges(hits.flatMap((p) => intersectRanges(want, [p])));
    const toPack = subtractRanges(want, covered);
    const differs = hits
      .map((p) => ({ ranges: intersectRanges(want, [p]), aspects: contentDiff(plan, p.row) }))
      .filter((d) => d.aspects.length);
    let status = PLAN_STATUS.PACKED;
    if (differs.length) status = PLAN_STATUS.DIFFERS;
    else if (!covered.length) status = plan.notShipping ? PLAN_STATUS.NOT_SHIPPING : PLAN_STATUS.NOT_PACKED;
    else if (toPack.length) status = plan.notShipping ? PLAN_STATUS.PACKED : PLAN_STATUS.PARTLY_PACKED;
    return {
      plan,
      status,
      toPack: plan.notShipping ? [] : toPack,
      differs,
      packedCartons: countCartons(covered),
      plannedCartons: cartonCount(plan),
    };
  });
  const planned = mergeRanges(planRows.map(rangeOf));
  const extra = subtractRanges(mergeRanges(packed), planned);
  return { rows, extra };
};

/** Ranges of `a` not in `b`. */
export const subtractRanges = (a, b) => {
  const cut = mergeRanges(b);
  return mergeRanges(a).flatMap((r) => {
    let pieces = [{ ...r }];
    cut.forEach((c) => {
      pieces = pieces.flatMap((p) => {
        if (c.to < p.from || c.from > p.to) return [p];
        const out = [];
        if (c.from > p.from) out.push({ from: p.from, to: c.from - 1 });
        if (c.to < p.to) out.push({ from: c.to + 1, to: p.to });
        return out;
      });
    });
    return pieces;
  });
};

/** "Plan 80 · packed 40 · 40 to pack", for a PO group's chip. */
export const planChip = (match) => {
  const planned = match.rows.reduce((n, r) => n + (r.plan.notShipping ? 0 : r.plannedCartons), 0);
  const packed = match.rows.reduce((n, r) => n + r.packedCartons, 0);
  const toPack = match.rows.reduce((n, r) => n + countCartons(r.toPack), 0);
  const differ = match.rows.filter((r) => r.status === PLAN_STATUS.DIFFERS).length;
  return [`Plan ${planned}`, `packed ${packed}`, toPack ? `${toPack} to pack` : null, differ ? `${differ} differ` : null]
    .filter(Boolean).join(' · ');
};

/**
 * Carton Packing rows for planned ranges still to pack: the plan's contents and PO, and
 * the BUYER's carton numbers, so the list prints them as planned. Weights and dimensions
 * come along when the plan has them; the packer enters the real ones.
 */
export const rowsToPack = (planRow, ranges, nextId) => ranges.map((r) => ({
  ...planRow,
  id: nextId(),
  cartonFrom: r.from,
  cartonTo: r.to,
  notShipping: undefined,
  poKey: undefined,
  completionFlag: false,
}));

export const rangesText = (ranges) => formatRanges(ranges);
