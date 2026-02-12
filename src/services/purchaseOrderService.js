import axiosInstance from './axiosInstance';

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

// ==================== ACTIVITY LOG ====================

/**
 * Create a new activity for a Purchase Order
 * @param {number} poId - Purchase order ID
 * @param {Object} payload - { comment, status, isSystemGenerated }
 * @returns {Promise<Object>} Created activity
 */
export const createActivity = async (poId, payload) => {
  if (!poId) throw new Error('poId is required');
  const url = `${ENDPOINTS.PURCHASE_ORDERS}/${poId}/activities`;
  const now = new Date().toISOString();

  const rawComment = payload?.comment || payload?.text || '';
  const status = payload?.status || 'Draft';
  const prefix = payload?.isSystemGenerated  ? `[SYS]` : `[USR:${payload?.userName}]`;
  const formattedComment = `${prefix} ${rawComment}`;

  const body = {
    poId: Number(poId),
    comment: formattedComment,
    status: status,
    edited: payload?.edited || false,
    createdAt: payload?.createdAt || now,
    updatedAt: payload?.updatedAt || now,
  };
  const res = await axiosInstance.post(url, body);
  const data = res.data;
  return data;
};

/**
 * Parse activity comment to extract isSystemGenerated and status
 * Format: [SYS:status] comment or [USR:status] comment
 * @param {string} comment - The raw comment from the database
 * @returns {Object} { text, isSystemGenerated, status }
 */
export const parseActivityComment = (comment) => {
  if (!comment) return { text: '', isSystemGenerated: false, status: null };

  // Support prefixes:
  // - [USR:UserName] message  (user-created with username in prefix)
  // - [SYS] message          (system-generated)
  const prefixPattern = /^\[(SYS|USR)(?::([^\]]+))?\]\s*/;
  const match = comment.match(prefixPattern);

  if (match) {
    const isSystemGenerated = match[1] === 'SYS';
    const meta = match[2] || null;
    let userName = null;

    if (!isSystemGenerated && meta) {
      // New format: [USR:UserName]
      userName = meta;
    }

    const text = comment.replace(prefixPattern, '');
    return { text, isSystemGenerated, userName };
  }

  if (comment.startsWith('[SYSTEM]')) {
    return {
      text: comment.replace(/^\[SYSTEM\]\s*/, ''),
      isSystemGenerated: true,
      userName: null,
    };
  }

  return { text: comment, isSystemGenerated: false, userName: null };
};

export default {
  getPurchaseOrders,
  searchPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  createActivity,
  parseActivityComment,
};
