/**
 * PO–Order Mapping constants.
 *
 * A General supplier PO is raised without a customer order (stock bought ahead of
 * confirmation). This screen links that PO — line by line, quantity by quantity —
 * to the orders it ends up serving. Not every General PO is mapped: some stay as
 * free stock, and the user says so explicitly with STOCK_ONLY.
 */
import { PO_STATUS } from './poStatusConstants';
import { ORDER_STATUS } from './orderConstants';

export const MAPPING_STATUS = {
  UNMAPPED:   'UNMAPPED',
  PARTIAL:    'PARTIAL',
  MAPPED:     'MAPPED',
  STOCK_ONLY: 'STOCK_ONLY',
};

const MAPPING_STATUS_LABELS = {
  [MAPPING_STATUS.UNMAPPED]:   'Unmapped',
  [MAPPING_STATUS.PARTIAL]:    'Partially Mapped',
  [MAPPING_STATUS.MAPPED]:     'Fully Mapped',
  [MAPPING_STATUS.STOCK_ONLY]: 'Stock Only',
};

export const getMappingStatusLabel = (status) => MAPPING_STATUS_LABELS[status] || status || '';

export const MAPPING_STATUS_OPTIONS = Object.values(MAPPING_STATUS).map((value) => ({
  value,
  label: MAPPING_STATUS_LABELS[value],
}));

/** General POs the supplier has already accepted; Draft/Pending can still be retyped to Regular. */
export const MAPPABLE_PO_STATUSES = [
  PO_STATUS.SENT_TO_SUPPLIER,
  PO_STATUS.PARTIALLY_RECEIVED,
  PO_STATUS.COMPLETED,
];

/** Orders that can receive stock — confirmed by the customer and not yet closed. */
export const MAPPABLE_ORDER_STATUSES = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.IN_PRODUCTION];

/**
 * Only raw-material lines are mapped to orders. Packing material, consumables and
 * services stay as plain stock, and a General PO with none of these lines never
 * appears in the mapping screen.
 */
export const MAPPABLE_ITEM_CATEGORIES = ['Fabric', 'Trims', 'Accessories'];

const MAPPABLE_LOWER = MAPPABLE_ITEM_CATEGORIES.map((c) => c.toLowerCase());

/** Case-insensitive so "FABRIC", "fabric" and "Fabric" from the item master all qualify. */
export const isMappableLine = (line) => MAPPABLE_LOWER.includes(String(line?.category || '').trim().toLowerCase());

/** Ceiling for allocations on a line. PO qty (not received qty) so a line can be mapped ahead of receipt. */
export const allocationCeiling = (line) => Number(line.qty) || 0;
