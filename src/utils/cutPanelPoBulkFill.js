/**
 * Rate bulk-fill helpers of the Cut Panel PO grid (PRD FR-15): all sizes of a colour, all
 * colours of a size, every line, the selected lines, and copy the vendor's last rates.
 * Each reports how many lines it would set and how many of those already carry a rate,
 * so the screen can say so before applying (§18.2). Greyed (zero-balance, zero-qty) lines
 * are never touched, and every cell stays editable afterwards (AC-11).
 */
export const BULK_MODE = { COLOUR: 'COLOUR', SIZE: 'SIZE', ALL: 'ALL', SELECTED: 'SELECTED' };

const editable = (l) => Number(l.poQty) > 0;

export const bulkTargets = (lines, mode, target, selectedKeys = []) => lines.filter((l) => editable(l) && (
  (mode === BULK_MODE.COLOUR && l.colorName === target)
  || (mode === BULK_MODE.SIZE && l.size === target)
  || mode === BULK_MODE.ALL
  || (mode === BULK_MODE.SELECTED && selectedKeys.includes(l.key))
)).map((l) => l.key);

const hasRate = (l) => l.rate !== null && l.rate !== undefined && l.rate !== '';

export const bulkImpact = (lines, keys) => {
  const set = new Set(keys);
  const hit = lines.filter((l) => set.has(l.key));
  return { count: hit.length, overwrites: hit.filter(hasRate).length };
};

export const applyRate = (lines, keys, rate) => {
  const set = new Set(keys);
  return lines.map((l) => (set.has(l.key) ? { ...l, rate } : l));
};

/** Last PO rates keyed 'style|size' (lookups.lastRates): lines without a history keep theirs. */
export const lastRateTargets = (lines, byKey) => lines
  .filter((l) => editable(l) && byKey[`${l.styleNo}|${l.size}`] !== undefined).map((l) => l.key);

export const applyLastRates = (lines, byKey) => {
  const keys = new Set(lastRateTargets(lines, byKey));
  return lines.map((l) => (keys.has(l.key) ? { ...l, rate: byKey[`${l.styleNo}|${l.size}`] } : l));
};
