import axiosInstance from '../core/axiosInstance';

/**
 * Disposal requests.
 *
 * Approving one is the only thing that retires an asset. There is no delete: a
 * disposal that should not happen is cancelled and the record stays.
 */

const BASE = '/asset-disposals';

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getDisposals = async (params = {}) =>
  (await axiosInstance.get(`${BASE}${query(params)}`)).data;

export const getDisposal = async (id) => (await axiosInstance.get(`${BASE}/${id}`)).data;

export const createDisposal = async (payload) => (await axiosInstance.post(BASE, payload)).data;

export const updateDisposal = async (id, payload) =>
  (await axiosInstance.put(`${BASE}/${id}`, payload)).data;

export const submitDisposal = async (id, version) =>
  (await axiosInstance.post(`${BASE}/${id}/submit${query({ version })}`)).data;

export const approveDisposal = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/approve`, payload)).data;

export const rejectDisposal = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/reject`, payload)).data;

export const cancelDisposal = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/cancel`, payload)).data;

export const getDisposalOptions = async () => (await axiosInstance.get(`${BASE}/options`)).data;
