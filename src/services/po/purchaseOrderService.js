import axiosInstance from '../core/axiosInstance';

/**
 * Purchase Order API Service
 * Contains all API methods for Purchase Order operations
 */

const ENDPOINTS = {
  PURCHASE_ORDERS: '/purchase-orders',
};

// ==================== PURCHASE ORDERS ====================

/**
 * Get all purchase orders with pagination
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (0-indexed for API)
 * @param {number} params.size - Page size
 * @param {string} params.sort - Sort field
 * @param {string} params.direction - Sort direction (asc/desc)
 * @returns {Promise<Object>} Paginated response { content, totalElements, totalPages, size, number }
 */
export const getPurchaseOrders = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) {
    queryParams.append('sort', params.sort);
    queryParams.append('sort', params.direction || 'desc');
  }
  const queryString = queryParams.toString();
  const url = queryString
    ? `${ENDPOINTS.PURCHASE_ORDERS}?${queryString}`
    : ENDPOINTS.PURCHASE_ORDERS;
  const response = await axiosInstance.get(url);
  return response.data;
};

/**
 * Search purchase orders with filters (uses /purchase-orders/search endpoint)
 * @param {Object} params - Search parameters
 * @param {number} params.page - Page number (0-indexed)
 * @param {number} params.size - Page size
 * @param {string} params.sort - Sort field
 * @param {string} params.direction - Sort direction
 * @param {string} params.search - Search text (PO number, supplier name)
 * @param {string} params.status - Status filter
 * @param {string} params.poDateStart - PO date range start (YYYY-MM-DD)
 * @param {string} params.poDateEnd - PO date range end (YYYY-MM-DD)
 * @param {string} params.deliveryDateStart - Delivery date range start (YYYY-MM-DD)
 * @param {string} params.deliveryDateEnd - Delivery date range end (YYYY-MM-DD)
 * @returns {Promise<Object>} Paginated response
 */
export const searchPurchaseOrders = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.direction) queryParams.append('direction', params.direction);
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.poDateStart) queryParams.append('poDateStart', params.poDateStart);
  if (params.poDateEnd) queryParams.append('poDateEnd', params.poDateEnd);
  if (params.deliveryDateStart) queryParams.append('deliveryDateStart', params.deliveryDateStart);
  if (params.deliveryDateEnd) queryParams.append('deliveryDateEnd', params.deliveryDateEnd);
  if (params.poType) queryParams.append('poType', params.poType);
  const queryString = queryParams.toString();
  const url = `${ENDPOINTS.PURCHASE_ORDERS}/search?${queryString}`;
  const response = await axiosInstance.get(url);
  return response.data;
};

/**
 * Get a purchase order by ID
 * @param {number} id - Purchase order ID
 * @returns {Promise<Object>} Purchase order details
 */
export const getPurchaseOrderById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.PURCHASE_ORDERS}/${id}`);
  return response.data;
};

/**
 * Create a new purchase order
 * @param {Object} poData - Purchase order data
 * @returns {Promise<Object>} Created purchase order
 */
export const createPurchaseOrder = async (poData) => {
  const response = await axiosInstance.post(ENDPOINTS.PURCHASE_ORDERS, poData);
  return response.data;
};

/**
 * Update an existing purchase order
 * Backend expects POST with id in body
 * @param {number} id - Purchase order ID
 * @param {Object} poData - Updated purchase order data
 * @returns {Promise<Object>} Updated purchase order
 */
export const updatePurchaseOrder = async (id, poData) => {
  const payload = { id, ...poData };
  const response = await axiosInstance.post(ENDPOINTS.PURCHASE_ORDERS, payload);
  return response.data;
};

/**
 * Delete a purchase order
 * @param {number} id - Purchase order ID
 * @returns {Promise<void>}
 */
export const deletePurchaseOrder = async (id) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.PURCHASE_ORDERS}/${id}`);
  return response.data;
};

// ==================== PO ACTIONS (Reject / Refer Back / Cancel) ====================

/**
 * Reject a purchase order
 * @param {number} id - Purchase order ID
 * @param {Object} data - { reason, category?, version? }
 * @returns {Promise<Object>} Updated purchase order
 */
export const rejectPurchaseOrder = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINTS.PURCHASE_ORDERS}/${id}/reject`, data);
  return response.data;
};

/**
 * Refer back a purchase order for revision
 * @param {number} id - Purchase order ID
 * @param {Object} data - { reason, version? }
 * @returns {Promise<Object>} Updated purchase order
 */
export const referBackPurchaseOrder = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINTS.PURCHASE_ORDERS}/${id}/refer-back`, data);
  return response.data;
};

