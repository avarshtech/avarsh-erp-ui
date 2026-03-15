/**
 * Order Entry Constants
 */

// ==================== ORDER STATUS ====================

export const ORDER_STATUS = {
  DRAFT:         'DRAFT',
  CONFIRMED:     'CONFIRMED',
  REFERRED_BACK: 'REFERRED_BACK',
  IN_PRODUCTION: 'IN_PRODUCTION',
  COMPLETED:     'COMPLETED',
  CANCELLED:     'CANCELLED',
};

const STATUS_LABELS = {
  [ORDER_STATUS.DRAFT]:         'Draft',
  [ORDER_STATUS.CONFIRMED]:     'Confirmed',
  [ORDER_STATUS.REFERRED_BACK]: 'Referred Back',
  [ORDER_STATUS.IN_PRODUCTION]: 'In Production',
  [ORDER_STATUS.COMPLETED]:     'Completed',
  [ORDER_STATUS.CANCELLED]:     'Cancelled',
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
