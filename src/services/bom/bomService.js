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

/**
 * Releases a BOM: it becomes CREATED, ready for POs. POST /boms/{id}/release.
 * @param {number} id - BOM ID
 * @param {number} version - The version the screen last read (a stale one is a 409)
 * @returns {Promise<Object>} BomDTO as stored, with its new version
 */
export const releaseBom = async (id, version) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/release`, { version });
  return response.data;
};

/**
 * Reopens a BOM as a DRAFT. POST /boms/{id}/reopen.
 * @param {number} id - BOM ID
 * @param {number} version - The version the screen last read (a stale one is a 409)
 * @returns {Promise<Object>} BomDTO as stored, with its new version
 */
export const reopenBom = async (id, version) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/reopen`, { version });
  return response.data;
};

/** CREATED is the release, DRAFT the reopen: a BOM's status moves only by those two commands. */
export const changeBomStatus = async (id, status, version) => {
  if (status === 'CREATED') return releaseBom(id, version);
  if (status === 'DRAFT') return reopenBom(id, version);
  throw new Error(`A BOM is released or reopened, not moved to ${status}`);
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
 * Get the 5 most recently created (CREATED status) BOMs, for suggestion dropdowns.
 * @returns {Promise<Array>} BomRecentDTO[]
 */
export const getRecentBoms = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/recent`);
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
