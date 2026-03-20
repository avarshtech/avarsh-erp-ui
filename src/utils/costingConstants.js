/**
 * Costing Module Constants
 * Status configuration, dropdown data, and formula helpers for the Costing Module.
 *
 * Status Flow:
 *  (New) → Draft (Save as Draft)
 *  Draft → Final (Submit)
 *  Final → Approved (Approve button — Manager/Admin only)
 *  Final → Draft (Revise — Manager/Admin only)
 */

import { getCurrencySymbol } from './orderConstants';

// ==================== COSTING STATUS ====================

export const COSTING_STATUS = {
  DRAFT: 'Draft',
  FINAL: 'Final',
  APPROVED: 'Approved',
};

export const STATUS_LABELS = {
  [COSTING_STATUS.DRAFT]: 'Draft',
  [COSTING_STATUS.FINAL]: 'Final',
  [COSTING_STATUS.APPROVED]: 'Approved',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status;
};

export const STATUS_TRANSITIONS = {
  [COSTING_STATUS.DRAFT]: [COSTING_STATUS.FINAL],
  [COSTING_STATUS.FINAL]: [COSTING_STATUS.APPROVED, COSTING_STATUS.DRAFT],
  [COSTING_STATUS.APPROVED]: [],
};

export const EDITABLE_STATUSES = [COSTING_STATUS.DRAFT];
export const DELETABLE_STATUSES = [COSTING_STATUS.DRAFT];

export const STATUS_COLORS = {
  [COSTING_STATUS.DRAFT]: 'default',
  [COSTING_STATUS.FINAL]: 'blue',
  [COSTING_STATUS.APPROVED]: 'green',
};

// ==================== SEASONS ====================

export const SEASON_CODES = [
  { value: 'SS', label: 'Spring/Summer' },
  { value: 'AW', label: 'Autumn/Winter' },
];

export const SEASON_YEARS = Array.from({ length: 7 }, (_, i) => {
  const yr = new Date().getFullYear() - 1 + i;
  return { value: String(yr), label: String(yr) };
});

// Combined seasons list (used by CostingList filter on CostSheet's combined season field)
export const SEASONS = SEASON_CODES.flatMap((code) =>
  SEASON_YEARS.map((year) => ({
    value: code.value + year.value.slice(-2),
    label: `${code.label} ${year.label}`,
  })),
);

// ==================== FABRIC ====================

export const FABRIC_CLASSIFICATIONS = [
  { value: 'Woven', label: 'Woven' },
  { value: 'Knits', label: 'Knits' },
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
  { value: 'Silk', label: 'Silk' },
  { value: 'Denim', label: 'Denim' },
];

// ==================== UNIT OF MEASUREMENT ====================

export const FABRIC_UOMS = [
  { value: 'meters', label: 'Meters' },
  { value: 'yards', label: 'Yards' },
  { value: 'kgs', label: 'Kgs' },
];

export const TRIM_UOMS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'meters', label: 'Meters' },
  { value: 'yards', label: 'Yards' },
  { value: 'cones', label: 'Cones' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'dozen', label: 'Dozen' },
];

// ==================== TRIMS / ACCESSORIES ====================

export const LOCAL_TRIM_ITEMS = [
  { value: 'Main Label', label: 'Main Label' },
  { value: 'Size Label', label: 'Size Label' },
  { value: 'Care Label', label: 'Care Label' },
  { value: 'Woven Label', label: 'Woven Label' },
  { value: 'Woven Tape', label: 'Woven Tape' },
  { value: 'Polybag', label: 'Polybag' },
  { value: 'Barcode', label: 'Barcode' },
  { value: 'Hangtag', label: 'Hangtag' },
  { value: 'Thread', label: 'Thread' },
  { value: 'Others', label: 'Others' },
];

export const IMPORTED_TRIM_ITEMS = [
  { value: 'Metal Tag', label: 'Metal Tag' },
  { value: 'Plastic Button', label: 'Plastic Button' },
  { value: 'Hangtag Loop', label: 'Hangtag Loop' },
  { value: 'Zipper', label: 'Zipper' },
  { value: 'Snap Button', label: 'Snap Button' },
  { value: 'Metal Button', label: 'Metal Button' },
  { value: 'Others', label: 'Others' },
];

// ==================== MANUFACTURING PROCESSES ====================

export const MANUFACTURING_PROCESSES = [
  { value: 'CMT', label: 'CMT (Cut-Make-Trim)' },
  { value: 'Cutting', label: 'Cutting' },
  { value: 'Sewing', label: 'Sewing' },
  { value: 'Trimming/Checking', label: 'Trimming/Checking' },
  { value: 'Ironing/Packing', label: 'Ironing/Packing' },
  { value: 'Washing', label: 'Washing' },
  { value: 'Garment Dyeing', label: 'Garment Dyeing' },
  { value: 'Panel Printing', label: 'Panel Printing' },
  { value: 'Panel Embroidery', label: 'Panel Embroidery' },
  { value: 'Other Process', label: 'Other Process' },
];

// ==================== OVERHEAD CATEGORIES ====================

