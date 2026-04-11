/**
 * Sewing Production Module Constants
 * Statuses, labels, colors for all sewing sub-modules
 */

// ─── Sewing Line ─────────────────────────────────────────────────────────────

export const LINE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export const getLineStatusLabel = (s) => ({ ACTIVE: 'Active', INACTIVE: 'Inactive' }[s] || s || '');
export const getLineStatusColor = (s) => ({ ACTIVE: 'success', INACTIVE: 'default' }[s] || 'default');

export const LINE_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

// ─── Sewing Operator ─────────────────────────────────────────────────────────

export const OPERATOR_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
};

export const getOperatorStatusLabel = (s) => ({
  ACTIVE: 'Active', ON_LEAVE: 'On Leave', TERMINATED: 'Terminated',
}[s] || s || '');

export const getOperatorStatusColor = (s) => ({
  ACTIVE: 'success', ON_LEAVE: 'warning', TERMINATED: 'default',
}[s] || 'default');

// ─── Sewing Production Plan ──────────────────────────────────────────────────

export const SEW_PLAN_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
};

const SEW_PLAN_LABELS = {
  [SEW_PLAN_STATUS.DRAFT]: 'Draft',
  [SEW_PLAN_STATUS.APPROVED]: 'Approved',
  [SEW_PLAN_STATUS.IN_PROGRESS]: 'In Progress',
  [SEW_PLAN_STATUS.COMPLETED]: 'Completed',
  [SEW_PLAN_STATUS.ON_HOLD]: 'On Hold',
  [SEW_PLAN_STATUS.CANCELLED]: 'Cancelled',
};

const SEW_PLAN_COLORS = {
  [SEW_PLAN_STATUS.DRAFT]: 'default',
  [SEW_PLAN_STATUS.APPROVED]: 'success',
  [SEW_PLAN_STATUS.IN_PROGRESS]: 'warning',
  [SEW_PLAN_STATUS.COMPLETED]: 'success',
  [SEW_PLAN_STATUS.ON_HOLD]: 'error',
  [SEW_PLAN_STATUS.CANCELLED]: 'default',
};

export const getSewPlanLabel = (s) => SEW_PLAN_LABELS[s] || s?.replace(/_/g, ' ') || '';
export const getSewPlanColor = (s) => SEW_PLAN_COLORS[s] || 'default';

export const SEW_PLAN_EDITABLE = [SEW_PLAN_STATUS.DRAFT];
export const SEW_PLAN_DELETABLE = [SEW_PLAN_STATUS.DRAFT];
export const SEW_PLAN_STATUS_OPTIONS = Object.entries(SEW_PLAN_LABELS).map(([value, label]) => ({ value, label }));

// ─── Hourly Production ───────────────────────────────────────────────────────

export const HOURLY_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
};

export const getHourlyStatusLabel = (s) => ({
  IN_PROGRESS: 'In Progress', SUBMITTED: 'Submitted', APPROVED: 'Approved',
}[s] || s || '');

export const getHourlyStatusColor = (s) => ({
  IN_PROGRESS: 'warning', SUBMITTED: 'processing', APPROVED: 'success',
}[s] || 'default');

export const SHIFT_OPTIONS = [
  { value: 'DAY', label: 'Day' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'OVERTIME', label: 'Overtime' },
];

// ─── Garment Issue ───────────────────────────────────────────────────────────

export const GARMENT_ISSUE_STATUS = {
  ISSUED: 'ISSUED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RETURNED_PARTIAL: 'RETURNED_PARTIAL',
};

export const getGarmentIssueLabel = (s) => ({
  ISSUED: 'Issued', ACKNOWLEDGED: 'Acknowledged', RETURNED_PARTIAL: 'Partial Return',
}[s] || s || '');

export const getGarmentIssueColor = (s) => ({
  ISSUED: 'processing', ACKNOWLEDGED: 'success', RETURNED_PARTIAL: 'warning',
}[s] || 'default');

// ─── Trim Verification ──────────────────────────────────────────────────────

export const TRIM_STATUS = {
  PENDING: 'PENDING',
  ALL_CLEAR: 'ALL_CLEAR',
  ISSUES_FOUND: 'ISSUES_FOUND',
};

export const getTrimStatusLabel = (s) => ({
  PENDING: 'Pending', ALL_CLEAR: 'All Clear', ISSUES_FOUND: 'Issues Found',
}[s] || s || '');

export const getTrimStatusColor = (s) => ({
  PENDING: 'default', ALL_CLEAR: 'success', ISSUES_FOUND: 'error',
}[s] || 'default');

