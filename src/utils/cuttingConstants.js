/**
 * Cutting Production Module Constants
 * Statuses, labels, colors for all cutting sub-modules
 */

// ─── Cut Order Plan ──────────────────────────────────────────────────────────

export const CUT_PLAN_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const CUT_PLAN_LABELS = {
  [CUT_PLAN_STATUS.DRAFT]: 'Draft',
  [CUT_PLAN_STATUS.APPROVED]: 'Approved',
  [CUT_PLAN_STATUS.IN_PROGRESS]: 'In Progress',
  [CUT_PLAN_STATUS.COMPLETED]: 'Completed',
  [CUT_PLAN_STATUS.CANCELLED]: 'Cancelled',
};

const CUT_PLAN_COLORS = {
  [CUT_PLAN_STATUS.DRAFT]: 'default',
  [CUT_PLAN_STATUS.APPROVED]: 'success',
  [CUT_PLAN_STATUS.IN_PROGRESS]: 'warning',
  [CUT_PLAN_STATUS.COMPLETED]: 'success',
  [CUT_PLAN_STATUS.CANCELLED]: 'default',
};

export const getCutPlanStatusLabel = (s) => CUT_PLAN_LABELS[s] || s?.replace(/_/g, ' ') || '';
export const getCutPlanStatusColor = (s) => CUT_PLAN_COLORS[s] || 'default';

export const CUT_PLAN_EDITABLE = [CUT_PLAN_STATUS.DRAFT];
export const CUT_PLAN_DELETABLE = [CUT_PLAN_STATUS.DRAFT];

export const CUT_PLAN_STATUS_OPTIONS = Object.entries(CUT_PLAN_LABELS).map(([value, label]) => ({ value, label }));

// ─── Fabric Receipt ──────────────────────────────────────────────────────────

export const FABRIC_RECEIPT_STATUS = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  VERIFIED: 'VERIFIED',
};

const FABRIC_RECEIPT_LABELS = {
  [FABRIC_RECEIPT_STATUS.PENDING]: 'Pending',
  [FABRIC_RECEIPT_STATUS.RECEIVED]: 'Received',
  [FABRIC_RECEIPT_STATUS.PARTIALLY_RECEIVED]: 'Partial',
  [FABRIC_RECEIPT_STATUS.VERIFIED]: 'Verified',
};

const FABRIC_RECEIPT_COLORS = {
  [FABRIC_RECEIPT_STATUS.PENDING]: 'default',
  [FABRIC_RECEIPT_STATUS.RECEIVED]: 'processing',
  [FABRIC_RECEIPT_STATUS.PARTIALLY_RECEIVED]: 'warning',
  [FABRIC_RECEIPT_STATUS.VERIFIED]: 'success',
};

export const getFabricReceiptLabel = (s) => FABRIC_RECEIPT_LABELS[s] || s?.replace(/_/g, ' ') || '';
export const getFabricReceiptColor = (s) => FABRIC_RECEIPT_COLORS[s] || 'default';

export const FABRIC_RECEIPT_STATUS_OPTIONS = Object.entries(FABRIC_RECEIPT_LABELS).map(([value, label]) => ({ value, label }));

// ─── Fabric Relaxation ───────────────────────────────────────────────────────

export const RELAXATION_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REPORT_GENERATED: 'REPORT_GENERATED',
};

const RELAXATION_LABELS = {
  [RELAXATION_STATUS.IN_PROGRESS]: 'In Progress',
  [RELAXATION_STATUS.COMPLETED]: 'Completed',
  [RELAXATION_STATUS.REPORT_GENERATED]: 'Report Generated',
};

const RELAXATION_COLORS = {
  [RELAXATION_STATUS.IN_PROGRESS]: 'processing',
  [RELAXATION_STATUS.COMPLETED]: 'success',
  [RELAXATION_STATUS.REPORT_GENERATED]: 'success',
};

export const getRelaxationLabel = (s) => RELAXATION_LABELS[s] || s?.replace(/_/g, ' ') || '';
export const getRelaxationColor = (s) => RELAXATION_COLORS[s] || 'default';

// ─── Marker Planning ─────────────────────────────────────────────────────────

export const MARKER_STATUS = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
};

export const getMarkerStatusLabel = (s) => s === 'DRAFT' ? 'Draft' : s === 'APPROVED' ? 'Approved' : s || '';
export const getMarkerStatusColor = (s) => s === 'APPROVED' ? 'success' : 'default';

// ─── Lay Audit ───────────────────────────────────────────────────────────────

export const LAY_AUDIT_STATUS = {
  DRAFT: 'DRAFT',
  AUDITED: 'AUDITED',
  APPROVED: 'APPROVED',
};

export const getLayAuditLabel = (s) => ({ DRAFT: 'Draft', AUDITED: 'Audited', APPROVED: 'Approved' }[s] || s || '');
export const getLayAuditColor = (s) => ({ DRAFT: 'default', AUDITED: 'processing', APPROVED: 'success' }[s] || 'default');

// ─── TMB Check ───────────────────────────────────────────────────────────────

export const TMB_RESULT = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
};

export const getTmbResultLabel = (s) => ({ PENDING: 'Pending', PASSED: 'Passed', FAILED: 'Failed' }[s] || s || '');
export const getTmbResultColor = (s) => ({ PENDING: 'default', PASSED: 'success', FAILED: 'error' }[s] || 'default');

