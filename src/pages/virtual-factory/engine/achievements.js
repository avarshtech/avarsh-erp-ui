import { isOpenOrder } from './adapters/orders.js';
import { expectedSoFar } from './pace.js';
import { dayDiff, formatQty, round } from './util.js';

/**
 * Achievements are earned only by operational results in the ERP's own figures — never by using
 * the screen. Each one names the line or team that holds it and the number that earned it; one with
 * no data today says so instead of being awarded.
 */
const best = (list, value) => list.reduce((top, item) => (top == null || value(item) > value(top) ? item : top), null);

const productionChampion = (snapshot, rules, clock) => {
  const lines = snapshot.sewing.lines.filter((l) => l.active && expectedSoFar(l, clock.elapsedHours) > 0);
  const top = best(lines, (l) => l.output / expectedSoFar(l, clock.elapsedHours));
  if (!top) return { available: false, detail: 'No line has a target pace yet today.' };
  const ratio = (top.output / expectedSoFar(top, clock.elapsedHours)) * 100;
  return {
    available: true, earned: ratio >= rules.achievements.productionChampionPct, holder: top.name,
    value: `${round(ratio)}% of target pace`,
    detail: `${top.name} sewed ${formatQty(top.output)} pieces; needs ${rules.achievements.productionChampionPct}% of pace.`,
  };
};

const fastestLine = (snapshot, rules) => {
  const top = best(snapshot.sewing.lines.filter((l) => l.active && l.efficiencyPct != null), (l) => l.efficiencyPct);
  if (!top) return { available: false, detail: 'No line efficiency is recorded today.' };
  return {
    available: true, earned: top.efficiencyPct >= rules.achievements.fastestLineMinEfficiencyPct, holder: top.name,
    value: `${round(top.efficiencyPct, 1)}% efficiency`,
    detail: `Best efficiency on the floor today; needs at least ${rules.achievements.fastestLineMinEfficiencyPct}%.`,
  };
};

const qualityChampion = (snapshot, rules) => {
  const a = rules.achievements;
  const eligible = snapshot.qc.byLine.filter((q) => q.inspected >= a.qualityMinInspected);
  const top = best(eligible, (q) => -q.dhuPct);
  if (!top) return { available: false, detail: `No line has ${formatQty(a.qualityMinInspected)} pieces inspected today.` };
  return {
    available: true, earned: top.dhuPct <= a.qualityChampionMaxDhuPct, holder: top.line,
    value: `DHU ${round(top.dhuPct, 1)}%`,
    detail: `${formatQty(top.inspected)} pieces inspected; needs DHU at most ${a.qualityChampionMaxDhuPct}%.`,
  };
};

const packingMaster = (snapshot, rules) => {
  const pieces = snapshot.packing.today.pieces;
  if (snapshot.sources?.packing?.state !== 'ok') return { available: false, detail: 'Packing data is not available.' };
  return {
    available: true, earned: pieces >= rules.achievements.packingMasterPieces, holder: 'Packing team',
    value: `${formatQty(pieces)} pieces packed today`,
    detail: `${formatQty(snapshot.packing.today.cartons)} cartons; needs ${formatQty(rules.achievements.packingMasterPieces)} pieces.`,
  };
};

const onTimeDispatch = (snapshot, rules) => {
  const due = snapshot.orders.filter((o) => isOpenOrder(o) && o.due && dayDiff(snapshot.today, o.due) <= rules.targets.dueSoonDays);
  if (!due.length) return { available: false, detail: `No open order is due in the next ${rules.targets.dueSoonDays} days.` };
  const onTrack = due.filter((o) => snapshot.progress.get(o.no)?.risk === 'on-track').length;
  const share = (onTrack / due.length) * 100;
  return {
    available: true, earned: share >= rules.achievements.onTimeDispatchPct, holder: 'Merchandising & production',
    value: `${round(share)}% on track`,
    detail: `${onTrack} of ${due.length} orders due soon are on track to ship on time (projected from today's progress; the ERP has no dispatch records yet).`,
  };
};

const zeroWaste = (snapshot, rules) => {
  if (!snapshot.cutting.totalCut) return { available: false, detail: 'No cutting is recorded yet.' };
  return {
    available: true, earned: snapshot.cutting.reCutPct <= rules.achievements.zeroWasteReCutPct, holder: 'Cutting room',
    value: `${round(snapshot.cutting.reCutPct, 2)}% re-cut`,
    detail: `Re-cut pieces against all ${formatQty(snapshot.cutting.totalCut)} pieces cut so far (cutting dashboard); needs at most ${rules.achievements.zeroWasteReCutPct}%.`,
  };
};

const factoryExcellence = (snapshot, rules, clock, health) => {
  if (health.score == null) return { available: false, detail: 'The health score has no data yet.' };
  return {
    available: true, earned: health.score >= rules.achievements.factoryExcellenceScore, holder: 'Whole factory',
    value: `Health ${health.score}`, detail: `Needs a health score of ${rules.achievements.factoryExcellenceScore}.`,
  };
};

export const ACHIEVEMENTS = [
  { id: 'production-champion', icon: '🏆', title: 'Production Champion', calc: productionChampion },
  { id: 'fastest-line', icon: '⚡', title: 'Fastest Line', calc: fastestLine },
  { id: 'quality-champion', icon: '🎯', title: 'Quality Champion', calc: qualityChampion },
  { id: 'packing-master', icon: '📦', title: 'Packing Master', calc: packingMaster },
  { id: 'on-time-dispatch', icon: '🚚', title: 'On-Time Dispatch', calc: onTimeDispatch },
  { id: 'zero-waste', icon: '🧵', title: 'Zero Material Waste', calc: zeroWaste },
  { id: 'factory-excellence', icon: '🏭', title: 'Factory Excellence', calc: factoryExcellence },
];

export const computeAchievements = (snapshot, rules, clock, health) => ACHIEVEMENTS.map(({ calc, ...meta }) => ({
  ...meta,
  earned: false,
  ...calc(snapshot, rules, clock, health),
}));

/** Running lines ranked by efficiency, then output. */
export const lineLeaderboard = (snapshot) => snapshot.sewing.lines
  .filter((l) => l.active)
  .map((l) => ({ id: l.id, line: l.name, style: l.style, efficiencyPct: l.efficiencyPct, output: l.output, target: l.targetPerDay, dhuPct: l.qc?.dhuPct ?? l.dhuPct }))
  .sort((a, b) => (b.efficiencyPct ?? -1) - (a.efficiencyPct ?? -1) || b.output - a.output);
