/**
 * Finishing quality maths the screens work out locally (pure, no I/O): an hourly row's total,
 * the AQL 2.5 sampling plan for a lot, and DHU %.
 */
import { HOURS, AQL_25_TABLE } from '../../utils/finishingConstants';

export const rowTotal = (row) => HOURS.reduce((s, h) => s + (row[h] || 0), 0) + (row.ot || 0);

/** AQL 2.5 lookup: lot size → { sample, accept, reject } (PRD §17.2). */
export const aqlSample = (lotSize) => {
  const hit = AQL_25_TABLE.find(([min, max]) => lotSize >= min && lotSize <= max);
  if (!hit) return null;
  const [, , sample, accept, reject] = hit;
  return { sample: Math.min(sample, lotSize), accept, reject };
};

export const dhuPct = (defects, checked) => (checked
  ? Math.round((defects / checked) * 1000) / 10 : 0);