// ─── Cutting Report ──────────────────────────────────────────────────────────

export const CUT_REPORT_STATUS = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

export const getCutReportLabel = (s) => ({ DRAFT: 'Draft', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' }[s] || s || '');
export const getCutReportColor = (s) => ({ DRAFT: 'default', IN_PROGRESS: 'warning', COMPLETED: 'success' }[s] || 'default');

// ─── Bundle Status ───────────────────────────────────────────────────────────

export const BUNDLE_STATUS = {
  CREATED: 'CREATED',
  ISSUED_SEWING: 'ISSUED_SEWING',
  ISSUED_PROCESS: 'ISSUED_PROCESS',
  RECEIVED: 'RECEIVED',
};

export const getBundleStatusLabel = (s) => ({
  CREATED: 'Created', ISSUED_SEWING: 'Issued to Sewing',
  ISSUED_PROCESS: 'Issued to Process', RECEIVED: 'Received',
}[s] || s || '');

export const getBundleStatusColor = (s) => ({
  CREATED: 'default', ISSUED_SEWING: 'processing',
  ISSUED_PROCESS: 'warning', RECEIVED: 'success',
}[s] || 'default');

// ─── Bundle Issue ────────────────────────────────────────────────────────────

export const BUNDLE_ISSUE_STATUS = {
  ISSUED: 'ISSUED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
};

export const getBundleIssueLabel = (s) => ({
  ISSUED: 'Issued', PARTIALLY_RECEIVED: 'Partial', RECEIVED: 'Received',
}[s] || s || '');

export const getBundleIssueColor = (s) => ({
  ISSUED: 'processing', PARTIALLY_RECEIVED: 'warning', RECEIVED: 'success',
}[s] || 'default');

// ─── Panel Issue ─────────────────────────────────────────────────────────────

export const PANEL_ISSUE_STATUS = {
  ISSUED: 'ISSUED',
  PARTIALLY_RETURNED: 'PARTIALLY_RETURNED',
  FULLY_RETURNED: 'FULLY_RETURNED',
};

export const getPanelIssueLabel = (s) => ({
  ISSUED: 'Issued', PARTIALLY_RETURNED: 'Partial Return', FULLY_RETURNED: 'Fully Returned',
}[s] || s || '');

export const getPanelIssueColor = (s) => ({
  ISSUED: 'processing', PARTIALLY_RETURNED: 'warning', FULLY_RETURNED: 'success',
}[s] || 'default');

// ─── Panel Check ─────────────────────────────────────────────────────────────

export const PANEL_CHECK_RESULT = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
};

export const getPanelCheckLabel = (s) => ({
  PENDING: 'Pending', PASSED: 'Passed', FAILED: 'Failed', PARTIAL: 'Partial',
}[s] || s || '');

export const getPanelCheckColor = (s) => ({
  PENDING: 'default', PASSED: 'success', FAILED: 'error', PARTIAL: 'warning',
}[s] || 'default');

// ─── Re-Cut Register ─────────────────────────────────────────────────────────

export const RECUT_STATUS = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

// ─── Wastage Reconciliation ──────────────────────────────────────────────────

export const WASTAGE_STATUS = {
  DRAFT: 'DRAFT',
  RECONCILED: 'RECONCILED',
};

// ─── Shared Constants ────────────────────────────────────────────────────────

export const FABRIC_TYPES = [
  { value: 'SINGLE_JERSEY', label: 'Single Jersey' },
  { value: 'INTERLOCK', label: 'Interlock' },
  { value: 'RIB', label: 'Rib' },
  { value: 'FLEECE', label: 'Fleece' },
  { value: 'FRENCH_TERRY', label: 'French Terry' },
  { value: 'PIQUE', label: 'Pique' },
  { value: 'DENIM', label: 'Denim' },
  { value: 'WOVEN', label: 'Woven' },
  { value: 'OTHER', label: 'Other' },
];

export const PANEL_NAMES = [
  'Front', 'Back', 'Sleeve', 'Collar', 'Cuff', 'Pocket',
  'Placket', 'Hood', 'Yoke', 'Waistband', 'Panel',
];

export const EXTERNAL_PROCESSES = [
  { value: 'EMBROIDERY', label: 'Embroidery' },
  { value: 'PRINTING', label: 'Printing' },
  { value: 'WASHING', label: 'Washing' },
  { value: 'DYEING', label: 'Dyeing' },
  { value: 'PLEATING', label: 'Pleating' },
  { value: 'OTHER', label: 'Other' },
];

export const BUNDLE_SIZE_OPTIONS = [
  { value: 20, label: '20 pcs' },
  { value: 30, label: '30 pcs' },
  { value: 50, label: '50 pcs' },
];

export const TMB_COMMENTS = [
  { value: 'OK', label: 'OK' },
  { value: 'SHORTAGE', label: 'Shortage' },
  { value: 'SHRINKAGE', label: 'Shrinkage' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'MISCUT', label: 'Miscut' },
  { value: 'PATTERN_DRIFT', label: 'Pattern Drift' },
];

export const TMB_CORRECTIVE_ACTIONS = [
  { value: 'RETURN_TO_CUTTING', label: 'Return to Cutting' },
  { value: 'RE_SPREAD', label: 'Re-spread' },
  { value: 'RE_CUT', label: 'Re-cut' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'ACCEPT', label: 'Accept' },
];
