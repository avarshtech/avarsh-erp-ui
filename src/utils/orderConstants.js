/**
 * Order Entry Constants
 */

// ==================== ORDER STATUS ====================

export const ORDER_STATUS = {
  DRAFT:                 'DRAFT',
  CONFIRMED:             'CONFIRMED',
  REFER_BACK_REQUESTED:  'REFER_BACK_REQUESTED',
  REFERRED_BACK:         'REFERRED_BACK',
  CANCEL_REQUESTED:      'CANCEL_REQUESTED',
  IN_PRODUCTION:         'IN_PRODUCTION',
  COMPLETED:             'COMPLETED',
  CANCELLED:             'CANCELLED',
};

const STATUS_LABELS = {
  [ORDER_STATUS.DRAFT]:                 'Draft',
  [ORDER_STATUS.CONFIRMED]:             'Confirmed',
  [ORDER_STATUS.REFER_BACK_REQUESTED]:  'Refer Back Requested',
  [ORDER_STATUS.REFERRED_BACK]:         'Referred Back',
  [ORDER_STATUS.CANCEL_REQUESTED]:      'Cancel Requested',
  [ORDER_STATUS.IN_PRODUCTION]:         'In Production',
  [ORDER_STATUS.COMPLETED]:             'Completed',
  [ORDER_STATUS.CANCELLED]:             'Cancelled',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

// Statuses that allow editing the order
export const EDITABLE_STATUSES = [ORDER_STATUS.DRAFT, ORDER_STATUS.REFERRED_BACK];

// Statuses that allow deletion
export const DELETABLE_STATUSES = [ORDER_STATUS.DRAFT];

// Statuses where refer-back and cancel are allowed
export const ACTIONABLE_STATUSES = [ORDER_STATUS.CONFIRMED];

// ==================== DROPDOWN DATA ====================

export const COMPONENT_OPTIONS = [
  { value: 'Single',   label: 'Single' },
  { value: 'Multiple', label: 'Multiple' },
];

// ==================== CURRENCY SYMBOL HELPER ====================

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || currency || '';

// ==================== DISPATCH DELAY HELPERS ====================

/**
 * An upstream slip — a supplier PO's delivery date re-agreed, or a sample request delayed —
 * is held once on the order as `dispatchDelayDays` + `dispatchDelaySource`, and the API
 * derives every line's `revisedDispatchDate` from it. The committed `dispatchDate` on a line
 * never changes, so the original always stays visible beside the date now being tracked to.
 */
export const hasDispatchDelay = (order) => (order?.dispatchDelayDays || 0) > 0;

/** The line dispatching first — the one a list column stands for. Dates are ISO strings, so they sort as text. */
export const getEarliestDispatchLine = (order) =>
  (order?.orderLines || [])
    .filter((l) => l?.dispatchDate)
    .sort((a, b) => (a.dispatchDate < b.dispatchDate ? -1 : a.dispatchDate > b.dispatchDate ? 1 : 0))[0] || null;
