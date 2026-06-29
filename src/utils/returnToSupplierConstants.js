/**
 * Constants for the Return to Supplier screen (CRD_INV_004).
 */

export const RETURN_TYPE = {
  FABRIC: 'FABRIC',
  ACCESSORIES: 'ACCESSORIES',
};

export const RETURN_TYPE_LABEL = {
  FABRIC: 'Fabric',
  ACCESSORIES: 'Accessories',
};

export const RETURN_STATUS = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const RETURN_STATUS_COLOR = {
  DRAFT: 'default',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export const DEBIT_NOTE_STATUS = {
  RAISED: 'RAISED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
};

export const DEBIT_NOTE_STATUS_COLOR = {
  RAISED: 'processing',
  SETTLED: 'success',
  CANCELLED: 'error',
};

/** Segmented toggle options used on the Return to Supplier landing page. */
export const RETURN_SEGMENTS = [
  { label: 'Fabric Return', value: RETURN_TYPE.FABRIC },
  { label: 'Accessories Return', value: RETURN_TYPE.ACCESSORIES },
];
