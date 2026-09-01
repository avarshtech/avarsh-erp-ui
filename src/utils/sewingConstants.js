/**
 * Sewing module presentation constants.
 *
 * Everything the floor can configure — lines, machine types, operations, defect
 * types, check types, damage reasons, efficiency and DHU bands, incentive slabs
 * — is master data and comes from the API. What is left here is presentation:
 * colours, labels and the hour numbering the screens share.
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

/** Hourly sheet columns — the eight worked hours as they are stored. */
export const HOURS = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'];

/** Line-efficiency traffic light colours; the bands themselves are master data. */
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
