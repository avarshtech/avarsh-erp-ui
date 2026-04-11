import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/boms';

export const searchBoms = async (params = {}) => {
  const response = await axiosInstance.get(BASE_URL, { params });
  return response.data;
};

export const getBomById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createBom = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateBom = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, data);
  return response.data;
};

export const deleteBom = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};

export const changeBomStatus = async (id, status, version) => {
  const response = await axiosInstance.patch(`${BASE_URL}/${id}/status`, { status, version });
  return response.data;
};

/**
 * Get BOM by order number. Used by PO module for Regular/Combined POs.
 * @param {string} orderNo - Order number to look up
 * @returns {Promise<Object>} BomDTO with lines
 */
export const getBomByOrderNo = async (orderNo) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-order-no`, { params: { orderNo } });
  return response.data;
};

/**
 * Update PO-generated flag on specific BOM lines.
 * Called by PO module when placing or cancelling a PO against BOM lines.
 * @param {number} bomId - BOM ID
 * @param {number[]} lineIds - Array of BOM line IDs to update
 * @param {boolean} poGenerated - true = lock (PO placed), false = unlock (PO cancelled)
 */
export const updateBomLinePoStatus = async (bomId, lineIds, poGenerated) => {
  const response = await axiosInstance.patch(`${BASE_URL}/${bomId}/lines/po-status`, { lineIds, poGenerated });
  return response.data;
};
