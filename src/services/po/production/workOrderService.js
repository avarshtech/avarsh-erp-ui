/** Work Order (Sewing PO) API — real Spring Boot endpoints with mock fallback. */
import axiosInstance from '../../core/axiosInstance';
import { USE_MOCK_PRODUCTION_DATA } from './productionEnv';
import * as mockApi from './mockApi';

const BASE = '/work-order';

export const listWorkOrders = async (params = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.listWorkOrders(params);
  const { data } = await axiosInstance.get(BASE, { params });
  return data;
};

export const getWorkOrder = async (id) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getWorkOrder(id);
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

export const createWorkOrder = async (payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.createWorkOrder(payload);
  const { data } = await axiosInstance.post(BASE, payload);
  return data;
};

export const updateWorkOrder = async (id, payload) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.updateWorkOrder(id, payload);
  const { data } = await axiosInstance.put(`${BASE}/${id}`, payload);
  return data;
};

export const changeWorkOrderStatus = async (id, action, payload = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.changeWorkOrderStatus(id, action, payload);
  const { data } = await axiosInstance.patch(`${BASE}/${id}/status`, { action, ...payload });
  return data;
};

export const getApprovedWorkOrders = async (orderId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getApprovedWorkOrders(orderId);
  const { data } = await axiosInstance.get(`${BASE}/approved`, { params: { orderId } });
  return data || [];
};

export const getWorkOrderCoverage = async (orderId, excludeId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getOrderCoverage('WORK_ORDER', orderId, excludeId);
  const { data } = await axiosInstance.get(`${BASE}/coverage`, { params: { orderId, excludeId } });
  return data;
};
