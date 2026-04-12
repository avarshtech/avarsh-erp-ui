import axiosInstance from '../core/axiosInstance';

const BASE = '/cutting-pos';

export const searchCuttingPOs = async (params = {}) => {
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

export const getCuttingPOById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/${id}`);
  return response.data;
};

export const getApprovedCuttingPOsByOrder = async (orderId) => {
  const response = await axiosInstance.get(`${BASE}/by-order/${orderId}`);
  return response.data;
};

export const createCuttingPO = async (data) => {
  const response = await axiosInstance.post(BASE, data);
  return response.data;
};

export const updateCuttingPO = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/${id}`, data);
  return response.data;
};

export const changeCuttingPOStatus = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/${id}/status`, data);
  return response.data;
};

export const deleteCuttingPO = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/${id}`);
  return response.data;
};
