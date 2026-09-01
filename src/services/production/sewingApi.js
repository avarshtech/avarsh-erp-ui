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
