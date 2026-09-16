import axiosInstance from '../core/axiosInstance';

/**
 * Inter-branch stock transfers (multi-branch companies only).
 * DRAFT → DISPATCHED → RECEIVED, or CANCELLED. The list follows the working
 * branch (X-Branch-Id): a branch sees what it sent and what it is about to receive.
 */
const BASE = '/stock-transfers';

const clean = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
);

export const searchTransfers = async (params = {}) => {
  const { data } = await axiosInstance.get(BASE, { params: clean(params) });
  return data;
};

export const getTransfer = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

/** Count-sheet rows of the source branch that still hold stock. */
export const getTransferableItems = async ({ categoryId, subCategoryId, itemTypeId, branchId } = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/transferable-items`, {
    params: clean({ categoryId, subCategoryId, itemTypeId, branchId }),
  });
  return Array.isArray(data) ? data : [];
};

export const createTransfer = async (payload) => {
  const { data } = await axiosInstance.post(BASE, payload);
  return data;
};

export const updateTransfer = async (id, payload) => {
  const { data } = await axiosInstance.put(`${BASE}/${id}`, payload);
  return data;
};

export const dispatchTransfer = async (id) => {
  const { data } = await axiosInstance.post(`${BASE}/${id}/dispatch`);
  return data;
};

export const receiveTransfer = async (id) => {
  const { data } = await axiosInstance.post(`${BASE}/${id}/receive`);
  return data;
};

export const cancelTransfer = async (id, reason) => {
  const { data } = await axiosInstance.post(`${BASE}/${id}/cancel`, { reason: reason || null });
  return data;
};
