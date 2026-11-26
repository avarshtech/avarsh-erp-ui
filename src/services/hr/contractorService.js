import axiosInstance from '../core/axiosInstance';

/** Labour contractors. The server answers the administrator (superuser) only. */
const BASE_URL = '/hr/contractors';

export const getContractors = async (activeOnly = false) => {
  const response = await axiosInstance.get(BASE_URL, { params: { activeOnly } });
  return response.data;
};

export const createContractor = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

export const updateContractor = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, data);
  return response.data;
};

export const deleteContractor = async (id) => {
  await axiosInstance.delete(`${BASE_URL}/${id}`);
};
