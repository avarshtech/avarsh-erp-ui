/**
 * Cut Panel PO API client — the screens import only from here. Approve, send back and reject are the
 * approval engine's (ApprovalActionBar); the over-allocation override stays the module's own.
 */
import { get, post, put, patch, checked, toPage, listParams, toHistory, withSwatches } from '../jobWork/jobWorkApi';
import axiosInstance from '../../core/axiosInstance';

export * from './cutPanelPoLookupService';

const BASE = '/cut-panel-pos';
const v = (doc) => ({ version: doc.version });
const po = async (call) => withSwatches(await call);

/** The server snapshots the process, vendor and return unit from what the draft names. */
const body = (doc) => ({
  poDate: doc.poDate, processName: doc.process?.name ?? null, processOtherName: doc.process?.otherName ?? null,
  vendorId: doc.vendor?.id ?? null, paymentTerms: doc.paymentTerms, requiredDeliveryDate: doc.requiredDeliveryDate,
  returnTo: doc.returnTo, returnToOther: doc.returnToOther, returnUnitId: doc.returnUnitId, instructions: doc.instructions,
  otherCharges: doc.otherCharges, lateDeliveryReason: doc.lateDeliveryReason, duplicateReason: doc.duplicateReason,
  lastLineNo: doc.lastLineNo, lines: doc.lines, version: doc.version, branchId: doc.branchId ?? null,
});

export const listCpps = async (filters) => toPage(await get(BASE, listParams(filters)));
export const getCppFilterOptions = () => get(`${BASE}/filter-options`);
export const getCpp = (id) => po(get(`${BASE}/${id}`));
export const getCppAudit = async (id) => toHistory(await get(`${BASE}/${id}/history`));
export const saveCpp = (doc) => po(doc.id ? put(`${BASE}/${doc.id}`, body(doc)) : post(BASE, body(doc)));
export const deleteCpp = async (doc) => { await axiosInstance.delete(`${BASE}/${doc.id}`, { params: v(doc) }); };
export const updateCppDetails = (doc, d) => po(patch(`${BASE}/${doc.id}/issued-details`, {
  vendorId: d.vendor?.id ?? null, paymentTerms: d.paymentTerms, requiredDeliveryDate: d.requiredDeliveryDate,
  returnTo: d.returnTo, returnToOther: d.returnToOther, returnUnitId: d.returnUnitId, instructions: d.instructions, ...v(doc),
}));

export const submitCpp = (doc) => po(checked(`${BASE}/${doc.id}/submit`, v(doc)));
export const recallCpp = (doc) => po(post(`${BASE}/${doc.id}/recall`, v(doc)));
export const sendCppToVendor = (doc) => po(post(`${BASE}/${doc.id}/send`, v(doc)));
export const cancelCpp = (doc, { reasonCode, remark }) => po(post(`${BASE}/${doc.id}/cancel`, { reasonCode, remark, ...v(doc) }));
export const shortCloseCpp = (doc, { reasonCode, remark }) => po(post(`${BASE}/${doc.id}/short-close`, { reasonCode, remark, ...v(doc) }));
export const requestCppOverride = (doc, o) => po(post(`${BASE}/${doc.id}/overrides`, { ...o, ...v(doc) }));
export const authoriseCppOverride = (doc, overrideId) => po(post(`${BASE}/${doc.id}/overrides/${overrideId}/authorise`, v(doc)));

const AMENDMENT = (doc) => `${BASE}/${doc.id}/amendment`;
export const amendCpp = (doc, reason) => po(post(AMENDMENT(doc), { reason, ...v(doc) }));
export const saveCppRevision = (doc, rev) => po(put(AMENDMENT(doc), {
  otherCharges: rev.otherCharges, requiredDeliveryDate: rev.requiredDeliveryDate, paymentTerms: rev.paymentTerms,
  lateDeliveryReason: rev.lateDeliveryReason, duplicateReason: rev.duplicateReason,
  lines: (rev.lines || []).map((l) => ({
    key: l.key, poQty: l.poQty, uom: l.uom, billingQty: l.billingQty, rate: l.rate, rateReasonCode: l.rateReasonCode, rateRemark: l.rateRemark,
  })),
  ...v(doc),
}));
export const submitCppRevision = (doc) => po(checked(`${AMENDMENT(doc)}/submit`, v(doc)));
export const dropCppRevision = (doc, reason) => po(post(`${AMENDMENT(doc)}/discard`, { reason, ...v(doc) }));
