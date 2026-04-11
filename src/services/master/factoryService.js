import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/factories';

export const getAllFactories = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

export const getActiveFactories = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/active`);
  return response.data;
};

export const getFactoryById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createFactory = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateFactory = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteFactory = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
