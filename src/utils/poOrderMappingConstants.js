/**
 * PO–Order Mapping constants.
 *
 * A General supplier PO is raised without a customer order (stock bought ahead of
 * confirmation). The mapping screen links that PO — line by line, quantity by quantity —
 * to the orders it ends up serving. Not every General PO is mapped: some stay as free
 * stock, and the user says so explicitly with STOCK_ONLY.
 *
 * Only the labels and colours live here now. Which PO statuses can be mapped, which
 * orders can receive stock, which item categories count as order material, and how much
 * of a line is still open are all decided by the server — a second copy of a business
 * rule is how the two drift apart.
 */

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
