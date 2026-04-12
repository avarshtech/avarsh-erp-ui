import axiosInstance from '../core/axiosInstance';

const BASE = '/orders';

/**
 * Search orders with filters and pagination.
 * GET /api/v1/orders/search
 */
export const searchOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.search)         query.append('search',         params.search);
  if (params.status)         query.append('status',         params.status);
  if (params.orderDateStart) query.append('orderDateStart', params.orderDateStart);
  if (params.orderDateEnd)   query.append('orderDateEnd',   params.orderDateEnd);
  if (params.page  !== undefined) query.append('page',  params.page);
  if (params.size  !== undefined) query.append('size',  params.size);
  if (params.sort)           query.append('sort',      params.sort);
  if (params.direction)      query.append('direction', params.direction);

  const response = await axiosInstance.get(`${BASE}/search?${query.toString()}`);
  const data = response.data;
  return {
    content:       data.content       || [],
    totalElements: data.totalElements || 0,
    totalPages:    data.totalPages    || 0,
    size:          data.pageSize      ?? data.size ?? 10,
    number:        data.pageNumber    ?? data.number ?? 0,
  };
};

/**
 * Get order by ID. GET /api/v1/orders/{id}
 */
export const getOrderById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/${id}`);
  return response.data;
};

/**
 * Get order by order number. GET /api/v1/orders/by-order-no/{orderNo}
 */
export const getOrderByOrderNo = async (orderNo) => {
  const response = await axiosInstance.get(`${BASE}/by-order-no`, { params: { orderNo } });
  return response.data;
};

/**
 * Create a new order. POST /api/v1/orders
 */
export const createOrder = async (data) => {
  const response = await axiosInstance.post(BASE, data);
  return response.data;
};

/**
 * Update an existing order. PUT /api/v1/orders/{id}
 */
export const updateOrder = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/${id}`, data);
  return response.data;
};

/**
 * Change order status. PUT /api/v1/orders/{id}/status
 * @param {number} id
 * @param {string} status - target status (CONFIRMED, REFERRED_BACK, CANCELLED, IN_PRODUCTION)
 * @param {string} [reason] - referBackReason (optional)
 */
export const changeOrderStatus = async (id, status, reason, version) => {
  const response = await axiosInstance.put(`${BASE}/${id}/status`, { status, reason, version });
  return response.data;
};

/**
 * Delete a draft order. DELETE /api/v1/orders/{id}
 */
export const deleteOrder = async (id) => {
  await axiosInstance.delete(`${BASE}/${id}`);
};
