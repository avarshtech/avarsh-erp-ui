/**
 * Order Entry Constants
 * Status configuration, dropdown data, and size presets for the Orders module.
 *
 * Order Status Flow:
 *  Draft → Confirmed (auto-approved on Submit)
 *  Confirmed → Referred_Back (via Refer Back)
 *  Referred_Back → Confirmed (via Resubmit)
 *  Confirmed → In_Production → Completed (future use)
 *  Any non-Completed → Cancelled (future use)
 */

// ==================== ORDER STATUS ====================

export const ORDER_STATUS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  REFERRED_BACK: 'Referred_Back',
  IN_PRODUCTION: 'In_Production',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_LABELS = {
  [ORDER_STATUS.DRAFT]: 'Draft',
  [ORDER_STATUS.CONFIRMED]: 'Confirmed',
  [ORDER_STATUS.REFERRED_BACK]: 'Referred Back',
  [ORDER_STATUS.IN_PRODUCTION]: 'In Production',
  [ORDER_STATUS.COMPLETED]: 'Completed',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

// Statuses that allow editing the order
export const EDITABLE_STATUSES = [ORDER_STATUS.DRAFT, ORDER_STATUS.REFERRED_BACK];

// Statuses that allow deletion
export const DELETABLE_STATUSES = [ORDER_STATUS.DRAFT];

// ==================== DROPDOWN DATA ====================

export const COMPONENT_OPTIONS = [
  { value: 'Single', label: 'Single' },
  { value: 'Multiple', label: 'Multiple' },
];

export const PAYMENT_TERMS = [
  { value: 'DA', label: 'DA (Documents Against Acceptance)' },
  { value: 'DP', label: 'DP (Documents Against Payment)' },
  { value: 'LC', label: 'LC (Letter of Credit)' },
  { value: 'Days Nett', label: 'Days Nett' },
];

// ==================== SIZE PRESETS ====================

export const SIZE_PRESETS = {
  KIDS_NUMERIC: {
    label: 'Kids Numeric',
    sizes: ['2/3Y', '3/4Y', '4/5Y', '5/6Y', '6/7Y', '7/8Y', '8/9Y', '9/10Y', '10/11Y', '11/12Y', '13/14Y', '15/16Y'],
  },
  ALPHA: {
    label: 'Alpha (XS–3XL)',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  WAIST: {
    label: 'Waist (28–42)',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
  },
  BABY: {
    label: 'Baby (0-3m–36m)',
    sizes: ['0-3m', '3-6m', '6-9m', '9-12m', '12-18m', '18-24m', '24-36m'],
  },
  CUSTOM: {
    label: 'Custom',
    sizes: [],
  },
};

// ==================== ORDER NUMBER GENERATOR ====================

let orderCounter = 1002; // Starting after seed data

/**
 * Generate order number in format SG/YY-YY/N
 * YY-YY is the financial year (April–March)
 */
export const generateOrderNumber = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear() % 100;
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const num = String(orderCounter++);
  return `SG/${String(fyStart).padStart(2, '0')}-${String(fyEnd).padStart(2, '0')}/${num}`;
};

// ==================== CURRENCY SYMBOL HELPER ====================

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || currency || '$';
