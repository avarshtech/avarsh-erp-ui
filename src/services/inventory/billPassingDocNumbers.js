/**
 * Document numbering for the Bill Passing mock layer.
 *
 * Mirrors the ERP standard — backend `shared/docnumber/DocumentNumberService`:
 *   <PREFIX>/<FY>/<NNNN>   e.g. BP/26-27/1001
 * One counter per (prefix, financial year); the first document of each FY is
 * 1001 and the series resets every April 1st because the FY code is part of the
 * key — exactly the sys_doc_counters (prefix, fy_code) row shape. Kept here
 * rather than in billPassingMockStore so the seed builder can share it without
 * a cycle. Same shape as src/services/sr/srDocNumbers.js.
 */

import { currentFinancialYear as fiscalYearLabel } from '../../utils/billPassingConstants';

// sys_doc_counters hands out 1001 as the first number of every (prefix, FY)
export const FIRST_DOC_NUMBER = 1001;

export const BP_DOC_PREFIX = { BILL: 'BP' };

/** Indian financial year code, e.g. 2026-08 → "26-27" (FY starts April 1). */
export { fiscalYearLabel };

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
