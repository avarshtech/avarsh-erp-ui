import { TMB_TOLERANCE_CM } from '../../../utils/cuttingConstants';

/**
 * BR-FR-04-03 — a part+size row passes when the Top, Middle and Bottom
 * measurements stay within ±0.5 cm of each other.
 */
export const tmbRowInTolerance = (row) => {
  const all = [...(row.top || []), ...(row.middle || []), ...(row.bottom || [])]
    .filter((v) => v != null && v !== '');
  if (all.length < 3) return true; // incomplete rows are "pending", not failed
  return Math.max(...all) - Math.min(...all) <= TMB_TOLERANCE_CM;
};
