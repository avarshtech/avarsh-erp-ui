/**
 * Sewing module (production execution) constants — Sewing PRD v1.0 +
 * Indian SME garment practice. Mirrors cuttingConstants.js conventions.
 */

export const SEWING_STATUS_COLORS = {
  DRAFT: 'default',
  APPROVED: 'success',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
  RECEIVED: 'success',
  VERIFIED: 'success',
  PARTIALLY_RECEIVED: 'warning',
  DISCREPANCY: 'error',
  ISSUED: 'processing',
  ACKNOWLEDGED: 'success',
  RETURNED_PARTIAL: 'warning',
  ALL_CLEAR: 'success',
  ISSUES_FOUND: 'error',
  PENDING: 'default',
  SUBMITTED: 'processing',
  APPROVED_RESULT: 'success',
  NOT_APPROVED: 'error',
  CONDITIONAL: 'warning',
  REQUESTED: 'processing',
  REPLACEMENT_CUT: 'warning',
  DELIVERED: 'success',
  CLOSED: 'default',
  OPEN: 'error',
  RESOLVED: 'success',
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
};

export const sewingStatusLabel = (s) => String(s || '').replaceAll('_', ' ')
  .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Lines belong to a production unit — Line selects filter by Unit. */
export const UNITS = ['Unit-1 Tirupur', 'Unit-2 Avinashi'];
export const LINES_BY_UNIT = {
  'Unit-1 Tirupur': ['Line-A', 'Line-B'],
  'Unit-2 Avinashi': ['B-1', 'B-2'],
};

export const MACHINE_TYPES = ['SNLS', 'DNLS', 'Overlock', 'Flatlock', 'Bartack', 'Kansai', 'Iron'];

export const HOURS = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'];

/** Traffic light bands per PRD 4.3.4 (line efficiency %). */
export const EFFICIENCY_BANDS = { green: 70, yellow: 50 }; // >=70 green, >=50 yellow, else red

export const trafficLight = (eff) => (eff >= EFFICIENCY_BANDS.green ? 'green' : eff >= EFFICIENCY_BANDS.yellow ? 'yellow' : 'red');

export const TRAFFIC_COLORS = { green: 'var(--success-color)', yellow: 'var(--warning-color)', red: 'var(--error-color)' };

/**
 * Heat-map colour per skill grade. The grades themselves and what they mean are
 * master data (mst_sewing_lookups, SKILL_GRADE); only the colour is presentation
 * and so stays here.
 */
export const SKILL_GRADE_COLORS = {
  A: '#237804',
  B: '#73d13d',
  C: '#faad14',
  D: '#ff4d4f',
};

export const OPERATIONS = ['Shoulder join', 'Neck rib attach', 'Collar attach', 'Sleeve attach', 'Side seam', 'Sleeve hem', 'Bottom hem', 'Label attach', 'Bartack'];


export const DHU_THRESHOLD_PCT = 5;

/**
 * CR-SEW-006 — TOPSE hour slots. Numbered 1-8 for the shift and 9 for overtime,
 * the same numbering the hourly production sheet uses, so a defect hour and an
 * output hour mean the same thing. The DHU bands live in the threshold master.
 */
export const TOPSE_HOUR_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const topseHourLabel = (hour) => (hour > 8 ? 'OT' : `Hr ${hour}`);
export const topseHourOptions = () => TOPSE_HOUR_NUMBERS.map(
  (hour) => ({ value: hour, label: topseHourLabel(hour) }),
);

export const TOPSE_TRAFFIC_META = {
  GREEN: { label: 'Pass', color: 'green' },
  YELLOW: { label: 'Watch', color: 'orange' },
  RED: { label: 'Fail', color: 'red' },
};

/**
 * Pareto bar colour per defect category. The categories themselves are master
 * data (mst_sewing_defect_types); only the colour is presentation.
 */
export const CATEGORY_COLORS = {
  'Fabric Defects': '#722ed1',
  'Stitching Defects': '#fa541c',
  'Construction Defects': '#1677ff',
  'Trim/Accessory Defects': '#13c2c2',
  'Appearance Defects': '#faad14',
  'Measurement Defects': '#eb2f96',
};

/** CR-SEW-005 — binary verification against BOM-driven items. */
export const TRIM_ITEM_STATUSES = ['CORRECT', 'INCORRECT'];
export const ISSUE_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR'];

/** Incentive slabs per PRD 5.3 (configurable; defaults shown in mock). */
export const INCENTIVE_CONFIG = {
  baseEfficiency: 70,
  slabs: [
    { from: 70, to: 80, amount: 50 },
    { from: 80, to: 90, amount: 100 },
    { from: 90, to: 999, amount: 150 },
  ],
  dhuDeductionPct: 20, // if line DHU > threshold
  attendanceBonusWeekly: 200,
  lineBonusPerDay: 50,
};

/** Receipt discrepancy auto-flag threshold per BR 4.2.3. */
export const RECEIPT_DISCREPANCY_PCT = 2;
