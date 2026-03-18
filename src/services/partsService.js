import axiosInstance from './axiosInstance';

const BASE_URL = '/parts';

export const getAllParts = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

export const getActiveParts = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/active`);
  return response.data;
};

export const getPartById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createPart = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updatePart = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deletePart = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
