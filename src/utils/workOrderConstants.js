/**
 * Work Order (Sewing PO) Constants
 */

// ==================== STATUS ====================

export const WORK_ORDER_STATUS = {
  DRAFT:            'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED:         'APPROVED',
  CANCELLED:        'CANCELLED',
};

const STATUS_LABELS = {
  [WORK_ORDER_STATUS.DRAFT]:            'Draft',
  [WORK_ORDER_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [WORK_ORDER_STATUS.APPROVED]:         'Approved',
  [WORK_ORDER_STATUS.CANCELLED]:        'Cancelled',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

const STATUS_COLORS = {
  [WORK_ORDER_STATUS.DRAFT]:            'default',
  [WORK_ORDER_STATUS.PENDING_APPROVAL]: 'processing',
  [WORK_ORDER_STATUS.APPROVED]:         'success',
  [WORK_ORDER_STATUS.CANCELLED]:        'default',
};

export const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

// Statuses that allow editing
export const EDITABLE_STATUSES = [WORK_ORDER_STATUS.DRAFT];

// Statuses that allow deletion
export const DELETABLE_STATUSES = [WORK_ORDER_STATUS.DRAFT];

// Statuses that allow submission for approval
export const SUBMITTABLE_STATUSES = [WORK_ORDER_STATUS.DRAFT];

// ==================== PROCESSING UNIT TYPE ====================

export const PROCESSING_UNIT_TYPE = {
  UNIT:   'UNIT',
  VENDOR: 'VENDOR',
};

export const PROCESSING_UNIT_TYPE_OPTIONS = [
  { value: PROCESSING_UNIT_TYPE.UNIT,   label: 'In-house Unit' },
  { value: PROCESSING_UNIT_TYPE.VENDOR, label: 'External Vendor' },
];

// ==================== STATUS FILTER OPTIONS ====================

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));
