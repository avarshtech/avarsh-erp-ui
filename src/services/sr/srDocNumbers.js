/**
 * Document numbering for the Sample Request mock layer.
 *
 * Mirrors the ERP standard — backend `shared/docnumber/DocumentNumberService`:
 *   <PREFIX>/<FY>/<NNNN>   e.g. SRQ/26-27/1001, DSP/26-27/1001, EXSG/26-27/1001
 * One counter per (prefix, financial year); the first document of each FY is
 * 1001 and the series resets every April 1st because the FY code is part of the
 * key — exactly the sys_doc_counters (prefix, fy_code) row shape. Kept here
 * rather than in srMockStore so the seed builder can share it without a cycle.
 */

// sys_doc_counters hands out 1001 as the first number of every (prefix, FY)
export const FIRST_DOC_NUMBER = 1001;

// Prefixes owned by the sampling module. Invoice series prefixes (EXSG / SA)
// live in INVOICE_TYPE_SERIES — they are buyer-facing and per invoice type.
export const SR_DOC_PREFIX = {
  REQUEST: 'SRQ',
  DISPATCH: 'DSP',
  ISSUE: 'SRI',
};

/** Indian financial year code, e.g. 2026-08 → "26-27" (FY starts April 1). */
export const fiscalYearLabel = (date = new Date()) => {
  const y = date.getFullYear() % 100;
  const from = date.getMonth() + 1 >= 4 ? y : y - 1;
  return `${String(from).padStart(2, '0')}-${String(from + 1).padStart(2, '0')}`;
};

/** Format a document number from its parts — the `%s/%s/%04d` of the backend. */
export const docNo = (prefix, seq, fy = fiscalYearLabel()) =>
  `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;

/** Next number for `prefix` in the current FY, incrementing the stored counter. */
export const nextDocNo = (db, prefix) => {
  const fy = fiscalYearLabel();
  const key = `${prefix}/${fy}`;
  db.docSeq = db.docSeq || {};
  db.docSeq[key] = (db.docSeq[key] || FIRST_DOC_NUMBER - 1) + 1;
  return docNo(prefix, db.docSeq[key], fy);
};