export const TRIM_CHECK_TYPES = [
  { value: 'SIZE_SET', label: 'Size Set' },
  { value: 'IN_LINE', label: 'In-Line' },
  { value: 'PILOT_RUN', label: 'Pilot Run' },
];

export const TRIM_ITEM_STATUS = [
  { value: 'ACTUAL', label: 'Actual' },
  { value: 'ALTERNATE', label: 'Alternate' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'NOT_APPLICABLE', label: 'N/A' },
];

// ─── Measurement Report ─────────────────────────────────────────────────────

export const MEASUREMENT_RESULT = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  NOT_APPROVED: 'NOT_APPROVED',
  CONDITIONAL: 'CONDITIONAL',
};

export const getMeasurementResultLabel = (s) => ({
  PENDING: 'Pending', APPROVED: 'Approved', NOT_APPROVED: 'Not Approved', CONDITIONAL: 'Conditional',
}[s] || s || '');

export const getMeasurementResultColor = (s) => ({
  PENDING: 'default', APPROVED: 'success', NOT_APPROVED: 'error', CONDITIONAL: 'warning',
}[s] || 'default');

export const INSPECTION_STAGES = [
  { value: 'IN_LINE', label: 'In-Line' },
  { value: 'PRE_FINAL', label: 'Pre-Final' },
  { value: 'FINAL', label: 'Final' },
];

// ─── End-line TOPSE ─────────────────────────────────────────────────────────

export const DEFECT_CATEGORIES = [
  { value: 'FABRIC', label: 'Fabric Defects' },
  { value: 'STITCHING', label: 'Stitching Defects' },
  { value: 'CONSTRUCTION', label: 'Construction Defects' },
  { value: 'TRIM_ACCESSORY', label: 'Trim/Accessory Defects' },
  { value: 'APPEARANCE', label: 'Appearance Defects' },
  { value: 'MEASUREMENT', label: 'Measurement Defects' },
];

// ─── Cut Parts Replacement ──────────────────────────────────────────────────

export const REPLACEMENT_STATUS = {
  REQUESTED: 'REQUESTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  REPLACEMENT_CUT: 'REPLACEMENT_CUT',
  DELIVERED: 'DELIVERED',
  CLOSED: 'CLOSED',
};

export const getReplacementLabel = (s) => ({
  REQUESTED: 'Requested', ACKNOWLEDGED: 'Acknowledged',
  REPLACEMENT_CUT: 'Replacement Cut', DELIVERED: 'Delivered', CLOSED: 'Closed',
}[s] || s || '');

export const getReplacementColor = (s) => ({
  REQUESTED: 'processing', ACKNOWLEDGED: 'warning',
  REPLACEMENT_CUT: 'warning', DELIVERED: 'success', CLOSED: 'default',
}[s] || 'default');

export const REPLACEMENT_REASONS = [
  { value: 'FABRIC_DEFECT', label: 'Fabric Defect' },
  { value: 'CUTTING_ERROR', label: 'Cutting Error' },
  { value: 'SHADE_VARIATION', label: 'Shade Variation' },
  { value: 'CONTAMINATION', label: 'Contamination' },
  { value: 'OTHER', label: 'Other' },
];

// ─── Operator Skill Matrix ──────────────────────────────────────────────────

export const SKILL_GRADES = [
  { value: 'A', label: 'A - Expert (>100%)', color: '#52c41a' },
  { value: 'B', label: 'B - Proficient (80-100%)', color: '#73d13d' },
  { value: 'C', label: 'C - Learning (60-80%)', color: '#faad14' },
  { value: 'D', label: 'D - Trainee (<60%)', color: '#ff4d4f' },
];

export const MACHINE_TYPES = [
  { value: 'SNLS', label: 'SNLS' },
  { value: 'DNLS', label: 'DNLS' },
  { value: 'OVERLOCK', label: 'Overlock' },
  { value: 'FLATLOCK', label: 'Flatlock' },
  { value: 'BARTACK', label: 'Bartack' },
  { value: 'KANSAI', label: 'Kansai' },
  { value: 'IRON', label: 'Iron' },
];

// ─── Incentive Calculation ──────────────────────────────────────────────────

export const INCENTIVE_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
};

export const SAM_SOURCE_OPTIONS = [
  { value: 'TIME_STUDY', label: 'Time Study' },
  { value: 'ESTIMATED', label: 'Estimated' },
  { value: 'BUYER_PROVIDED', label: 'Buyer Provided' },
];

// ─── Traffic Light Thresholds ────────────────────────────────────────────────

export const EFFICIENCY_THRESHOLDS = {
  GREEN: 70,   // > 70% = Green
  YELLOW: 50,  // 50-70% = Yellow
  // < 50% = Red
};

export const DHU_THRESHOLD = 5; // > 5% triggers alert
