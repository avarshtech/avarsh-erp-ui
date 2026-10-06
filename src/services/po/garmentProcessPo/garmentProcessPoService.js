/**
 * Garment Process PO API client — the screens import only from here. Approve and reject are the approval
 * engine's (ApprovalActionBar, with the vendor sign-off as its actionData); the excess stays the module's own.
 */
import { get, post, put, patch, checked, toPage, listParams, toHistory, withSwatches } from '../jobWork/jobWorkApi';

export * from './garmentProcessPoLookupService';

const BASE = '/garment-process-pos';
const v = (doc) => ({ version: doc.version });
const po = async (call) => withSwatches(await call);

/** The server snapshots the vendor, process and return unit from what the draft names. */
const body = (doc) => ({
  poDate: doc.poDate, vendorId: doc.vendor?.id ?? null, paymentTerms: doc.paymentTerms, requiredDate: doc.requiredDate,
  returnTo: doc.returnTo, returnToOther: doc.returnToOther, returnUnitId: doc.returnUnitId,
  expectedReturnDate: doc.expectedReturnDate, instructions: doc.instructions, otherCharges: doc.otherCharges,
  lastLineNo: doc.lastLineNo, lines: doc.lines, version: doc.version, branchId: doc.branchId ?? null,
});

export const listGpos = async (filters) => toPage(await get(BASE, listParams(filters)));
export const getGpoFilterOptions = () => get(`${BASE}/filter-options`);
export const getGpo = (id) => po(get(`${BASE}/${id}`));
export const getGpoAudit = async (id) => toHistory(await get(`${BASE}/${id}/history`));
export const saveGpo = (doc) => po(doc.id ? put(`${BASE}/${doc.id}`, body(doc)) : post(BASE, body(doc)));

/** Amend delivery / instructions on an approved or sent PO (§16), with a reason. */
export const amendGpoDates = (doc, d, reason) => po(patch(`${BASE}/${doc.id}/delivery`, {
  requiredDate: d.requiredDate, expectedReturnDate: d.expectedReturnDate, returnTo: d.returnTo,
  returnToOther: d.returnToOther, returnUnitId: d.returnUnitId, instructions: d.instructions, reason, ...v(doc),
}));

export const submitGpo = (doc) => po(checked(`${BASE}/${doc.id}/submit`, v(doc)));
export const recallGpo = (doc) => po(post(`${BASE}/${doc.id}/recall`, v(doc)));
export const sendGpoToVendor = (doc) => po(post(`${BASE}/${doc.id}/send`, v(doc)));
export const cancelGpo = (doc, { reasonCode, remark }) => po(post(`${BASE}/${doc.id}/cancel`, { reasonCode, remark, ...v(doc) }));
export const shortCloseGpo = (doc, { reasonCode, remark }) => po(post(`${BASE}/${doc.id}/short-close`, { reasonCode, remark, ...v(doc) }));
export const requestGpoExcess = (doc, x) => po(post(`${BASE}/${doc.id}/excess`, { ...x, ...v(doc) }));
export const approveGpoExcess = (doc, overrideId) => po(post(`${BASE}/${doc.id}/excess/${overrideId}/approve`, v(doc)));
