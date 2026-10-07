import { isOpenOrder } from './adapters/orders.js';
import { expectedSoFar } from './pace.js';
import { clamp, dayDiff, formatQty, num, round, sum } from './util.js';

export const PILLARS = [
  { key: 'production', label: 'Production' },
  { key: 'quality', label: 'Quality' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'efficiency', label: 'Efficiency' },
];

const missing = (summary) => ({ score: null, summary });

const production = (snapshot, rules, clock) => {
  const lines = snapshot.sewing.lines.filter((l) => l.active);
  if (!lines.length) return missing('No sewing line is running a plan today.');
  const expected = sum(lines, (l) => expectedSoFar(l, clock.elapsedHours));
  if (expected < 1) return missing('The shift has not started yet.');
  const output = sum(lines, (l) => l.output);
  return {
    score: clamp((output / expected) * 100, 0, 100),
    summary: `${formatQty(output)} pieces sewn of ${formatQty(expected)} expected by now.`,
  };
};

const quality = (snapshot, rules) => {
  let dhu = snapshot.qc.dhuPct;
  let basis = `${formatQty(snapshot.qc.inspected)} pieces inspected at end of line`;
  if (dhu == null) {
    const lines = snapshot.sewing.lines.filter((l) => l.active && l.dhuPct != null);
    if (!lines.length) return missing('No end-line inspection is recorded today.');
    const weight = sum(lines, (l) => Math.max(1, l.output));
    dhu = sum(lines, (l) => l.dhuPct * Math.max(1, l.output)) / weight;
    basis = 'from the lines’ own DHU';
  }
  return {
    score: clamp(100 * (1 - dhu / rules.targets.maxDhuPct), 0, 100),
    summary: `DHU ${round(dhu, 1)}% (${basis}); quality scores zero at ${rules.targets.maxDhuPct}%.`,
  };
};

const inventory = (snapshot) => {
  const checked = num(snapshot.shortageChecked);
  if (!checked) return missing('No order due soon has had its material checked.');
  const short = new Set(snapshot.shortages.map((s) => s.orderNo)).size;
  return {
    score: clamp(100 * (1 - short / checked), 0, 100),
    summary: short
      ? `${short} of ${checked} orders due soon are short of material.`
      : `All ${checked} orders due soon have their material.`,
  };
};

const delivery = (snapshot, rules) => {
  const due = snapshot.orders.filter((o) => isOpenOrder(o) && o.due && dayDiff(snapshot.today, o.due) <= rules.targets.dueSoonDays);
  if (!due.length) return missing(`No open order is due in the next ${rules.targets.dueSoonDays} days.`);
  const risk = (o) => snapshot.progress.get(o.no)?.risk;
  const onTrack = due.filter((o) => risk(o) === 'on-track').length;
  const late = due.filter((o) => risk(o) === 'late').length;
  return {
    score: (onTrack / due.length) * 100,
    summary: `${onTrack} of ${due.length} orders due in ${rules.targets.dueSoonDays} days are on track${late ? `, ${late} late` : ''}.`,
  };
};

const efficiency = (snapshot, rules) => {
  const lines = snapshot.sewing.lines.filter((l) => l.active && l.efficiencyPct != null);
  if (!lines.length) return missing('No line efficiency is recorded today.');
  const weight = sum(lines, (l) => Math.max(1, l.operatorsPresent));
  const avg = sum(lines, (l) => l.efficiencyPct * Math.max(1, l.operatorsPresent)) / weight;
  return {
    score: clamp((avg / rules.targets.efficiencyPct) * 100, 0, 100),
    summary: `Average line efficiency ${round(avg, 1)}% against a ${rules.targets.efficiencyPct}% target.`,
  };
};

const CALC = { production, quality, inventory, delivery, efficiency };

export const bandOf = (score, rules) => {
  if (score == null) return 'none';
  if (score >= rules.bands.good) return 'good';
  return score >= rules.bands.watch ? 'watch' : 'alert';
};

/** The Factory Health score: each pillar 0–100, combined by the rules' weights over pillars with data. */
export const computeHealth = (snapshot, rules, clock) => {
  const pillars = PILLARS.map(({ key, label }) => {
    const result = CALC[key](snapshot, rules, clock);
    const score = result.score == null ? null : round(result.score);
    return { key, label, weight: num(rules.weights[key]), score, summary: result.summary, band: bandOf(score, rules) };
  });
  const scored = pillars.filter((p) => p.score != null && p.weight > 0);
  const weight = sum(scored, (p) => p.weight);
  const score = weight ? round(sum(scored, (p) => p.score * p.weight) / weight) : null;
  return { score, band: bandOf(score, rules), pillars };
};
