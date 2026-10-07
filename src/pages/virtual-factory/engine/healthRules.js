import { clamp, num } from './util.js';

/**
 * Factory Health rules: weights, targets, alert thresholds and achievement criteria. The organisation's
 * saved copy (GET /virtual-factory/rules) is merged over these defaults field by field and clamped to
 * each field's range, so a missing or out-of-range value can never break a score.
 */
export const RULES_SCHEMA_VERSION = 1;

export const DEFAULT_RULES = {
  schemaVersion: RULES_SCHEMA_VERSION,
  weights: { production: 25, quality: 20, inventory: 15, delivery: 25, efficiency: 15 },
  shift: { startHour: 9, hours: 8 },
  targets: { efficiencyPct: 85, maxDhuPct: 10, deliveryGraceDays: 0, dueSoonDays: 14 },
  bands: { good: 85, watch: 70 },
  alerts: {
    highRejectionDhuPct: 5,
    behindPlanPct: 20,
    bottleneckEfficiencyPct: 60,
    bottleneckBehindPct: 40,
    bottleneckWipPcs: 600,
    relaxationWarnHours: 4,
  },
  achievements: {
    productionChampionPct: 100,
    fastestLineMinEfficiencyPct: 80,
    qualityChampionMaxDhuPct: 2,
    qualityMinInspected: 100,
    packingMasterPieces: 1000,
    onTimeDispatchPct: 95,
    zeroWasteReCutPct: 0.5,
    factoryExcellenceScore: 90,
  },
};

/** Every editable rule: where it lives, how the editor shows it, and the range it is clamped to. */
export const RULE_FIELDS = [
  { path: 'weights.production', group: 'Score weights', label: 'Production', min: 0, max: 100 },
  { path: 'weights.quality', group: 'Score weights', label: 'Quality', min: 0, max: 100 },
  { path: 'weights.inventory', group: 'Score weights', label: 'Inventory', min: 0, max: 100 },
  { path: 'weights.delivery', group: 'Score weights', label: 'Delivery', min: 0, max: 100 },
  { path: 'weights.efficiency', group: 'Score weights', label: 'Efficiency', min: 0, max: 100 },
  { path: 'shift.startHour', group: 'Working day', label: 'Shift starts at (hour)', min: 0, max: 23 },
  { path: 'shift.hours', group: 'Working day', label: 'Working hours a day', min: 4, max: 16, unit: 'h' },
  { path: 'targets.efficiencyPct', group: 'Targets', label: 'Line efficiency target', min: 30, max: 120, unit: '%' },
  { path: 'targets.maxDhuPct', group: 'Targets', label: 'Quality scores zero at DHU', min: 1, max: 50, step: 0.5, unit: '%' },
  { path: 'targets.deliveryGraceDays', group: 'Targets', label: 'Delivery grace', min: 0, max: 30, unit: 'days' },
  { path: 'targets.dueSoonDays', group: 'Targets', label: 'Orders due within (watch window)', min: 1, max: 90, unit: 'days' },
  { path: 'bands.good', group: 'Score colours', label: 'Healthy from', min: 50, max: 100 },
  { path: 'bands.watch', group: 'Score colours', label: 'Watch from', min: 0, max: 99 },
  { path: 'alerts.highRejectionDhuPct', group: 'Alerts', label: 'High rejection above DHU', min: 0.5, max: 50, step: 0.5, unit: '%' },
  { path: 'alerts.behindPlanPct', group: 'Alerts', label: 'Behind plan when behind target pace by', min: 5, max: 80, unit: '%' },
  { path: 'alerts.bottleneckBehindPct', group: 'Alerts', label: 'Bottleneck when behind target pace by', min: 10, max: 95, unit: '%' },
  { path: 'alerts.bottleneckEfficiencyPct', group: 'Alerts', label: 'Bottleneck when efficiency below', min: 10, max: 100, unit: '%' },
  { path: 'alerts.bottleneckWipPcs', group: 'Alerts', label: 'Bottleneck when pieces waiting exceed', min: 50, max: 20000, step: 50 },
  { path: 'alerts.relaxationWarnHours', group: 'Alerts', label: 'Flag fabric still relaxing for more than', min: 1, max: 72, unit: 'h' },
  { path: 'achievements.productionChampionPct', group: 'Achievements', label: 'Production Champion: line at or above target pace', min: 50, max: 200, unit: '%' },
  { path: 'achievements.fastestLineMinEfficiencyPct', group: 'Achievements', label: 'Fastest Line: efficiency at least', min: 10, max: 150, unit: '%' },
  { path: 'achievements.qualityChampionMaxDhuPct', group: 'Achievements', label: 'Quality Champion: DHU at most', min: 0, max: 20, step: 0.1, unit: '%' },
  { path: 'achievements.qualityMinInspected', group: 'Achievements', label: 'Quality Champion: pieces inspected at least', min: 0, max: 10000, step: 10 },
  { path: 'achievements.packingMasterPieces', group: 'Achievements', label: 'Packing Master: pieces packed today', min: 1, max: 100000, step: 50 },
  { path: 'achievements.onTimeDispatchPct', group: 'Achievements', label: 'On-Time Dispatch: orders on time at least', min: 50, max: 100, unit: '%' },
  { path: 'achievements.zeroWasteReCutPct', group: 'Achievements', label: 'Zero Material Waste: re-cut at most', min: 0, max: 10, step: 0.1, unit: '%' },
  { path: 'achievements.factoryExcellenceScore', group: 'Achievements', label: 'Factory Excellence: health at least', min: 50, max: 100 },
];

export const getAt = (object, path) => path.split('.').reduce((o, key) => (o == null ? undefined : o[key]), object);

const setAt = (object, path, value) => {
  const keys = path.split('.');
  let node = object;
  keys.slice(0, -1).forEach((key) => {
    node[key] = { ...(node[key] || {}) };
    node = node[key];
  });
  node[keys[keys.length - 1]] = value;
};

/** Defaults overlaid with the saved document, each field clamped; unknown keys are dropped. */
export const mergeRules = (saved) => {
  const merged = JSON.parse(JSON.stringify(DEFAULT_RULES));
  RULE_FIELDS.forEach(({ path, min, max }) => {
    const raw = getAt(saved, path);
    if (raw == null || raw === '' || !Number.isFinite(Number(raw))) return;
    setAt(merged, path, clamp(num(raw), min, max));
  });
  if (merged.bands.watch >= merged.bands.good) merged.bands.watch = Math.max(0, merged.bands.good - 1);
  return merged;
};

/** The document to save: only the editable fields, so the server never stores anything else. */
export const toSavedRules = (rules) => {
  const out = { schemaVersion: RULES_SCHEMA_VERSION };
  RULE_FIELDS.forEach(({ path }) => setAt(out, path, getAt(rules, path)));
  return out;
};
