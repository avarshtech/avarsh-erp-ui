import axiosInstance from '../core/axiosInstance';

const BASE = '/work-orders';

/**
 * Search work orders with filters and pagination.
 * GET /api/v1/work-orders/search
 */
export const searchWorkOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.search)             query.append('search',             params.search);
  if (params.status)             query.append('status',             params.status);
  if (params.processingUnitType) query.append('processingUnitType', params.processingUnitType);
  if (params.dateStart)          query.append('dateStart',          params.dateStart);
  if (params.dateEnd)            query.append('dateEnd',            params.dateEnd);
  if (params.page !== undefined) query.append('page',               params.page);
  if (params.size !== undefined) query.append('size',               params.size);
  if (params.sort)               query.append('sort',               params.sort);
  if (params.direction)          query.append('direction',          params.direction);

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
 * Get work order by ID with items.
 * GET /api/v1/work-orders/{id}
 */
export const getWorkOrderById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/${id}`);
  return response.data;
};

/**
 * Create a new work order.
 * POST /api/v1/work-orders
 */
export const createWorkOrder = async (data) => {
  const response = await axiosInstance.post(BASE, data);
  return response.data;
};

/**
 * Update an existing work order (DRAFT only).
 * PUT /api/v1/work-orders/{id}
 */
export const updateWorkOrder = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/${id}`, data);
  return response.data;
};

/**
 * Change work order status.
 * PUT /api/v1/work-orders/{id}/status
 */
export const changeWorkOrderStatus = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/${id}/status`, data);
  return response.data;
};

/**
 * Delete a work order (DRAFT only).
 * DELETE /api/v1/work-orders/{id}
 */
export const deleteWorkOrder = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/${id}`);
  return response.data;
};
