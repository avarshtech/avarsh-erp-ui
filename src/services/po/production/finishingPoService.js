/** Finishing PO API — real Spring Boot endpoints with mock fallback. */
import axiosInstance from '../../core/axiosInstance';
import { USE_MOCK_PRODUCTION_DATA } from './productionEnv';
import * as mockApi from './mockApi';
import { sendProductionPoCommand } from './productionPoCommand';

const BASE = '/finishing-po';

export const listFinishingPos = async (params = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.listFinishingPos(params);
  const { data } = await axiosInstance.get(BASE, { params });
  return data;
};

export const getFinishingPo = async (id) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getFinishingPo(id);
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

export const updateFinishingPo = async (id, payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.updateFinishingPo(id, payload);
  const { data } = await axiosInstance.put(`${BASE}/${id}`, payload);
  return data;
};

/** Submit, refer back or cancel: `payload` carries the PO's current `version` and the `reason`. */
export const changeFinishingPoStatus = async (id, action, payload = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.changeFinishingPoStatus(id, action, payload);
  return sendProductionPoCommand(BASE, id, action, payload);
};

export const getFinishingPosByOrder = async (orderId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getFinishingPosByOrder(orderId);
  const { data } = await axiosInstance.get(`${BASE}/by-order/${orderId}`);
  return data || [];
};

export const generateFinishingPos = async (payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.generateFinishingPos(payload);
  const { data } = await axiosInstance.post(`${BASE}/generate`, payload);
  return data || [];
};
