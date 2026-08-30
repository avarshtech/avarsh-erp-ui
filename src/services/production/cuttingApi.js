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