export const OVERHEAD_CATEGORIES = [
  { value: 'Sampling', label: 'Sampling' },
  { value: 'Documentation', label: 'Documentation' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Bank Charges', label: 'Bank Charges' },
  { value: 'Testing Charges', label: 'Testing Charges' },
  { value: 'Administrative Cost', label: 'Administrative Cost' },
  { value: 'Other Charges', label: 'Other Charges' },
];

// ==================== CURRENCIES ====================

export const CURRENCIES = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

// ==================== DEFAULT KNITS PARTS ====================

export const DEFAULT_KNITS_PARTS = [
  { partName: 'Top / Body', length: '', width: '', nop: 2, gsm: '', gramsPerPart: '' },
  { partName: 'Sleeve Short', length: '', width: '', nop: 2, gsm: '', gramsPerPart: '' },
  { partName: 'Neck Binding', length: '', width: '', nop: 1, gsm: '', gramsPerPart: '' },
  { partName: 'Collar', length: '', width: '', nop: 1, gsm: '', gramsPerPart: '' },
  { partName: 'Cuff', length: '', width: '', nop: 2, gsm: '', gramsPerPart: '' },
];

// ==================== ALLOWED FILE TYPES ====================

export const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE_MB = 5;

// ==================== ATTACHMENT CATEGORIES ====================

export const ATTACHMENT_CATEGORIES = [
  { value: 'TECHPACK', label: 'Techpack', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png', icon: 'file-text' },
  { value: 'MEASUREMENT_CHART', label: 'Measurement Chart', accept: '.pdf,.jpg,.jpeg,.png,.xls,.xlsx', icon: 'file-search' },
  { value: 'OTHER', label: 'Other Uploads', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx', icon: 'folder-open' },
];

// ==================== COSTING ID GENERATOR ====================

let costingCounter = 1004; // Starting after seed data

export const generateCostingId = () => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear() % 100;
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const num = String(costingCounter++).padStart(4, '0');
  return `CST/${String(fyStart).padStart(2, '0')}-${String(fyEnd).padStart(2, '0')}/${num}`;
};

// ==================== FORMULA HELPERS ====================

/**
 * Calculate fabric net cost per row
 * Net Cost = Consumption × Fabric Price × (1 + Allowance%)
 */
export const calcFabricNetCost = (consumption, fabricPrice, allowancePct = 0) => {
  const c = Number(consumption) || 0;
  const p = Number(fabricPrice) || 0;
  const a = Number(allowancePct) || 0;
  return c * p * (1 + a / 100);
};

/**
 * Calculate trim price per row
 * Price = Consumption × Cost
 */
export const calcTrimPrice = (consumption, cost) => {
  return (Number(consumption) || 0) * (Number(cost) || 0);
};

/**
 * Calculate knits grams per part
 * Grams = L × W × NOP × GSM / 10000
 */
export const calcKnitsGramsPerPart = (length, width, nop, gsm) => {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const n = Number(nop) || 0;
  const g = Number(gsm) || 0;
  if (l === 0 || w === 0 || n === 0 || g === 0) return 0;
  return (l * w * n * g) / 10000;
};

/**
 * Calculate total knits consumption in kg
 * Total = Sum of Grams per Part / 1000
 */
export const calcKnitsTotalConsumption = (parts) => {
  const total = parts.reduce((sum, p) => sum + (Number(p.gramsPerPart) || 0), 0);
  return total / 1000;
};

/**
 * Calculate total making price
 * = Fabric + Trims + Manufacturing + Markup
 */
export const calcTotalMakingPrice = (fabricTotal, trimsTotal, mfgTotal, markupTotal) => {
  return (Number(fabricTotal) || 0) +
    (Number(trimsTotal) || 0) +
    (Number(mfgTotal) || 0) +
    (Number(markupTotal) || 0);
};

/**
 * Calculate total overhead charges
 * = (Agent Commission % + Profit %) × Total Making Price / 100
 */
export const calcTotalOverheadCharges = (agentPct, profitPct, totalMakingPrice) => {
  const a = Number(agentPct) || 0;
  const p = Number(profitPct) || 0;
  const tmp = Number(totalMakingPrice) || 0;
  return ((a + p) / 100) * tmp;
};

/**
 * Calculate final price in quote currency
 * = Total Price / Actual Rate
 */
export const calcFinalPrice = (totalPrice, actualRate) => {
  const tp = Number(totalPrice) || 0;
  const rate = Number(actualRate) || 1;
  if (rate === 0) return 0;
  return tp / rate;
};

/**
 * Auto-calculate profit % from target price
 * Profit % = ((Target Price − Total Making Price − Commission) / Total Making Price) × 100
 */
export const calcAutoProfit = (targetPrice, totalMakingPrice, agentCommissionPct) => {
  const tp = Number(targetPrice) || 0;
  const tmp = Number(totalMakingPrice) || 0;
  const commPct = Number(agentCommissionPct) || 0;
  if (tmp === 0) return 0;
  const commAmount = (commPct / 100) * tmp;
  return ((tp - tmp - commAmount) / tmp) * 100;
};

/**
 * Format currency value with symbol
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined || isNaN(amount)) return `${getCurrencySymbol(currency)} 0.00`;
  return `${getCurrencySymbol(currency)} ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Convert final price to USD equivalent
 * Uses INR as the cross-currency bridge:
 *   totalPrice (INR) = finalPrice × actualRate
 *   finalPriceUsd = totalPrice / usdToInrRate
 */
export const calcFinalPriceUsd = (finalPrice, quoteCurrency, actualRate, usdToInrRate = 83.80) => {
  if (quoteCurrency === 'USD') return Number(finalPrice) || 0;
  const fp = Number(finalPrice) || 0;
  const ar = Number(actualRate) || 1;
  const usdRate = Number(usdToInrRate) || 1;
  if (usdRate === 0) return 0;
  return (fp * ar) / usdRate;
};