/**
 * Cancel a purchase order
 * @param {number} id - Purchase order ID
 * @param {Object} data - { reason, version? }
 * @returns {Promise<Object>} Updated purchase order
 */
export const cancelPurchaseOrder = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINTS.PURCHASE_ORDERS}/${id}/cancel`, data);
  return response.data;
};

// ==================== ACTIVITY LOG ====================

/**
 * Create a new activity for a Purchase Order
 * @param {number} poId - Purchase order ID
 * @param {Object} payload - { comment, status, isSystemGenerated, name }
 * @returns {Promise<Object>} Created activity
 */
export const createActivity = async (poId, payload) => {
  if (!poId) throw new Error('poId is required');
  const url = `${ENDPOINTS.PURCHASE_ORDERS}/${poId}/activities`;
  const now = new Date().toISOString();

  const body = {
    poId: Number(poId),
    comment: payload?.comment || payload?.text || '',
    status: payload?.status || 'Draft',
    isSystemGenerated: payload?.isSystemGenerated || false,
    name: payload?.name || '',
    edited: payload?.edited || false,
    createdAt: payload?.createdAt || now,
    updatedAt: payload?.updatedAt || now,
  };

  if (payload?.rejectionCategory) {
    body.rejectionCategory = payload.rejectionCategory;
  }
  if (payload?.rejectionCategoryLabel) {
    body.rejectionCategoryLabel = payload.rejectionCategoryLabel;
  }

  const res = await axiosInstance.post(url, body);
  return res.data;
};

// ==================== VERSION HISTORY ====================

/**
 * Get all version history entries for a PO (newest first)
 * @param {number} poId - Purchase order ID
 * @returns {Promise<Array>} Version history entries
 */
export const getPoVersionHistory = async (poId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.PURCHASE_ORDERS}/${poId}/versions`);
  return response.data;
};

/**
 * Get the latest version snapshot for a PO (for change detection)
 * @param {number} poId - Purchase order ID
 * @returns {Promise<Object|null>} Latest version or null if no versions
 */
export const getPoLatestVersion = async (poId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.PURCHASE_ORDERS}/${poId}/versions/latest`);
  return response.status === 204 ? null : response.data;
};

// ==================== STAGE COMPLETION ====================

/**
 * Update a processing stage's completion status
 * @param {Object} data - { lineItemId, stageIndex, completed, actualCompletionDate, notes }
 * @returns {Promise<Object>} Updated line item DTO
 */
export const updateStageCompletion = async (data) => {
  const response = await axiosInstance.put(
    `${ENDPOINTS.PURCHASE_ORDERS}/line-items/stage-completion`,
    data
  );
  return response.data;
};

/**
 * Append new processing stages to a PO line item
 * @param {number} lineItemId - Line item ID
 * @param {Array} stages - Array of { stageName, completionDate } objects
 * @returns {Promise<Object>} Updated line item DTO
 */
export const addStagesToLineItem = async (lineItemId, stages) => {
  const response = await axiosInstance.put(
    `${ENDPOINTS.PURCHASE_ORDERS}/line-items/${lineItemId}/stages`,
    stages
  );
  return response.data;
};

/**
 * Replace all processing stages on a PO line item (reorder after drag-drop)
 * @param {number} lineItemId - Line item ID
 * @param {Array} stages - Full ordered array of stage objects
 * @returns {Promise<Object>} Updated line item DTO
 */
export const reorderStages = async (lineItemId, stages) => {
  const response = await axiosInstance.put(
    `${ENDPOINTS.PURCHASE_ORDERS}/line-items/${lineItemId}/stages/reorder`,
    stages
  );
  return response.data;
};

// ==================== E-WAY BILL ====================

const EWAY_BILL_ENDPOINT = '/eway-bill';

export const generateEwayBill = async (data) => {
  const response = await axiosInstance.post(`${EWAY_BILL_ENDPOINT}/generate`, data);
  return response.data;
};

export const cancelEwayBill = async (data) => {
  const response = await axiosInstance.post(`${EWAY_BILL_ENDPOINT}/cancel`, data);
  return response.data;
};

export const rejectEwayBill = async (data) => {
  const response = await axiosInstance.post(`${EWAY_BILL_ENDPOINT}/reject`, data);
  return response.data;
};

export default {
  getPurchaseOrders,
  searchPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  createActivity,
  getPoVersionHistory,
  getPoLatestVersion,
  updateStageCompletion,
  addStagesToLineItem,
  reorderStages,
  generateEwayBill,
  cancelEwayBill,
  rejectEwayBill,
};
