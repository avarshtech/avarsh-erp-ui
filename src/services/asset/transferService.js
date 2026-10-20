import axiosInstance from '../core/axiosInstance';

/**
 * Asset transfers: the only thing that moves an asset.
 *
 * There is no delete. A transfer that should not happen is cancelled and the
 * record stays, because a refused move is a decision somebody will ask about.
 */

const BASE = '/asset-transfers';

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getTransfers = async (params = {}) =>
  (await axiosInstance.get(`${BASE}${query(params)}`)).data;

export const getTransfer = async (id) => (await axiosInstance.get(`${BASE}/${id}`)).data;

export const createTransfer = async (payload) => (await axiosInstance.post(BASE, payload)).data;

export const updateTransfer = async (id, payload) =>
  (await axiosInstance.put(`${BASE}/${id}`, payload)).data;

export const submitTransfer = async (id, version) =>
  (await axiosInstance.post(`${BASE}/${id}/submit${query({ version })}`)).data;

export const approveTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/approve`, payload)).data;

export const rejectTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/reject`, payload)).data;

export const cancelTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/cancel`, payload)).data;

export const dispatchTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/dispatch`, payload)).data;

/** An intra-unit move: no journey, finished in one step. */
export const completeTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/complete`, payload)).data;

export const receiveTransfer = async (id, payload) =>
  (await axiosInstance.post(`${BASE}/${id}/receive`, payload)).data;

export const getTransferReasons = async () => (await axiosInstance.get(`${BASE}/reasons`)).data;
