/**
 * Bill Passing API client — the ONLY file the screens import.
 *
 * Every write and every workflow call carries the `version` the screen was
 * looking at, and the server answers with the whole bill and a fresh version.
 * A screen must therefore adopt what comes back rather than keep the copy it
 * had, or its next save is rejected as stale.
 */
import axiosInstance, { upload } from '../core/axiosInstance';

/**
 * One-shot cleanup of the pre-cutover demo data.
 *
 * Every Bill Passing screen ran off `avarsh.billPassing.mockStore.v1` in
 * localStorage until this module replaced the mock. That key is dead weight in
 * the browser of anyone who used the mock build, and no code reads it now.
 */
try {
  localStorage.removeItem('avarsh.billPassing.mockStore.v1');
} catch {
  // Private-mode / storage-disabled browsers: nothing to clean up anyway.
}

/** axiosInstance owns the /api/v1 prefix. */
export const BASE = '/inventory/bill-passing';

const MASTERS = `${BASE}/masters`;
const SOURCES = `${BASE}/sources`;

/**
 * The Spring page shape, with the KPI block kept. The six cards above the grid
 * read `stats`, which a plain page normaliser would drop.
 */
const toPage = (data) => ({
  content: data?.content || [],
  totalElements: data?.totalElements || 0,
  totalPages: data?.totalPages || 0,
  size: data?.size ?? 10,
  number: data?.number ?? 0,
  stats: data?.stats || null,
});

// ── Bills ───────────────────────────────────────────────────────────────────

export const searchBills = async (params = {}) => toPage((await axiosInstance.get(BASE, { params })).data);

export const getBill = async (id) => (await axiosInstance.get(`${BASE}/${id}`)).data;

export const createBill = async (payload) => (await axiosInstance.post(BASE, payload)).data;

export const updateBill = async (id, payload) => (await axiosInstance.put(`${BASE}/${id}`, payload)).data;

export const deleteBill = async (id) => {
  await axiosInstance.delete(`${BASE}/${id}`);
  return { id };
};

/** What the approver signed, as it stood then. */
export const getBillSnapshot = async (id) => (await axiosInstance.get(`${BASE}/${id}/snapshot`)).data;

// ── Where a bill comes from ─────────────────────────────────────────────────

export const listBpSuppliers = async () => (await axiosInstance.get(`${SOURCES}/suppliers`)).data || [];

export const listBillablePos = async (params = {}) =>
  (await axiosInstance.get(`${SOURCES}/pos`, { params })).data || [];

/** `excludeBillId` keeps the bill being edited from counting against itself. */
export const getPoBillingSource = async (poId, { excludeBillId } = {}) =>
  (await axiosInstance.get(`${SOURCES}/po/${poId}`, { params: { excludeBillId } })).data;

/** The PO-line register, the view that replaced the Excel sheet. */
export const searchBillLines = async (params = {}) =>
  toPage((await axiosInstance.get(`${BASE}/lines`, { params })).data);

// ── Workflow ────────────────────────────────────────────────────────────────
// Each returns the whole bill, so the screen adopts the new state and version.

const act = async (id, verb, body = {}) =>
  (await axiosInstance.post(`${BASE}/${id}/${verb}`, body)).data;

export const submitBill = (id, version) => act(id, 'submit', { version });

export const startVerification = (id, version) => act(id, 'start-verification', { version });

export const raiseQuery = (id, reason, version) => act(id, 'query', { reason, version });

/** Hand the bill back to the clerk to correct, rather than querying the supplier. */
export const referBackBill = (id, reason, version) => act(id, 'refer-back', { reason, version });

export const holdBill = (id, reason, version) => act(id, 'hold', { reason, version });

export const releaseHold = (id, remarks, version) => act(id, 'release', { remarks, version });

export const sendForApproval = (id, { overrideReason } = {}, version) =>
  act(id, 'send-for-approval', { overrideReason, version });

