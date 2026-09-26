/**
 * Process requirement lifecycle — shared by the Cut Panel Requirement and the
 * Garment Process Requirement (BOM module). There is no approval step:
 *
 *   Draft ──Submit──▶ Submitted ──(PO module consumes)──▶ Partially Used ──▶ Fully Used
 *     ▲                  │
 *     └──── Reopen ──────┘   only while nothing has been consumed
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

/** Reopen returns a Submitted requirement to Draft — never once the PO module has used any of it. */
export const isRequirementReopenable = (status, consumedQty = 0) =>
  status === REQUIREMENT_STATUS.SUBMITTED && !(consumedQty > 0);

/** Close releases the unconsumed balance. */
export const isRequirementClosable = (status) =>
  status === REQUIREMENT_STATUS.SUBMITTED || status === REQUIREMENT_STATUS.PARTIALLY_USED;

/** Status of a submitted requirement from its required and consumed totals. */
export const deriveUsageStatus = (requiredQty, consumedQty) => {
  if (!(consumedQty > 0)) return REQUIREMENT_STATUS.SUBMITTED;
  return consumedQty >= requiredQty ? REQUIREMENT_STATUS.FULLY_USED : REQUIREMENT_STATUS.PARTIALLY_USED;
};

/**
 * Next number in a `<PREFIX>-<YYYY>-NNNNN` series. The year is the financial year's
 * start year; numbers are never reused, so the serial continues from the highest ever
 * issued (deleted drafts included — callers pass every number they have issued).
 */
export const nextRequirementNumber = (prefix, fyStartYear, issuedNumbers = []) => {
  const re = new RegExp(`^${prefix}-${fyStartYear}-(\\d{5})`);
  const max = issuedNumbers.reduce((m, n) => {
    const hit = re.exec(String(n || ''));
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return `${prefix}-${fyStartYear}-${String(max + 1).padStart(5, '0')}`;
};
