/**
 * Defect Type Master — Real API service.
 * Backed by /api/v1/defect-types in the erp-purchase Spring Boot module.
 */
import axiosInstance from '../core/axiosInstance';

const ENDPOINT = '/defect-types';

export const getDefectTypes = async () => {
  const response = await axiosInstance.get(ENDPOINT);
  return response.data ?? response;
};

export const getActiveDefectTypes = async () => {
  const response = await axiosInstance.get(`${ENDPOINT}/active`);
  return response.data ?? response;
};

export const createDefectType = async (data) => {
  const response = await axiosInstance.post(ENDPOINT, { ...data, active: data.active !== false });
  return response.data ?? response;
};

export const updateDefectType = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINT}/${id}`, data);
  return response.data ?? response;
};

export const deleteDefectType = async (id) => {
  const response = await axiosInstance.delete(`${ENDPOINT}/${id}`);
  return response.data ?? response;
};
