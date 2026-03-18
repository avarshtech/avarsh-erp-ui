/**
 * BOM Module Constants
 */

// ==================== BOM STATUS ====================

export const BOM_STATUS = {
  DRAFT: 'DRAFT',
  CREATED: 'CREATED',
};

const STATUS_LABELS = {
  [BOM_STATUS.DRAFT]: 'Draft',
  [BOM_STATUS.CREATED]: 'Created',
};

export const getStatusLabel = (status) => {
  if (!status) return '';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

export const EDITABLE_STATUSES = [BOM_STATUS.DRAFT, BOM_STATUS.CREATED];

// ==================== PROCESS TYPES ====================

export const PROCESS_TYPES = {
  MATERIAL_PURCHASE: 'MATERIAL_PURCHASE',
  FABRIC_DYEING: 'FABRIC_DYEING',
  FABRIC_PRINTING: 'FABRIC_PRINTING',
};

// Process types that trigger the allowance popup
export const ALLOWANCE_POPUP_PROCESS_TYPES = [
  PROCESS_TYPES.FABRIC_DYEING,
  PROCESS_TYPES.FABRIC_PRINTING,
];

// ==================== QTY CALCULATION BASIS ====================

export const QTY_CALC_BASIS = {
  TOTAL: 'TOTAL',
  BUYER_PO: 'BUYER_PO',
};

export const QTY_CALC_BASIS_OPTIONS = [
  { value: QTY_CALC_BASIS.TOTAL, label: 'Total Qty' },
  { value: QTY_CALC_BASIS.BUYER_PO, label: 'Buyer PO' },
];

// ==================== UOM OPTIONS ====================

export const FABRIC_UOMS = [
  { value: 'grm', label: 'Grams (grm)' },
  { value: 'kgs', label: 'Kilograms (kgs)' },
  { value: 'mts', label: 'Meters (mts)' },
  { value: 'yds', label: 'Yards (yds)' },
];

export const TRIM_UOMS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'grs', label: 'Gross (grs)' },
  { value: 'mts', label: 'Meters (mts)' },
  { value: 'yds', label: 'Yards (yds)' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'cones', label: 'Cones' },
  { value: 'dozen', label: 'Dozen' },
];

export const ALL_UOMS = [...new Map([...FABRIC_UOMS, ...TRIM_UOMS].map(u => [u.value, u])).values()];

// ==================== UOM CONVERSIONS ====================

export const UOM_CONVERSIONS = {
  grm_to_kgs: 1 / 1000,
  kgs_to_grm: 1000,
  pcs_to_grs: 1 / 144,
  grs_to_pcs: 144,
};

/**
 * Convert quantity between UOMs if a conversion exists.
 * Returns null if no conversion is available.
 */
export const convertUom = (qty, fromUom, toUom) => {
  if (fromUom === toUom) return qty;
  const key = `${fromUom}_to_${toUom}`;
  const factor = UOM_CONVERSIONS[key];
  if (factor == null) return null;
  return qty * factor;
};

// ==================== CALCULATION HELPERS ====================

/**
 * Calculate purchase quantity with additive allowances (BR-07).
 * Purchase Qty = Base Qty + (Base Qty × Process Loss%) + (Base Qty × Rejection%)
 */
export const calcPurchaseQty = (baseQty, processLossPercent = 0, rejectionPercent = 0) => {
  const base = Number(baseQty) || 0;
  const loss = base * (Number(processLossPercent) / 100);
  const rejection = base * (Number(rejectionPercent) / 100);
  return base + loss + rejection;
};

/**
 * Calculate purchase width with shrinkage (BR-08).
 * Purchase Width = Finished Width + Shrinkage (inches)
 */
export const calcPurchaseWidth = (finishedWidth, shrinkageInches = 0) => {
  return (Number(finishedWidth) || 0) + (Number(shrinkageInches) || 0);
};

/**
 * Calculate total qty for trims.
 * Total Qty = Consumption per Garment × Order Qty
 */
export const calcTrimsTotal = (consumptionPerGarment, orderQty) => {
  return (Number(consumptionPerGarment) || 0) * (Number(orderQty) || 0);
};

// ==================== DEFAULT PARTS NAME OPTIONS ====================

export const PARTS_NAME_OPTIONS = [
  'Body',
  'Front Panel',
  'Back Panel',
  'Sleeves',
  'Collar',
  'Cuff',
  'Placket',
  'Pocket',
  'Lining',
  'Interlining',
  'Waistband',
  'Yoke',
  'Hood',
  'Placket & Cuff',
];
