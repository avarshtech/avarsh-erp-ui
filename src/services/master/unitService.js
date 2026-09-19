import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/units';

export const getAllUnits = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/** Active units; with a branchId only that branch's (a unit with no branch reads as the head office's). */
export const getActiveUnits = async (branchId) => {
  const response = await axiosInstance.get(`${BASE_URL}/active`, { params: branchId ? { branchId } : undefined });
  return response.data;
};

export const getUnitById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createUnit = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateUnit = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteUnit = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
