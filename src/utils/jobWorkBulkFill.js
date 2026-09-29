/**
 * Rate bulk-fill helpers of the job-work PO grids (Cut Panel PO FR-15, Garment Process PO):
 * all sizes of a colour, all colours of a size, every line, the selected lines, and copy the
 * vendor's last rates. Each reports how many lines it would set and how many of those already
 * carry a rate, so the screen can say so before applying (CPP §18.2). Greyed (zero-qty) lines
 * are never touched, and every cell stays editable afterwards (AC-11). `colourKey` names the
 * line's colour field: `colorName` on a Cut Panel PO line, `color` on a Garment Process PO line.
 */
export const BULK_MODE = { COLOUR: 'COLOUR', SIZE: 'SIZE', ALL: 'ALL', SELECTED: 'SELECTED' };

const editable = (l) => Number(l.poQty) > 0;

export const bulkTargets = (lines, mode, target, selectedKeys = [], colourKey = 'colorName') => lines.filter((l) => editable(l) && (
  (mode === BULK_MODE.COLOUR && l[colourKey] === target)
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

/** Lines with a last PO rate — `rateOf(line)` returns it, or nothing — lines without a history keep theirs. */
export const lastRateTargets = (lines, rateOf) => lines.filter((l) => editable(l) && rateOf(l) != null).map((l) => l.key);

export const applyLastRates = (lines, rateOf) => {
  const keys = new Set(lastRateTargets(lines, rateOf));
  return lines.map((l) => (keys.has(l.key) ? { ...l, rate: rateOf(l) } : l));
};
