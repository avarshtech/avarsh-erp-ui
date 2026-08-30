/**
 * Cutting room REST client. One function per backend endpoint, named to match
 * the cuttingService surface the screens already call, so cutting a feature over
 * from the mock is a one-line change in cuttingService.js.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/cutting';

/* ── Lookups ─────────────────────────────────────────────────────────────── */

export const getCutPos = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-pos`);
  return data;
};

/** Cut POs whose fabric has a relaxation report — the marker-planning gate. */
export const relaxedCutPos = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-pos`, { params: { relaxed: true } });
  return data;
};

/** Rolls received on a Cut PO, each flagged with whether it has relaxed. */
export const getRolls = async (cutPoId) => {
  const { data } = await axiosInstance.get(`${BASE}/cut-pos/${cutPoId}/rolls`);
  return data;
};

/** Rolls inventory issued to this Cut PO that the floor has not received yet. */
export const getPendingRolls = async (cutPoId) => {
  const { data } = await axiosInstance.get(`${BASE}/cut-pos/${cutPoId}/pending-rolls`);
  return data;
};

/* ── FR-01 Fabric receipt ────────────────────────────────────────────────── */

export const listReceipts = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/fabric-receipts`, { params: { size: 200, ...params } });
  return data.content;
};

export const createReceipt = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/fabric-receipts`, payload);
  return data;
};

export const updateReceipt = async (id, payload) => {
  const { data } = await axiosInstance.put(`${BASE}/fabric-receipts/${id}`, payload);
  return data;
};

/* ── FR-02 Fabric relaxation ─────────────────────────────────────────────── */

export const listRelaxations = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/fabric-relaxations`, { params: { size: 200, ...params } });
  return data.content;
};

/** Upsert: the drawer starts a cycle, then records the end time and shrinkage. */
export const saveRelaxation = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/fabric-relaxations/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/fabric-relaxations`, payload);
  return data;
};

/** Issues the shrinkage report, unlocking marker planning for the Cut PO. */
export const generateRelaxationReport = async (id) => {
  const { data } = await axiosInstance.post(`${BASE}/fabric-relaxations/${id}/report`);
  return data;
};

/* ── ENH-01 Marker plan ──────────────────────────────────────────────────── */

export const listMarkerPlans = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/marker-plans`, { params: { size: 200, ...params } });
  return data.content;
};

export const getMarkerPlan = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/marker-plans/${id}`);
  return data;
};

/** Upsert — the planning screen saves the whole plan, markers and all. */
export const saveMarkerPlan = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/marker-plans/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/marker-plans`, payload);
  return data;
};

export const deleteMarkerPlan = async (id) => {
  await axiosInstance.delete(`${BASE}/marker-plans/${id}`);
};

/** Markers planned for a Cut PO — the lay audit and cutting report dropdown. */
export const listMarkersForPo = async (cutPoId) => {
  const { data } = await axiosInstance.get(`${BASE}/cut-pos/${cutPoId}/markers`);
  return data;
};

/** The size-set (pilot) cut gate that releases a Cut PO for bulk laying. */
export const setSizeSetStatus = async (cutPoId, status, remarks) => {
  const { data } = await axiosInstance.put(`${BASE}/cut-pos/${cutPoId}/size-set`, { status, remarks });
  return data;
};

/* ── FR-03 Lay audit ─────────────────────────────────────────────────────── */

export const listLayAudits = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/lay-audits`, { params: { size: 200, ...params } });
  return data.content;
};

export const getLayAudit = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/lay-audits/${id}`);
  return data;
};

export const saveLayAudit = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/lay-audits/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/lay-audits`, payload);
  return data;
};

/** Lay numbers run per marker, so the next one is asked for per marker. */
export const nextLayNo = async (markerId) => {
  const { data } = await axiosInstance.get(`${BASE}/lay-audits/next-lay-no`, { params: { markerId } });
  return data.layNo;
};

