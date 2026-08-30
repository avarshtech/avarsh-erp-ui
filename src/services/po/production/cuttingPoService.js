/** Cutting PO API — real Spring Boot endpoints with mock fallback. */
import axiosInstance from '../../core/axiosInstance';
import { USE_MOCK_PRODUCTION_DATA } from './productionEnv';
import * as mockApi from './mockApi';

const BASE = '/cutting-po';

export const listCuttingPos = async (params = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.listCuttingPos(params);
  const { data } = await axiosInstance.get(BASE, { params });
  return data;
};

export const getCuttingPo = async (id) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getCuttingPo(id);
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

export const createCuttingPo = async (payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.createCuttingPo(payload);
  const { data } = await axiosInstance.post(BASE, payload);
  return data;
};

export const updateCuttingPo = async (id, payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.updateCuttingPo(id, payload);
  const { data } = await axiosInstance.put(`${BASE}/${id}`, payload);
  return data;
};

export const changeCuttingPoStatus = async (id, action, payload = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.changeCuttingPoStatus(id, action, payload);
  const { data } = await axiosInstance.patch(`${BASE}/${id}/status`, { action, ...payload });
  return data;
};

export const getApprovedCuttingPos = async (orderId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getApprovedCuttingPos(orderId);
  const { data } = await axiosInstance.get(`${BASE}/approved`, { params: { orderId } });
  return data || [];
};

export const getCuttingPoCoverage = async (orderId, excludeId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getOrderCoverage('CUTTING', orderId, excludeId);
  const { data } = await axiosInstance.get(`${BASE}/coverage`, { params: { orderId, excludeId } });
  return data;
};
