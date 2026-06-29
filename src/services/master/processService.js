import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/processes';

export const getAllProcesses = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

export const getActiveProcesses = async (category) => {
  const params = category ? { category } : {};
  const response = await axiosInstance.get(`${BASE_URL}/active`, { params });
  return response.data;
};

export const getProcessById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

export const createProcess = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateProcess = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteProcess = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
