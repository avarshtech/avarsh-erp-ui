/**
 * PO Status Constants
 * Centralized status configuration for Purchase Orders and Line Items.
 *
 * DB enum values use underscores (e.g. "Pending_Approval").
 * Display labels replace underscores with spaces.
 *
 * PO Status Flow:
 *  Draft → Pending_Approval → Approved (alias Sent_To_Supplier) → Completed
 *                           ↘ Rejected
 *                           ↘ Cancelled
 *                           ↘ Referred_Back → (edit & resubmit)
 *  Sent_To_Supplier → Partially_Received (when some line items completed)
 *  Partially_Received → Completed (when all line items completed)
 */

// ==================== PO STATUS ENUM VALUES ====================
export const PO_STATUS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending_Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_PROGRESS: 'InProgress',
  CANCELLED: 'Cancelled',
  REFERRED_BACK: 'Referred_Back',
  PARTIALLY_RECEIVED: 'Partially_Received',
  SENT_TO_SUPPLIER: 'Sent_To_Supplier',
  COMPLETED: 'Completed',
};

// ==================== LINE ITEM STATUS ENUM VALUES ====================
export const LINE_ITEM_STATUS = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'InProgress',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

// ==================== DISPLAY LABEL MAP ====================
// Converts DB enum values to user-friendly labels (replace "_" with spaces)
export const STATUS_LABELS = {
  [PO_STATUS.DRAFT]: 'Draft',
  [PO_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [PO_STATUS.APPROVED]: 'Approved',
  [PO_STATUS.REJECTED]: 'Rejected',
  [PO_STATUS.IN_PROGRESS]: 'In Progress',
  [PO_STATUS.CANCELLED]: 'Cancelled',
  [PO_STATUS.REFERRED_BACK]: 'Referred Back',
  [PO_STATUS.PARTIALLY_RECEIVED]: 'Partially Received',
  [PO_STATUS.SENT_TO_SUPPLIER]: 'Sent To Supplier',
  [PO_STATUS.COMPLETED]: 'Completed',
};

// ==================== LINE ITEM STATUS LABELS ====================
export const LINE_ITEM_STATUS_LABELS = {
  [LINE_ITEM_STATUS.DRAFT]: 'Draft',
  [LINE_ITEM_STATUS.IN_PROGRESS]: 'In Progress',
  [LINE_ITEM_STATUS.CANCELLED]: 'Cancelled',
  [LINE_ITEM_STATUS.COMPLETED]: 'Completed',
};

/**
 * Get display label for any status string.
 * Falls back to replacing underscores with spaces if not found in map.
 */
export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

/**
 * Get display label for line item status.
 */
export const getLineItemStatusLabel = (status) => {
  if (!status) return '';
  return LINE_ITEM_STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

// ==================== PO TYPE (BOM-PO INTEGRATION) ====================
export const PO_TYPE = {
  GENERAL: 'General',
  REGULAR: 'Regular',
  COMBINED: 'Combined',
};

export const PO_TYPE_OPTIONS = [
  { value: PO_TYPE.GENERAL, label: 'General' },
  { value: PO_TYPE.REGULAR, label: 'Regular' },
  { value: PO_TYPE.COMBINED, label: 'Combined' },
];

// ==================== E-WAY BILL ====================
export const EWAY_BILL_STATUS = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
};

/** E-way bill required when PO value strictly exceeds this amount (use > not >=) per GST Rule 138 */
export const EWAY_BILL_THRESHOLD = 50000;

export const EWAY_BILL_CANCEL_REASONS = [
  { value: 1, label: 'Duplicate' },
  { value: 2, label: 'Order Cancelled' },
  { value: 3, label: 'Data Entry Mistake' },
  { value: 4, label: 'Others' },
];

/** PO statuses that should UNLOCK BOM lines (isPoGenerated = false) */
export const BOM_UNLOCK_STATUSES = [
  PO_STATUS.DRAFT,
  PO_STATUS.REJECTED,
  PO_STATUS.CANCELLED,
  PO_STATUS.REFERRED_BACK,
];

export default {
  PO_STATUS,
  LINE_ITEM_STATUS,
  STATUS_LABELS,
  LINE_ITEM_STATUS_LABELS,
  getStatusLabel,
  getLineItemStatusLabel,
  PO_TYPE,
  PO_TYPE_OPTIONS,
  BOM_UNLOCK_STATUSES,
  EWAY_BILL_STATUS,
  EWAY_BILL_THRESHOLD,
  EWAY_BILL_CANCEL_REASONS,
};
