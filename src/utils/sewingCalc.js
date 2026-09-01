/**
 * Live-preview arithmetic for the sewing screens, mirroring SewPlanCalculator on
 * the server. A saved plan always carries the server's own figures — these exist
 * only so the grid updates as the planner types, before anything is posted.
 * Keep the two in step.
 */
import { HOURS } from './sewingConstants';

/** Garment SAM: the sum of the operations, never a figure typed beside them. */
export const totalSamOf = (operations) => Math.round(
  (operations || []).reduce((sum, o) => sum + (Number(o.sam) || 0), 0) * 100,
) / 100;

/** Line output per hour = (operators × 60 ÷ garment SAM) × target efficiency. */
export const targetPerHour = (operators, sam, targetEffPct) => (sam > 0
  ? Math.round(((operators * 60) / sam) * ((targetEffPct || 0) / 100))
  : 0);

/** One operator on one operation, per hour. */
export const operationTargetPerHour = (sam, targetEffPct) => targetPerHour(1, sam, targetEffPct);

/** The pitch: the longest operation, which paces the whole line. */
export const pitchOf = (operations) => Math.max(
  0, ...(operations || []).map((o) => Number(o.sam) || 0),
);

/** Sum of the piece rates paid across the operations. */
export const operationRateTotal = (operations) => Math.round(
  (operations || []).reduce((sum, o) => sum + (Number(o.rate) || 0), 0) * 100,
) / 100;

/** Cut-make rate per piece: the operation rates plus the other-charges load. */
export const cmRatePerPc = (operations, otherChargesPct) => Math.round(
  operationRateTotal(operations) * (1 + (Number(otherChargesPct) || 0) / 100) * 100,
) / 100;

/** Hourly sheet: what one tailor made across the eight hours plus overtime. */
export const rowTotal = (row) => HOURS.reduce((sum, h) => sum + (row[h] || 0), 0) + (row.ot || 0);

/**
 * Finished garments on a sheet: the output of the plan's last operation, summed
 * over every operator working it. Adding up all the operations would count the
 * same garment once per station it passed through.
 */
export const completedOf = (rows, lastOperationId) => (lastOperationId == null ? 0
  : (rows || [])
    .filter((r) => r.operationId === lastOperationId)
    .reduce((sum, r) => sum + rowTotal(r), 0));

/** Hours where somebody counted something — a blank hour is not a worked hour. */
export const workedHoursOf = (rows) => HOURS.filter(
  (h) => (rows || []).some((r) => r[h] != null),
).length;

/** Line efficiency: standard minutes produced against minutes actually paid for. */
export const efficiencyPct = (completed, sam, presentOperators, workedHours) => (
  sam > 0 && presentOperators > 0 && workedHours > 0
    ? Math.round(((completed * sam) / (presentOperators * workedHours * 60)) * 10000) / 100
    : 0);
