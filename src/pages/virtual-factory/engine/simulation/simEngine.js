import { dayDiff, num, sum } from '../util.js';
import { workingDayDate } from './calendar.js';
import { MAINTENANCE_SHARE } from './scenarios.js';

/** Stop after this many working days; the result is then reported as not finishing. */
const HORIZON_DAYS = 365;
const STAGE_KEYS = ['cutting', 'sewing', 'finishing', 'packing'];

const lineCapacity = (scenario, capacities) => {
  const chosen = capacities.lines.filter((l) => scenario.lineIds.includes(l.id) && l.id !== scenario.lineDown);
  const typical = capacities.lines.length ? sum(capacities.lines, (l) => l.perDay) / capacities.lines.length : 0;
  return sum(chosen, (l) => l.perDay * (l.id === scenario.maintenanceLine ? MAINTENANCE_SHARE : 1)) + (scenario.addLine ? typical : 0);
};

/**
 * Hour-stepped flow of one order (behind an urgent order when one is inserted) through
 * material → cutting → sewing → end-line QC (rejects go back to sewing first) → finishing →
 * packing → dispatch. Capacities are per day at the normal shift; overtime adds hours at the same
 * hourly rate and the capacity change scales every stage. Deterministic: same input, same result.
 */
export const simulate = (scenario, capacities) => {
  const baseHours = capacities.hoursPerDay;
  const hoursPerDay = baseHours + num(scenario.overtimeHours);
  const factor = 1 + num(scenario.capacityPct) / 100;
  const perHour = (perDay) => (perDay * factor) / baseHours;
  const cap = {
    cutting: perHour(capacities.cuttingPerDay),
    sewing: perHour(lineCapacity(scenario, capacities)),
    finishing: perHour(capacities.finishingPerDay),
    packing: perHour(capacities.packingPerDay),
  };
  const reject = num(scenario.rejectPct ?? capacities.rejectPct) / 100;
  const urgent = num(scenario.urgentQty);
  const total = urgent + num(scenario.qty);
  const readyHour = (num(scenario.materialReadyDays) + num(scenario.fabricDelayDays)) * hoursPerDay;

  const q = { cut: total, bundles: 0, rework: 0, finish: 0, pack: 0 };
  const done = { cut: 0, sewn: 0, passed: 0, rejected: 0, finished: 0, packed: 0 };
  const windows = Object.fromEntries(STAGE_KEYS.map((k) => [k, { start: null, end: null }]));
  const frames = [];
  let urgentShippedAt = urgent ? null : -1;
  let shippedAt = null;
  const limit = HORIZON_DAYS * hoursPerDay;

  for (let h = 0; h < limit && shippedAt == null; h += 1) {
    const material = h >= readyHour;
    const cut = material && cap.cutting > 0 ? Math.min(cap.cutting, q.cut) : 0;
    q.cut -= cut; q.bundles += cut; done.cut += cut;

    const reSewn = Math.min(cap.sewing, q.rework);
    const fresh = Math.min(cap.sewing - reSewn, q.bundles);
    q.rework -= reSewn; q.bundles -= fresh;
    const rejected = fresh * reject;
    const passed = reSewn + fresh - rejected;
    q.rework += rejected; done.sewn += fresh + reSewn; done.rejected += rejected; done.passed += passed;
    q.finish += passed;

    const finished = Math.min(cap.finishing, q.finish);
    q.finish -= finished; q.pack += finished; done.finished += finished;
    const packed = Math.min(cap.packing, q.pack);
    q.pack -= packed; done.packed += packed;

    const moved = { cutting: cut, sewing: fresh + reSewn, finishing: finished, packing: packed };
    STAGE_KEYS.forEach((k) => {
      if (moved[k] > 0.01) {
        if (windows[k].start == null) windows[k].start = h;
        windows[k].end = h;
      }
    });
    if (urgentShippedAt == null && done.packed >= urgent - 0.5) urgentShippedAt = h + 1;
    if (done.packed >= total - 0.5) shippedAt = h + 1;

    frames.push({
      h, day: Math.floor(h / hoursPerDay), hour: h % hoursPerDay, material,
      cut: done.cut, sewn: done.sewn, passed: done.passed, rejected: done.rejected, finished: done.finished, packed: done.packed,
      queues: { cutting: q.cut, sewing: q.bundles, rework: q.rework, finishing: q.finish, packing: q.pack },
      active: { cutting: cut > 0, sewing: fresh + reSewn > 0, qc: fresh + reSewn > 0, finishing: finished > 0, packing: packed > 0 },
      urgentShipped: urgentShippedAt != null && urgentShippedAt >= 0 && h + 1 >= urgentShippedAt,
      shipped: shippedAt != null,
    });
  }

  const endHour = shippedAt ?? frames.length;
  const dateOfHour = (hour) => workingDayDate(scenario.startDay, Math.floor(Math.max(0, hour - 1) / hoursPerDay), capacities.sundayOff);
  const completionDate = shippedAt == null ? null : dateOfHour(shippedAt);
  const stageWindows = STAGE_KEYS.map((key) => ({
    key,
    startHour: windows[key].start,
    endHour: windows[key].end,
    startDay: windows[key].start == null ? null : Math.floor(windows[key].start / hoursPerDay),
    endDay: windows[key].end == null ? null : Math.floor(windows[key].end / hoursPerDay),
    perDay: Math.round(cap[key] * hoursPerDay),
  }));
  const bottleneck = [...stageWindows].sort((a, b) => a.perDay - b.perDay)[0]?.key || null;

  return {
    frames,
    hoursPerDay,
    totalHours: endHour,
    finished: shippedAt != null,
    completionDate,
    urgentCompletionDate: urgent && urgentShippedAt > 0 ? dateOfHour(urgentShippedAt) : null,
    materialReadyDate: workingDayDate(scenario.startDay, Math.floor(readyHour / hoursPerDay), capacities.sundayOff),
    slackDays: completionDate && scenario.dueDay ? dayDiff(completionDate, scenario.dueDay) : null,
    stageWindows,
    bottleneck: bottleneck === 'sewing' && reject > 0.08 ? 'qc' : bottleneck,
    rejectPct: reject * 100,
    sewingPerDay: Math.round(cap.sewing * hoursPerDay),
    total,
  };
};

/** The order with and without the what-ifs, and how many days the what-ifs move delivery. */
export const compareScenario = (scenario, baseline, capacities) => {
  const result = simulate(scenario, capacities);
  const base = simulate(baseline, capacities);
  const delta = result.completionDate && base.completionDate ? dayDiff(base.completionDate, result.completionDate) : null;
  return { result, base, deltaDays: delta };
};
