/**
 * Opening Stock Balance — UI constants.
 * Mirrors enum values on the Spring side (OpeningStockBatchType,
 * OpeningStockBatchStatus, StockSourceType). Keep in sync with V41 CHECK
 * constraints.
 */

export const OPENING_STOCK_BATCH_TYPE = Object.freeze({
  FABRIC: 'FABRIC',
  ACCESSORIES: 'ACCESSORIES',
});

export const OPENING_STOCK_BATCH_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
});

export const OPENING_STOCK_STATUS_COLOR = {
  DRAFT: 'default',
  POSTED: 'success',
  CANCELLED: 'default',
};

export const OPENING_STOCK_STATUS_LABEL = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

export const STOCK_SOURCE_TYPE = Object.freeze({
  GRN: 'GRN',
  OPENING_BALANCE: 'OPENING_BALANCE',
});

export const STOCK_SOURCE_LABEL = {
  GRN: 'GRN',
  OPENING_BALANCE: 'Opening',
};

export const STOCK_SOURCE_COLOR = {
  GRN: 'default',
  OPENING_BALANCE: 'geekblue',
};

// CSV column schemas — keep in sync with OpeningStockCsvService on the API.
export const FABRIC_CSV_COLUMNS = [
  'itemCode', 'rollNumber', 'width', 'gsm', 'shadeLot',
  'quantity', 'uom', 'unitCost', 'styleRef', 'remarks',
];

export const ACCESSORIES_CSV_COLUMNS = [
  'itemCode', 'size', 'color', 'quantity', 'uom', 'unitCost', 'styleRef', 'remarks',
];
