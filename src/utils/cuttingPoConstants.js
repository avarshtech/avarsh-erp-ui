/**
 * Cutting PO Constants
 */

export const CUTTING_PO_STATUS = {
  DRAFT:            'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED:         'APPROVED',
  CANCELLED:        'CANCELLED',
};

const STATUS_LABELS = {
  [CUTTING_PO_STATUS.DRAFT]:            'Draft',
  [CUTTING_PO_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [CUTTING_PO_STATUS.APPROVED]:         'Approved',
  [CUTTING_PO_STATUS.CANCELLED]:        'Cancelled',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

const STATUS_COLORS = {
  [CUTTING_PO_STATUS.DRAFT]:            'default',
  [CUTTING_PO_STATUS.PENDING_APPROVAL]: 'processing',
  [CUTTING_PO_STATUS.APPROVED]:         'success',
  [CUTTING_PO_STATUS.CANCELLED]:        'default',
};

export const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

export const EDITABLE_STATUSES = [CUTTING_PO_STATUS.DRAFT];
export const DELETABLE_STATUSES = [CUTTING_PO_STATUS.DRAFT];
export const SUBMITTABLE_STATUSES = [CUTTING_PO_STATUS.DRAFT];

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));
