/**
 * Document numbering for the Export Documentation mock layer.
 *
 * Mirrors the ERP standard — backend `shared/docnumber/DocumentNumberService`:
 *   <PREFIX>/<FY>/<NNNN>   e.g. PKL/26-27/1001, EXP/26-27/1001
 * One counter per (prefix, financial year); the first document of each FY is 1001
 * and the series resets every April 1st because the FY code is part of the key —
 * exactly the sys_doc_counters (prefix, fy_code) row shape. Kept out of the store
 * so the seed builder can share it without an import cycle.
 */

// sys_doc_counters hands out 1001 as the first number of every (prefix, FY)
export const FIRST_DOC_NUMBER = 1001;

export const EXPDOC_PREFIX = {
  PACKING_ENTRY: 'CPK',
  PACKING_LIST: 'PKL',
  INVOICE: 'EXP',
  STICKER_RUN: 'STK',
  SHIPMENT: 'SHP',
};

/** Indian financial year code, e.g. 2026-08 -> "26-27" (FY starts April 1). */
export const fiscalYearLabel = (date = new Date()) => {
  const y = date.getFullYear() % 100;
  const from = date.getMonth() + 1 >= 4 ? y : y - 1;
  return `${String(from).padStart(2, '0')}-${String(from + 1).padStart(2, '0')}`;
};

/** Format a document number from its parts — the `%s/%s/%04d` of the backend. */
export const docNo = (prefix, seq, fy = fiscalYearLabel()) =>
  `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;

/** The last number a `%04d` series can express. */
export const LAST_DOC_NUMBER = 9999;

/** How close to the end of a series counts as "running out" (§15). */
export const SERIES_WARN_AT = 9900;

/**
 * How much of the current series is left — read by the exhaustion warning (§15)
 * without consuming a number.
 */
export const seriesHeadroom = (db, prefix) => {
  const fy = fiscalYearLabel();
  const used = (db.docSeq || {})[`${prefix}/${fy}`] || FIRST_DOC_NUMBER - 1;
  return { fy, next: used + 1, remaining: LAST_DOC_NUMBER - used, exhausted: used >= LAST_DOC_NUMBER };
};

/**
 * Next number for `prefix` in the current FY, incrementing the stored counter.
 *
 * A `%04d` series ends at 9999, and §15 asks for an actionable message rather than
 * a malformed number: the counter is not consumed, and the caller's transition is
 * refused with the series and year named.
 */
export const nextDocNo = (db, prefix) => {
  const fy = fiscalYearLabel();
  const key = `${prefix}/${fy}`;
  db.docSeq = db.docSeq || {};
  const used = db.docSeq[key] || FIRST_DOC_NUMBER - 1;
  if (used >= LAST_DOC_NUMBER) {
    const e = new Error(
      `Series ${prefix}/${fy} is exhausted at ${docNo(prefix, LAST_DOC_NUMBER, fy)}. `
      + 'An administrator must configure a wider series or a new prefix before more documents can be numbered.',
    );
    e.code = 'CONFLICT';
    throw e;
  }
  db.docSeq[key] = used + 1;
  return docNo(prefix, db.docSeq[key], fy);
};
