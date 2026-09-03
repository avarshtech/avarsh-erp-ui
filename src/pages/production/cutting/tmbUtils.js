/**
 * BR-FR-04-03 — a part+size row passes when the Top, Middle and Bottom
 * measurements agree within the tolerance. A saved row carries the server's own
 * verdict; this recomputes it live while the grid is being filled in.
 */
export const tmbRowInTolerance = (row, toleranceCm = 0.5) => {
  const readings = [row?.top, row?.middle, row?.bottom].filter((v) => v != null && v !== '');
  if (readings.length < 3) return true; // incomplete rows are pending, not failed
  return Math.max(...readings) - Math.min(...readings) <= toleranceCm;
};

/** Largest gap between the three readings; null while any is missing. */
export const tmbRowSpread = (row) => {
  const readings = [row?.top, row?.middle, row?.bottom].filter((v) => v != null && v !== '');
  if (readings.length < 3) return null;
  return Math.round((Math.max(...readings) - Math.min(...readings)) * 100) / 100;
};
