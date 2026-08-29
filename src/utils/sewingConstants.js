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

export const SEWING_LINES = ['Line-A', 'Line-B', 'B-1', 'B-2'];

export const MACHINE_TYPES = ['SNLS', 'DNLS', 'Overlock', 'Flatlock', 'Bartack', 'Kansai', 'Iron'];

export const SHIFTS = ['DAY', 'NIGHT', 'OVERTIME'];

export const HOURS = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'];

/** Traffic light bands per PRD 4.3.4 (line efficiency %). */
export const EFFICIENCY_BANDS = { green: 70, yellow: 50 }; // >=70 green, >=50 yellow, else red

export const trafficLight = (eff) => (eff >= EFFICIENCY_BANDS.green ? 'green' : eff >= EFFICIENCY_BANDS.yellow ? 'yellow' : 'red');

export const TRAFFIC_COLORS = { green: 'var(--success-color)', yellow: 'var(--warning-color)', red: 'var(--error-color)' };

/** Skill grades per PRD 5.1 with heat-map colors. */
export const SKILL_GRADES = [
  { grade: 'A', label: 'Expert (>100%)', color: '#237804' },
  { grade: 'B', label: 'Proficient (80-100%)', color: '#73d13d' },
  { grade: 'C', label: 'Learning (60-80%)', color: '#faad14' },
  { grade: 'D', label: 'Trainee (<60%)', color: '#ff4d4f' },
];

export const OPERATIONS = ['Shoulder join', 'Neck rib attach', 'Collar attach', 'Sleeve attach', 'Side seam', 'Sleeve hem', 'Bottom hem', 'Label attach', 'Bartack'];

/** TOPSE defect categories per PRD 4.7.2. */
export const DEFECT_CATEGORIES = {
  'Fabric Defects': ['Fabric hole', 'Stain', 'Shade variation', 'Slub'],
  'Stitching Defects': ['Broken stitch', 'Skip stitch', 'Uneven SPI', 'Loose tension', 'Open seam', 'Raw edge'],
  'Construction Defects': ['Puckering', 'High-low', 'Uneven seam', 'Pleat', 'Needle hole'],
  'Trim/Accessory Defects': ['Insecure button/snap', 'Missing operation', 'Label misplacement'],
  'Appearance Defects': ['Dirt mark', 'Oil stain', 'Sticker', 'Uncut thread'],
  'Measurement Defects': ['Out of tolerance'],
};

export const DHU_THRESHOLD_PCT = 5;

/** CR-SEW-006 — TOPSE hour slots + traffic-light thresholds (configurable per buyer). */
export const TOPSE_HOURS = ['Hr 1', 'Hr 2', 'Hr 3', 'Hr 4', 'Hr 5', 'Hr 6', 'Hr 7', 'Hr 8', 'OT'];
export const TOPSE_TRAFFIC = { greenMax: 3, yellowMax: 5 }; // GREEN ≤3, YELLOW 3–5, RED >5
export const topseTraffic = (dhu) => (dhu <= TOPSE_TRAFFIC.greenMax ? 'GREEN' : dhu <= TOPSE_TRAFFIC.yellowMax ? 'YELLOW' : 'RED');
export const TOPSE_TRAFFIC_META = {
  GREEN: { label: 'Pass', color: 'green' },
  YELLOW: { label: 'Watch', color: 'orange' },
  RED: { label: 'Fail', color: 'red' },
};

/** CR-SEW-005 — binary verification against BOM-driven items. */
export const TRIM_ITEM_STATUSES = ['CORRECT', 'INCORRECT'];
export const BOM_ITEM_CATEGORIES = ['Fabric & Materials', 'Trims & Accessories', 'Approvals & Tests'];
export const CHECK_TYPES = ['SIZE_SET', 'IN_LINE', 'PILOT_RUN'];

export const MEASUREMENT_STAGES = ['IN_LINE', 'PRE_FINAL', 'FINAL'];

export const DAMAGE_REASONS = ['FABRIC_DEFECT', 'CUTTING_ERROR', 'SHADE_VARIATION', 'CONTAMINATION', 'OTHER'];

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
