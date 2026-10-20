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

// ==================== CONSUMPTION MODE ====================

export const CONSUMPTION_MODE = {
  SIMPLE: 'SIMPLE',
  SIZE_WISE: 'SIZE_WISE',
  VARIANT_PER_SIZE: 'VARIANT_PER_SIZE',
};

export const CONSUMPTION_MODE_OPTIONS = [
  { value: CONSUMPTION_MODE.SIMPLE, label: 'Simple' },
  { value: CONSUMPTION_MODE.SIZE_WISE, label: 'Size-wise' },
  { value: CONSUMPTION_MODE.VARIANT_PER_SIZE, label: 'Variant/size' },
];

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
 * Purchase quantity for a single BOM line, in the line's CONSUMPTION (secondary) UOM.
 *
 * Matrix modes apply allowances per size, since rejection and shipment allowances can
 * differ by size; simple mode applies them flat. Returns null when the line has no
 * quantity yet, and the bare total when no allowances are configured.
 *
 * Convert the result with convertToPrimary() to get the quantity the PO is raised in.
 *
 * @param line          BOM line
 * @param totalQty      pre-computed total qty for the line (consumption UOM)
 * @param orderQtyGrid  { [color]: { [size]: qty } } — required for matrix modes
 * @param allSizes      sizes to walk in matrix modes
 */
export const calcLinePurchaseQty = (line, totalQty, orderQtyGrid = {}, allSizes = []) => {
  if (!totalQty) return null;
  const allowances = line?.processAllowances || [];
  if (!allowances.length) return totalQty;

  const mode = line?.consumptionMode || CONSUMPTION_MODE.SIMPLE;
  const isMatrixMode =
    mode === CONSUMPTION_MODE.SIZE_WISE || mode === CONSUMPTION_MODE.VARIANT_PER_SIZE;

  if (isMatrixMode && line?.consumptionMatrix) {
    let total = 0;
    allSizes.forEach((size) => {
      let sizeReq = 0;
      Object.entries(line.consumptionMatrix).forEach(([color, szMap]) => {
        sizeReq += (Number(szMap?.[size]) || 0) * (orderQtyGrid[color]?.[size] || 0);
      });
      let rejTotal = 0;
      let shipTotal = 0;
      allowances.forEach((a) => {
        const sa = a.sizeAllowances?.[size];
        rejTotal += Number(sa?.rejectionPercent ?? a.rejectionPercent) || 0;
        shipTotal += Number(sa?.shipmentAllowancePercent ?? a.shipmentAllowancePercent) || 0;
      });
      total += sizeReq + sizeReq * ((rejTotal + shipTotal) / 100);
    });
    return total;
  }

  const loss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
  const rej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
  const ship = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
  return calcPurchaseQty(totalQty, loss, rej + ship);
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

// ==================== MATRIX CALCULATION HELPERS ====================

/**
 * Build an order quantity grid { color: { size: qty } } from orderLineSummary.
 * Sums across all POs (or filters by a specific PO).
 */
export const buildOrderQtyGrid = (orderLineSummary, buyerPoNo = null) => {
  const grid = {};
  const lines = buyerPoNo
    ? orderLineSummary.filter((ol) => ol.buyerPoNo === buyerPoNo)
    : orderLineSummary;
  lines.forEach((ol) => {
    (ol.colors || []).forEach((cr) => {
      const color = cr.name;
      if (!grid[color]) grid[color] = {};
      Object.entries(cr.quantities || {}).forEach(([size, qty]) => {
        grid[color][size] = (grid[color][size] || 0) + (Number(qty) || 0);
      });
    });
  });
  return grid;
};

/**
 * Calculate total requirement from a consumption matrix and order qty grid.
 * For each cell: consumption[color][size] × orderQty[color][size], then sum all.
 */
export const calcMatrixTotal = (consumptionMatrix, orderQtyGrid) => {
  if (!consumptionMatrix || !orderQtyGrid) return 0;
  let total = 0;
  Object.entries(consumptionMatrix).forEach(([color, sizes]) => {
    Object.entries(sizes || {}).forEach(([size, consumption]) => {
      const orderQty = orderQtyGrid[color]?.[size] || 0;
      total += (Number(consumption) || 0) * orderQty;
    });
  });
  return total;
};

/**
 * Calculate per-variant purchase qty breakdown for VARIANT_PER_SIZE mode.
 * Groups requirement by variant (via variantMapping) and applies per-size allowances.
 * Returns: [{ variantId, size, totalReq, allowancePercent, purchaseQty }]
 */
export const calcVariantBreakdown = (consumptionMatrix, orderQtyGrid, variantMapping, processAllowances) => {
  if (!consumptionMatrix || !orderQtyGrid || !variantMapping) return [];
  const sizeReqs = {};

  // Sum requirement per size across all colors
  Object.entries(consumptionMatrix).forEach(([color, sizes]) => {
    Object.entries(sizes || {}).forEach(([size, consumption]) => {
      const orderQty = orderQtyGrid[color]?.[size] || 0;
      const req = (Number(consumption) || 0) * orderQty;
      sizeReqs[size] = (sizeReqs[size] || 0) + req;
    });
  });

  // Build per-size aggregate allowance from all processes
  const sizeAllowanceMap = {};
  (processAllowances || []).forEach((pa) => {
    const sa = pa.sizeAllowances || {};
    Object.entries(sa).forEach(([size, allowance]) => {
      if (!sizeAllowanceMap[size]) sizeAllowanceMap[size] = { rejection: 0, shipment: 0 };
      sizeAllowanceMap[size].rejection += Number(allowance.rejectionPercent) || 0;
      sizeAllowanceMap[size].shipment += Number(allowance.shipmentAllowancePercent) || 0;
    });
    // For sizes without sizeAllowances, use flat defaults
    Object.keys(sizeReqs).forEach((size) => {
      if (!sa[size] && !sizeAllowanceMap[size]) {
        if (!sizeAllowanceMap[size]) sizeAllowanceMap[size] = { rejection: 0, shipment: 0 };
        sizeAllowanceMap[size].rejection += Number(pa.rejectionPercent) || 0;
        sizeAllowanceMap[size].shipment += Number(pa.shipmentAllowancePercent) || 0;
      }
    });
  });

  return Object.entries(variantMapping).map(([size, variantId]) => {
    const totalReq = sizeReqs[size] || 0;
    const allow = sizeAllowanceMap[size] || { rejection: 0, shipment: 0 };
    const allowancePercent = allow.rejection + allow.shipment;
    const purchaseQty = totalReq + totalReq * (allowancePercent / 100);
    return { variantId, size, totalReq, allowancePercent, purchaseQty };
  });
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
