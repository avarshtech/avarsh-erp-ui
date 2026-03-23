import axiosInstance from './axiosInstance';

const BASE_URL = '/overheads';

export const getAllOverheads = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

export const getActiveOverheads = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/active`);
  return response.data;
};

export const getOverheadById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createOverhead = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateOverhead = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteOverhead = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
