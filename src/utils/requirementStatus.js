/**
 * Process requirement lifecycle — shared by the Cut Panel Requirement and the
 * Garment Process Requirement (BOM module). There is no approval step:
 *
 *   Draft ──Submit──▶ Submitted ──(PO module consumes)──▶ Partially Used ──▶ Fully Used
 *                        │
 *                        └── Edit in place (stays Submitted) until a PO against it is placed
 *
 *   Close (manual, reason mandatory) from Submitted or Partially Used.
 *
 * Partially / Fully Used are derived from PO consumption, never set by a user. In the
 * UI mock phase they only appear on seeded records.
 */
export const REQUIREMENT_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  PARTIALLY_USED: 'PARTIALLY_USED',
  FULLY_USED: 'FULLY_USED',
  CLOSED: 'CLOSED',
};

const LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PARTIALLY_USED: 'Partially Used',
  FULLY_USED: 'Fully Used',
  CLOSED: 'Closed',
};

export const getRequirementStatusLabel = (status) => LABELS[status] || status || '—';

export const REQUIREMENT_STATUS_OPTIONS = Object.keys(LABELS).map((value) => ({ value, label: LABELS[value] }));

/** Only a Draft can be edited, saved or deleted. */
export const isRequirementEditable = (status) => status === REQUIREMENT_STATUS.DRAFT;

/**
 * A submitted requirement is edited in place, staying Submitted, until a PO against it is
 * placed (submitted or beyond). Draft POs do not block it: they are flagged and re-fetch.
 */
export const isRequirementEditableInPlace = (status, placedPos = []) =>
  status === REQUIREMENT_STATUS.SUBMITTED && !placedPos.length;

/** Close releases the unconsumed balance. */
export const isRequirementClosable = (status) =>
  status === REQUIREMENT_STATUS.SUBMITTED || status === REQUIREMENT_STATUS.PARTIALLY_USED;

export const REQUIREMENT_BAR_MODE = { DRAFT: 'DRAFT', EDITING: 'EDITING', IN_PLACE: 'IN_PLACE', VIEW: 'VIEW' };

/**
 * What a requirement's action bar offers: DRAFT (save, submit), EDITING (cancel edit, save
 * changes), IN_PLACE (edit, close) or VIEW (close while closable).
 */
export const requirementBarMode = (status, placedPos, editing) => {
  if (isRequirementEditable(status)) return REQUIREMENT_BAR_MODE.DRAFT;
  if (!isRequirementEditableInPlace(status, placedPos)) return REQUIREMENT_BAR_MODE.VIEW;
  return editing ? REQUIREMENT_BAR_MODE.EDITING : REQUIREMENT_BAR_MODE.IN_PLACE;
};
