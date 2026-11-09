/**
 * Finishing › Checking — pre-final 100% check and final AQL 2.5 inspection sheets.
 * Real API (/api/v1/finishing/checkings). For a FINAL sheet the server works out the
 * sample size, accept/reject numbers and verdict from the lot size and the defects.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/finishing/checkings';

export const listCheckings = async (params = {}) => {
  const { data } = await axiosInstance.get(BASE, { params });
  return data || [];
};

export const getChecking = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

export const saveChecking = async (payload) => {
  const { data } = payload?.id
    ? await axiosInstance.put(`${BASE}/${payload.id}`, payload)
    : await axiosInstance.post(BASE, payload);
  return data;
};
