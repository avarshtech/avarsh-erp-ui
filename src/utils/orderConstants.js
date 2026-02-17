/**
 * Order Entry Constants
 * Centralized status configuration, dropdown data, and size presets for Order Entry module.
 *
 * Order Status Flow:
 *  Draft → Confirmed (auto-approved on Submit)
 *  Confirmed → Referred_Back (via Refer Back)
 *  Referred_Back → Confirmed (via Resubmit)
 *  Confirmed → In_Production → Completed (future use)
 *  Any non-Completed → Cancelled (future use)
 */

// ==================== ORDER STATUS ENUM VALUES ====================
export const ORDER_STATUS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  REFERRED_BACK: 'Referred_Back',
  IN_PRODUCTION: 'In_Production',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

// ==================== DISPLAY LABEL MAP ====================
export const STATUS_LABELS = {
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

// ==================== STATUS FLOW ====================
export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.REFERRED_BACK, ORDER_STATUS.IN_PRODUCTION, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.REFERRED_BACK]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PRODUCTION]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

// Statuses that allow editing the order
export const EDITABLE_STATUSES = [ORDER_STATUS.DRAFT, ORDER_STATUS.REFERRED_BACK];

// Statuses that allow deletion
export const DELETABLE_STATUSES = [ORDER_STATUS.DRAFT];

// ==================== STATIC DROPDOWN DATA ====================

export const BUYERS = [
  { value: 1, label: 'H&M' },
  { value: 2, label: 'Zara' },
  { value: 3, label: 'Primark' },
  { value: 4, label: 'Next' },
  { value: 5, label: 'Marks & Spencer' },
  { value: 6, label: 'C&A' },
  { value: 7, label: 'Van Gennip Textiles B.V.' },
  { value: 8, label: 'Target' },
];

export const ITEM_GROUPS = [
  { value: 'Blouses', label: 'Blouses' },
  { value: 'Dresses', label: 'Dresses' },
  { value: 'T-Shirts', label: 'T-Shirts' },
  { value: 'Trousers', label: 'Trousers' },
  { value: '2-pcs/Sets', label: '2-pcs / Sets' },
  { value: 'Shorts', label: 'Shorts' },
  { value: 'Jackets', label: 'Jackets' },
  { value: 'Skirts', label: 'Skirts' },
  { value: 'Polo', label: 'Polo Shirts' },
  { value: 'Sweatshirts', label: 'Sweatshirts' },
];

export const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'INR', label: 'INR - Indian Rupee' },
];

export const SHIPMENT_MODES = [
  { value: 'Sea', label: 'Sea' },
  { value: 'Air', label: 'Air' },
];

export const DELIVERY_TERMS = [
  { value: 'FOB', label: 'FOB' },
  { value: 'CNF', label: 'CNF' },
  { value: 'CIF', label: 'CIF' },
  { value: 'Ex-Works', label: 'Ex-Works' },
];

export const PAYMENT_TERMS = [
  { value: 'DA', label: 'DA (Documents Against Acceptance)' },
  { value: 'DP', label: 'DP (Documents Against Payment)' },
  { value: 'LC', label: 'LC (Letter of Credit)' },
  { value: 'Days Nett', label: 'Days Nett' },
];

export const PAYMENT_DAYS_OPTIONS = [
  { value: 30, label: '30 Days' },
  { value: 45, label: '45 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
  { value: 120, label: '120 Days' },
];

export const FABRIC_TYPES = [
  { value: '100% Cotton', label: '100% Cotton' },
  { value: '100% Polyester', label: '100% Polyester' },
  { value: 'Cotton/Polyester Blend', label: 'Cotton/Polyester Blend' },
  { value: '100% Linen', label: '100% Linen' },
  { value: 'Cotton/Linen Blend', label: 'Cotton/Linen Blend' },
  { value: '100% Viscose', label: '100% Viscose' },
  { value: 'Cotton/Spandex', label: 'Cotton/Spandex' },
  { value: 'Polyester/Spandex', label: 'Polyester/Spandex' },
  { value: 'Cotton/Nylon', label: 'Cotton/Nylon' },
  { value: 'Tencel', label: 'Tencel' },
];

export const MATERIAL_TYPES = [
  { value: 'Woven', label: 'Woven' },
  { value: 'Knit', label: 'Knit' },
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
 * Generate order number in format SG/YY-YY/XXXX
 * YY-YY is the financial year (April–March)
 */
export const generateOrderNumber = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear() % 100;
  // Financial year: April (month 3) to March
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const num = String(orderCounter++).padStart(4, '0');
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

export default {
  ORDER_STATUS,
  STATUS_LABELS,
  getStatusLabel,
  STATUS_TRANSITIONS,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  BUYERS,
  ITEM_GROUPS,
  CURRENCIES,
  SHIPMENT_MODES,
  DELIVERY_TERMS,
  PAYMENT_TERMS,
  PAYMENT_DAYS_OPTIONS,
  FABRIC_TYPES,
  MATERIAL_TYPES,
  SIZE_PRESETS,
  generateOrderNumber,
  getCurrencySymbol,
};
