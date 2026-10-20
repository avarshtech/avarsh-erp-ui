/**
 * Live-preview arithmetic for the sewing screens, mirroring SewPlanCalculator on
 * the server. A saved plan always carries the server's own figures — these exist
 * only so the grid updates as the planner types, before anything is posted.
 * Keep the two in step.
 */
import { HOURS, TOPSE_HOUR_NUMBERS, topseHourLabel } from './sewingConstants';

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

/**
 * End-line figures, mirroring SewTopseCalculator on the server: DHU counts
 * faults against pieces inspected, pass rate counts pieces that did not go
 * back, and the same fault logged in three hours is one Pareto bar, not three.
 */
export const topseTotals = (defects, totalInspected, greenMax, yellowMax) => {
  const inspected = Number(totalInspected) || 0;
  const totalDefects = defects.reduce((s, d) => s + (d.count || 0), 0);
  const totalRework = defects.reduce((s, d) => s + (d.rework || 0), 0);
  const rate = (part) => (inspected > 0 ? Math.round((part / inspected) * 10000) / 100 : 0);
  const dhuPct = rate(totalDefects);

  const byType = new Map();
  defects.forEach((d) => {
    if (!d.defectTypeId || !d.count) return;
    const row = byType.get(d.defectTypeId)
      || { defectTypeId: d.defectTypeId, category: d.category, defectType: d.defectType, count: 0 };
    row.count += d.count;
    byType.set(d.defectTypeId, row);
  });
  const pareto = [...byType.values()]
    .sort((a, b) => b.count - a.count || String(a.defectType).localeCompare(String(b.defectType)))
    .slice(0, 5)
    .map((row) => ({ ...row, sharePct: totalDefects ? Math.round((row.count / totalDefects) * 100) : 0 }));

  const counts = TOPSE_HOUR_NUMBERS.map(
    (hour) => defects.filter((d) => d.hour === hour).reduce((s, d) => s + (d.count || 0), 0),
  );
  const peak = Math.max(0, ...counts);
  const byHour = TOPSE_HOUR_NUMBERS.map((hour, i) => ({
    hour, label: topseHourLabel(hour), count: counts[i], peak: peak > 0 && counts[i] === peak,
  }));

  return {
    totalDefects,
    totalRework,
    dhuPct,
    passRatePct: rate(Math.max(0, inspected - totalRework)),
    trafficLight: dhuPct <= greenMax ? 'GREEN' : dhuPct <= yellowMax ? 'YELLOW' : 'RED',
    pareto,
    paretoMax: pareto[0]?.count || 1,
    byHour,
  };
};

/**
 * Whether one measurement point is inside its tolerance. A point exactly on the
 * limit is neither a pass nor a failure — it is the one the QA lead looks at.
 */
export const pointStatus = (p) => {
  if (p.actual == null || p.spec == null) return { status: 'PENDING', deviation: null };
  const deviation = Math.round((p.actual - p.spec) * 1000) / 1000;
  const tolerance = Number(p.tolerance) || 0;
  const gap = Math.round((Math.abs(deviation) - tolerance) * 1000) / 1000;
  return { status: gap > 0 ? 'FAIL' : gap === 0 ? 'AT_LIMIT' : 'PASS', deviation };
};

/** The report's verdict, mirroring SewMeasurementCalculator on the server. */
export const measurementResult = (points) => {
  const counts = { PASS: 0, AT_LIMIT: 0, FAIL: 0, PENDING: 0 };
  points.forEach((p) => { counts[pointStatus(p).status] += 1; });
  const measured = counts.PASS + counts.AT_LIMIT + counts.FAIL;
  return {
    ...counts,
    failCount: counts.FAIL,
    measured,
    result: counts.FAIL > 0 ? 'NOT_APPROVED'
      : measured === 0 || counts.AT_LIMIT > 0 ? 'CONDITIONAL' : 'APPROVED',
  };
};

/** Line efficiency: standard minutes produced against minutes actually paid for. */
export const efficiencyPct = (completed, sam, presentOperators, workedHours) => (
  sam > 0 && presentOperators > 0 && workedHours > 0
    ? Math.round(((completed * sam) / (presentOperators * workedHours * 60)) * 10000) / 100
    : 0);
