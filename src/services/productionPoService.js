import axiosInstance from './axiosInstance';

const BASE = '/production-pos';

export const searchProductionPOs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.search)             query.append('search',    params.search);
  if (params.status)             query.append('status',    params.status);
  if (params.dateStart)          query.append('dateStart', params.dateStart);
  if (params.dateEnd)            query.append('dateEnd',   params.dateEnd);
  if (params.page !== undefined) query.append('page',      params.page);
  if (params.size !== undefined) query.append('size',      params.size);
  if (params.sort)               query.append('sort',      params.sort);
  if (params.direction)          query.append('direction', params.direction);
  const { data } = await axiosInstance.get(`${BASE}/search?${query}`);
  return { content: data.content || [], totalElements: data.totalElements || 0,
    totalPages: data.totalPages || 0, size: data.pageSize ?? data.size ?? 10,
    number: data.pageNumber ?? data.number ?? 0 };
};

export const getProductionPOById = async (id) =>
  (await axiosInstance.get(`${BASE}/${id}`)).data;

export const createProductionPO = async (d) =>
  (await axiosInstance.post(BASE, d)).data;

export const updateProductionPO = async (id, d) =>
  (await axiosInstance.put(`${BASE}/${id}`, d)).data;

export const updateProductionStage = async (ppoId, stageId, d) =>
  (await axiosInstance.put(`${BASE}/${ppoId}/stages/${stageId}`, d)).data;

export const changeProductionPOStatus = async (id, d) =>
  (await axiosInstance.put(`${BASE}/${id}/status`, d)).data;

export const deleteProductionPO = async (id) =>
  (await axiosInstance.delete(`${BASE}/${id}`)).data;
