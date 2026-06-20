/**
 * Production PO Constants
 * Shared across Cutting PO, Work Order (Sewing PO) and Finishing PO.
 * Status machine (PRD §7.1): DRAFT → PENDING_APPROVAL → APPROVED → CANCELLED,
 * with refer-back (PENDING_APPROVAL → DRAFT) and reject (terminal).
 */

// ==================== STATUS ====================

export const PROD_PO_STATUS = {
  DRAFT:             'DRAFT',
  PENDING_APPROVAL:  'PENDING_APPROVAL',
  APPROVED:          'APPROVED',
  REJECTED:          'REJECTED',
  CANCELLED:         'CANCELLED',
};

const STATUS_LABELS = {
  [PROD_PO_STATUS.DRAFT]:            'Draft',
  [PROD_PO_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [PROD_PO_STATUS.APPROVED]:         'Approved',
  [PROD_PO_STATUS.REJECTED]:         'Rejected',
  [PROD_PO_STATUS.CANCELLED]:        'Cancelled',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

// Status-driven action gating
export const EDITABLE_STATUSES    = [PROD_PO_STATUS.DRAFT];
export const SUBMITTABLE_STATUSES = [PROD_PO_STATUS.DRAFT];
export const APPROVABLE_STATUSES  = [PROD_PO_STATUS.PENDING_APPROVAL];
export const CANCELLABLE_STATUSES = [PROD_PO_STATUS.DRAFT, PROD_PO_STATUS.PENDING_APPROVAL, PROD_PO_STATUS.APPROVED];
export const DELETABLE_STATUSES   = [PROD_PO_STATUS.DRAFT];

// Status-change actions handled by the (mock) server
export const PO_ACTION = {
  SUBMIT:     'SUBMIT',
  APPROVE:    'APPROVE',
  REJECT:     'REJECT',
  REFER_BACK: 'REFER_BACK',
  CANCEL:     'CANCEL',
};

// ==================== PO TYPES ====================

export const PO_TYPE = {
  CUTTING:    'CUTTING',
  WORK_ORDER: 'WORK_ORDER',
  FINISHING:  'FINISHING',
};

// Per-type display + routing metadata (no JSX here — icons live in components).
export const PO_TYPE_META = {
  [PO_TYPE.CUTTING]: {
    key: PO_TYPE.CUTTING,
    label: 'Cutting PO',
    short: 'Cutting',
    stage: 'Cutting',
    prefix: 'CPO',
    noField: 'cuttingPoNo',
    basePath: '/production/cutting-po',
    listPath: '/production/cutting-po/list',
    newPath: '/production/cutting-po/new',
    accent: '#1677ff',
  },
  [PO_TYPE.WORK_ORDER]: {
    key: PO_TYPE.WORK_ORDER,
    label: 'Work Order',
    short: 'Sewing',
    stage: 'Sewing',
    prefix: 'WO',
    noField: 'workOrderNo',
    basePath: '/production/work-order',
    listPath: '/production/work-order/list',
    newPath: '/production/work-order/new',
    accent: '#722ed1',
  },
  [PO_TYPE.FINISHING]: {
    key: PO_TYPE.FINISHING,
    label: 'Finishing PO',
    short: 'Finishing',
    stage: 'Finishing',
    prefix: 'FPO',
    noField: 'finishingPoNo',
    basePath: '/production/finishing-po',
    listPath: '/production/finishing-po/list',
    newPath: '/production/finishing-po/new',
    accent: '#13c2c2',
  },
};

// ==================== PROCESSING UNIT (Unit / Vendor) ====================

export const PROCESSING_UNIT_TYPE = {
  UNIT:   'UNIT',
  VENDOR: 'VENDOR',
};

export const PROCESSING_UNIT_OPTIONS = [
  { value: PROCESSING_UNIT_TYPE.UNIT,   label: 'In-house Unit' },
  { value: PROCESSING_UNIT_TYPE.VENDOR, label: 'Outsource Vendor' },
];

// ==================== FINISHING PROCESSES ====================

export const FINISHING_PROCESS = {
  TRIMMING: 'TRIMMING',
  CHECKING: 'CHECKING',
  IRONING:  'IRONING',
  PACKING:  'PACKING',
};

// Ordered list (PRD §6.1). Sequence is fixed.
export const FINISHING_PROCESSES = [
  { key: FINISHING_PROCESS.TRIMMING, label: 'Trimming', sequence: 1, description: 'Remove loose threads, stray yarns and excess material.' },
  { key: FINISHING_PROCESS.CHECKING, label: 'Checking', sequence: 2, description: 'Visual + measurement QC of each garment vs. tech pack.' },
  { key: FINISHING_PROCESS.IRONING,  label: 'Ironing',  sequence: 3, description: 'Press / steam to remove wrinkles and achieve finish.' },
  { key: FINISHING_PROCESS.PACKING,  label: 'Packing',  sequence: 4, description: 'Fold, tag, poly-bag and carton packing.' },
];

export const getProcessLabel = (key) =>
  FINISHING_PROCESSES.find((p) => p.key === key)?.label || key;

// ==================== PP SAMPLE GATE ====================

export const PP_SAMPLE_STATUS = {
  COMPLETED: 'COMPLETED',
  PENDING:   'PENDING',
  REVOKED:   'REVOKED', // approved earlier, later revoked → compliance flag (PRD §3.2)
};

export const isPpApproved = (status) => status === PP_SAMPLE_STATUS.COMPLETED;
export const isPpRevoked = (status) => status === PP_SAMPLE_STATUS.REVOKED;

// ==================== CONSUMPTION VARIANCE ====================
// PRD §4.3: Green ≤ ±2%, Yellow 2–5%, Red > 5%.

export const VARIANCE_THRESHOLD = { GREEN: 2, YELLOW: 5 };

export const getVarianceStatus = (variancePercent) => {
  const abs = Math.abs(Number(variancePercent) || 0);
  if (abs <= VARIANCE_THRESHOLD.GREEN) return { level: 'green',  tagColor: 'green',  textColor: '#389e0d', label: 'Within tolerance' };
  if (abs <= VARIANCE_THRESHOLD.YELLOW) return { level: 'yellow', tagColor: 'gold',   textColor: '#d48806', label: 'Review needed' };
  return { level: 'red', tagColor: 'red', textColor: '#cf1322', label: 'Escalation required' };
};

// ==================== CALC HELPERS ====================

// PRD §3.3: Planned Qty = Order Qty + (Order Qty × Allowance %).
export const computePlannedQty = (orderQty, allowancePercent) =>
  Math.ceil((Number(orderQty) || 0) * (1 + (Number(allowancePercent) || 0) / 100));

// PRD §4.1: variance % = ((CAD − BOM) / BOM) × 100.
export const computeVariancePercent = (cadPerPc, bomPerPc) => {
  const bom = Number(bomPerPc) || 0;
  if (!bom) return 0;
  return (((Number(cadPerPc) || 0) - bom) / bom) * 100;
};