export const approveBill = (id, comments, version) => act(id, 'approve', { comments, version });

export const rejectBill = (id, reason, version) => act(id, 'reject', { reason, version });

export const reopenBill = (id, reason, version) => act(id, 'reopen', { reason, version });

export const sendToAccounts = (id, version) => act(id, 'send-to-accounts', { version });

export const recordTallyReference = (id, tallyReferenceNo, version) =>
  act(id, 'tally-reference', { tallyReferenceNo, version });

// ── Debits ──────────────────────────────────────────────────────────────────

/** Re-reads the receipts and inspections first, then proposes again. */
export const refreshProposedDebits = (id, version) => act(id, 'debits/refresh', { version });

export const saveDebit = async (id, debit) =>
  (await axiosInstance.post(`${BASE}/${id}/debits`, debit)).data;

export const setDebitStatus = async (id, debitId, status, reason, version) =>
  (await axiosInstance.patch(`${BASE}/${id}/debits/${debitId}/status`, { status, reason, version })).data;

export const deleteDebit = async (id, debitId, version) =>
  (await axiosInstance.delete(`${BASE}/${id}/debits/${debitId}`, { params: { version } })).data;

// ── Issue log ───────────────────────────────────────────────────────────────

export const addIssue = async (id, issue) =>
  (await axiosInstance.post(`${BASE}/${id}/issues`, issue)).data;

export const setIssueStatus = async (id, issueId, status, resolutionRemarks, version) =>
  (await axiosInstance.patch(`${BASE}/${id}/issues/${issueId}/status`,
    { status, resolutionRemarks, version })).data;

export const withdrawIssue = async (id, issueId, reason, version) =>
  (await axiosInstance.post(`${BASE}/${id}/issues/${issueId}/withdraw`, { reason, version })).data;

// ── Attachments ─────────────────────────────────────────────────────────────
// The files live in the shared store; these two keep the bill in step. Neither
// takes a version — a file picker does not carry the form's state — and both
// answer with the bill so the screen adopts the fresh version.

export const addAttachment = async (id, { file, docType }, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType || 'OTHER');
  // upload() already unwraps the response body.
  return upload(`${BASE}/${id}/attachments`, form, onProgress);
};

export const removeAttachment = async (id, fileId) =>
  (await axiosInstance.delete(`${BASE}/${id}/attachments/${fileId}`)).data;

// ── Configuration masters ───────────────────────────────────────────────────

export const listDebitTypes = async (params = {}) =>
  (await axiosInstance.get(`${MASTERS}/debit-types`, { params })).data || [];
export const saveDebitType = async (payload) =>
  (await axiosInstance.post(`${MASTERS}/debit-types`, payload)).data;
export const deleteDebitType = async (id) => {
  await axiosInstance.delete(`${MASTERS}/debit-types/${id}`);
  return { id };
};

export const listChargeTypes = async (params = {}) =>
  (await axiosInstance.get(`${MASTERS}/charge-types`, { params })).data || [];
export const saveChargeType = async (payload) =>
  (await axiosInstance.post(`${MASTERS}/charge-types`, payload)).data;
export const deleteChargeType = async (id) => {
  await axiosInstance.delete(`${MASTERS}/charge-types/${id}`);
  return { id };
};

export const listIssueTypes = async (params = {}) =>
  (await axiosInstance.get(`${MASTERS}/issue-types`, { params })).data || [];
export const saveIssueType = async (payload) =>
  (await axiosInstance.post(`${MASTERS}/issue-types`, payload)).data;
export const deleteIssueType = async (id) => {
  await axiosInstance.delete(`${MASTERS}/issue-types/${id}`);
  return { id };
};

export const getTolerance = async () => (await axiosInstance.get(`${MASTERS}/tolerance`)).data;
export const saveTolerance = async (payload) =>
  (await axiosInstance.put(`${MASTERS}/tolerance`, payload)).data;