/* ── FR-04 TMB check ─────────────────────────────────────────────────────── */

export const listTmbChecks = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/tmb-checks`, { params: { size: 200, ...params } });
  return data.content;
};

export const getTmbCheck = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/tmb-checks/${id}`);
  return data;
};

export const saveTmbCheck = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/tmb-checks/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/tmb-checks`, payload);
  return data;
};

/* ── FR-05 Cutting report ────────────────────────────────────────────────── */

export const getCuttingReport = async (cutPoId) => {
  const { data } = await axiosInstance.get(`${BASE}/report/${cutPoId}`);
  return data;
};

/** Size quantities come from the marker's ratio — the client sends only plies. */
export const addReportLay = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/report/lays`, payload);
  return data;
};

export const deleteReportLay = async (id) => {
  await axiosInstance.delete(`${BASE}/report/lays/${id}`);
};

/* ── FR-06/07 Bundling and issue to sewing ───────────────────────────────── */

export const listBundlings = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/bundlings`, { params: { size: 200, ...params } });
  return data.content;
};

export const listBundles = async (cutPoId, unissued = false) => {
  const { data } = await axiosInstance.get(`${BASE}/bundles`, { params: { cuttingPoId: cutPoId, unissued } });
  return data;
};

/** What a run would produce at this bundle size, before committing to it. */
export const previewBundling = async (cutPoId, bundleSize) => {
  const { data } = await axiosInstance.get(`${BASE}/bundlings/preview`, {
    params: { cuttingPoId: cutPoId, bundleSize },
  });
  return data;
};

export const generateBundles = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/bundlings`, payload);
  return data;
};

export const listBundleIssues = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/bundle-issues`, { params: { size: 200, ...params } });
  return data.content;
};

export const issueBundles = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/bundle-issues`, payload);
  return data;
};

/* ── FR-08/09/10 External process ────────────────────────────────────────── */

export const listPanelIssues = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/panel-issues`, { params: { size: 200, ...params } });
  return data.content;
};

export const savePanelIssue = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/panel-issues/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/panel-issues`, payload);
  return data;
};

export const listProcessReturns = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/process-returns`, { params: { size: 200, ...params } });
  return data.content;
};

export const saveProcessReturn = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/process-returns`, payload);
  return data;
};

export const listPanelChecks = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/panel-checks`, { params: { size: 200, ...params } });
  return data.content;
};

export const savePanelCheck = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/panel-checks/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/panel-checks`, payload);
  return data;
};

/* ── FR-11 Re-cut register ───────────────────────────────────────────────── */

export const listReCutEntries = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/recut-entries`, { params: { size: 200, ...params } });
  return data.content;
};

export const addReCutEntry = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/recut-entries`, payload);
  return data;
};

/* ── ENH-03 Reconciliation ───────────────────────────────────────────────── */

export const getReconciliation = async (cutPoId) => {
  const { data } = await axiosInstance.get(`${BASE}/reconciliation/${cutPoId}`);
  return data;
};

export const saveEndBit = async (cutPoId, rollNo, patch) => {
  const { data } = await axiosInstance.put(`${BASE}/reconciliation/${cutPoId}/end-bits`, { rollNo, ...patch });
  return data;
};

/**
 * Returns unused rolls and reusable end-bits to inventory under one note; the
 * quantities are credited back to their fabric stock rows.
 */
export const returnToInventory = async (cutPoId, rollNos) => {
  const list = Array.isArray(rollNos) ? rollNos : [rollNos];
  await axiosInstance.post(`${BASE}/reconciliation/${cutPoId}/returns`, { rollNos: list });
  return getReconciliation(cutPoId);
};

/* ── ENH-04 Dashboard ────────────────────────────────────────────────────── */

export const getDashboard = async () => {
  const { data } = await axiosInstance.get(`${BASE}/dashboard`);
  return data;
};
