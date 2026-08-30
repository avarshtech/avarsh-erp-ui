import axiosInstance from './axiosInstance';

const ENDPOINTS = {
  FLOWS: '/approval-flows',
  REQUESTS: '/approval-requests',
};

// ─── Flow Configuration (Admin CRUD) ───

export const getApprovalFlows = async () => {
  const response = await axiosInstance.get(ENDPOINTS.FLOWS);
  return response.data;
};

export const getApprovalFlowById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.FLOWS}/${id}`);
  return response.data;
};

export const getFlowsByEntityType = async (entityType) => {
  const response = await axiosInstance.get(`${ENDPOINTS.FLOWS}/entity-type/${entityType}`);
  return response.data;
};

export const createApprovalFlow = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.FLOWS, data);
  return response.data;
};

export const updateApprovalFlow = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINTS.FLOWS}/${id}`, data);
  return response.data;
};

export const deleteApprovalFlow = async (id) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.FLOWS}/${id}`);
  return response.data;
};

export const toggleFlowActive = async (id) => {
  const response = await axiosInstance.patch(`${ENDPOINTS.FLOWS}/${id}/toggle`);
  return response.data;
};

export const cloneApprovalFlow = async (id) => {
  const response = await axiosInstance.post(`${ENDPOINTS.FLOWS}/${id}/clone`);
  return response.data;
};

// ─── Runtime Approval Requests ───

export const submitForApproval = async (data) => {
  const response = await axiosInstance.post(`${ENDPOINTS.REQUESTS}/submit`, data);
  return response.data;
};

export const processApprovalAction = async (id, data) => {
  const response = await axiosInstance.post(`${ENDPOINTS.REQUESTS}/${id}/action`, data);
  return response.data;
};

export const getPendingApprovals = async () => {
  const response = await axiosInstance.get(`${ENDPOINTS.REQUESTS}/pending`);
  return response.data;
};

export const getApprovalHistory = async (entityType, entityId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.REQUESTS}/entity/${entityType}/${entityId}`);
  return response.data;
};
