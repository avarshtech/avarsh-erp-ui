/**
 * Sewing REST client. One function per backend endpoint, named to match the
 * sewingService surface the screens already call, so moving a feature off the
 * mock is a one-line change in sewingService.js.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/sewing';

/* ── 5.1 Operators ───────────────────────────────────────────────────────── */

export const getOperators = async () => {
  const { data } = await axiosInstance.get(`${BASE}/operators`);
  return data;
};

export const saveOperator = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/operators/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/operators`, payload);
  return data;
};

/* ── 5.2 SAM library ─────────────────────────────────────────────────────── */

export const getSamValues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/style-sam`);
  return data;
};

/** The SAM sheet for one style — what the plan screen auto-fills from. */
export const getStyleSam = async (styleNo) => {
  const { data } = await axiosInstance.get(`${BASE}/style-sam`, { params: { styleNo } });
  return data[0] ?? null;
};

export const saveStyleSam = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/style-sam/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/style-sam`, payload);
  return data;
};

/* ── Order lookup ────────────────────────────────────────────────────────── */

export const getOrders = async () => {
  const { data } = await axiosInstance.get(`${BASE}/orders`);
  return data;
};

/* ── 4.1 Production plan ─────────────────────────────────────────────────── */

export const listPlans = async () => {
  const { data } = await axiosInstance.get(`${BASE}/plans`);
  return data;
};

export const getPlan = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/plans/${id}`);
  return data;
};

export const savePlan = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/plans/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/plans`, payload);
  return data;
};

export const setPlanStatus = async (id, status) => {
  const { data } = await axiosInstance.put(`${BASE}/plans/${id}/status`, null, { params: { status } });
  return data;
};

/** The style's SAM sheet as plan operations, so a studied style is not re-timed. */
export const getSuggestedOperations = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/plans/suggested-operations`, { params: { orderId } });
  return data;
};

/* ── 4.2 Cut parts receipt ───────────────────────────────────────────────── */

export const listCutReceipts = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-receipts`);
  return data;
};

/** Cutting bundle issues sewing has not received yet, with their bundles. */
export const listPendingBundleIssues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-receipts/pending-issues`);
  return data;
};

export const saveCutReceipt = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/cut-receipts`, payload);
  return data;
};

/* ── 4.4 Garment issue to finishing ──────────────────────────────────────── */

export const listGarmentIssues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues`);
  return data;
};

export const issuedBySize = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues/issued-by-size`, { params: { orderId } });
  return data;
};

/** The size-wise sheet a new note starts from, with balances carried forward. */
export const getIssueOpeningLines = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues/opening-lines`, { params: { orderId } });
  return data;
};

export const saveGarmentIssue = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/garment-issues`, payload);
  return data;
};
