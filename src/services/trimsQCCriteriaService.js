/**
 * Trims QC Criteria Master — Real API service.
 * Backed by /api/v1/trims-qc-criteria in the erp-purchase Spring Boot module.
 */
import axiosInstance from './axiosInstance';

const ENDPOINT = '/trims-qc-criteria';

export const getTrimsQCCriteria = async () => {
  const response = await axiosInstance.get(ENDPOINT);
  return response.data ?? response;
};

export const getActiveTrimsQCCriteria = async () => {
  const response = await axiosInstance.get(`${ENDPOINT}/active`);
  return response.data ?? response;
};

export const createTrimsQCCriterion = async (data) => {
  const response = await axiosInstance.post(ENDPOINT, { ...data, active: data.active !== false });
  return response.data ?? response;
};

export const updateTrimsQCCriterion = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINT}/${id}`, data);
  return response.data ?? response;
};

export const deleteTrimsQCCriterion = async (id) => {
  const response = await axiosInstance.delete(`${ENDPOINT}/${id}`);
  return response.data ?? response;
};
