/**
 * Cutting Production Module API Service
 * All cutting sub-module API calls
 */
import axiosInstance from './axiosInstance';

const BASE = '/cutting';

// ─── Cut Order Plan ──────────────────────────────────────────────────────────

export const searchCutOrderPlans = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/order-plans/search`, { params });
  return response.data;
};

export const getCutOrderPlanById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/order-plans/${id}`);
  return response.data;
};

export const createCutOrderPlan = async (data) => {
  const response = await axiosInstance.post(`${BASE}/order-plans`, data);
  return response.data;
};

export const updateCutOrderPlan = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/order-plans/${id}`, data);
  return response.data;
};

export const changeCutOrderPlanStatus = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/order-plans/${id}/status`, data);
  return response.data;
};

export const deleteCutOrderPlan = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/order-plans/${id}`);
  return response.data;
};

// ─── Fabric Receipt ──────────────────────────────────────────────────────────

export const searchFabricReceipts = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/fabric-receipts/search`, { params });
  return response.data;
};

export const getFabricReceiptById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/fabric-receipts/${id}`);
  return response.data;
};

export const createFabricReceipt = async (data) => {
  const response = await axiosInstance.post(`${BASE}/fabric-receipts`, data);
  return response.data;
};

export const updateFabricReceipt = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/fabric-receipts/${id}`, data);
  return response.data;
};

export const deleteFabricReceipt = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/fabric-receipts/${id}`);
  return response.data;
};

// ─── Fabric Relaxation ───────────────────────────────────────────────────────

export const searchRelaxations = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/relaxations/search`, { params });
  return response.data;
};

export const getRelaxationById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/relaxations/${id}`);
  return response.data;
};

export const createRelaxation = async (data) => {
  const response = await axiosInstance.post(`${BASE}/relaxations`, data);
  return response.data;
};

export const completeRelaxation = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/relaxations/${id}/complete`, data);
  return response.data;
};

// ─── Marker Planning ─────────────────────────────────────────────────────────

export const searchMarkers = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/markers/search`, { params });
  return response.data;
};

export const getMarkerById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/markers/${id}`);
  return response.data;
};

export const createMarker = async (data) => {
  const response = await axiosInstance.post(`${BASE}/markers`, data);
  return response.data;
};

export const updateMarker = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/markers/${id}`, data);
  return response.data;
};

export const approveMarker = async (id) => {
  const response = await axiosInstance.put(`${BASE}/markers/${id}/approve`);
  return response.data;
};

export const deleteMarker = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/markers/${id}`);
  return response.data;
};

// ─── Lay Audit ───────────────────────────────────────────────────────────────

export const searchLayAudits = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/lay-audits/search`, { params });
  return response.data;
};

export const getLayAuditById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/lay-audits/${id}`);
  return response.data;
};

export const createLayAudit = async (data) => {
  const response = await axiosInstance.post(`${BASE}/lay-audits`, data);
  return response.data;
};

export const updateLayAudit = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/lay-audits/${id}`, data);
  return response.data;
};

export const deleteLayAudit = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/lay-audits/${id}`);
  return response.data;
};

// ─── TMB Check ───────────────────────────────────────────────────────────────

export const searchTmbChecks = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/tmb-checks/search`, { params });
  return response.data;
};

export const getTmbCheckById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/tmb-checks/${id}`);
  return response.data;
};

export const createTmbCheck = async (data) => {
  const response = await axiosInstance.post(`${BASE}/tmb-checks`, data);
  return response.data;
};

export const updateTmbCheck = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/tmb-checks/${id}`, data);
  return response.data;
};

// ─── Cutting Report ──────────────────────────────────────────────────────────

export const searchCuttingReports = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/reports/search`, { params });
  return response.data;
};

export const getCuttingReportById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/reports/${id}`);
  return response.data;
};

export const createCuttingReport = async (data) => {
  const response = await axiosInstance.post(`${BASE}/reports`, data);
  return response.data;
};

export const updateCuttingReport = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/reports/${id}`, data);
  return response.data;
};

// ─── Bundling ────────────────────────────────────────────────────────────────

export const searchBundlingRecords = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/bundling/search`, { params });
  return response.data;
};

export const getBundlingById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/bundling/${id}`);
  return response.data;
};

export const createBundling = async (data) => {
  const response = await axiosInstance.post(`${BASE}/bundling`, data);
  return response.data;
};

export const generateBundles = async (id) => {
  const response = await axiosInstance.post(`${BASE}/bundling/${id}/generate`);
  return response.data;
};

// ─── Bundle Issue ────────────────────────────────────────────────────────────

export const searchBundleIssues = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/bundle-issues/search`, { params });
  return response.data;
};

export const getBundleIssueById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/bundle-issues/${id}`);
  return response.data;
};

export const createBundleIssue = async (data) => {
  const response = await axiosInstance.post(`${BASE}/bundle-issues`, data);
  return response.data;
};

export const getAvailableBundles = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/bundles`, { params: { ...params, status: 'CREATED' } });
  return response.data;
};

// ─── Panel Issue ─────────────────────────────────────────────────────────────

export const searchPanelIssues = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/panel-issues/search`, { params });
  return response.data;
};

export const getPanelIssueById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/panel-issues/${id}`);
  return response.data;
};

export const createPanelIssue = async (data) => {
  const response = await axiosInstance.post(`${BASE}/panel-issues`, data);
  return response.data;
};

// ─── Panel Check ─────────────────────────────────────────────────────────────

export const searchPanelChecks = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/panel-checks/search`, { params });
  return response.data;
};

export const getPanelCheckById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/panel-checks/${id}`);
  return response.data;
};

export const createPanelCheck = async (data) => {
  const response = await axiosInstance.post(`${BASE}/panel-checks`, data);
  return response.data;
};

// ─── Process Return ──────────────────────────────────────────────────────────

export const searchProcessReturns = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/process-returns/search`, { params });
  return response.data;
};

export const getProcessReturnById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/process-returns/${id}`);
  return response.data;
};

export const createProcessReturn = async (data) => {
  const response = await axiosInstance.post(`${BASE}/process-returns`, data);
  return response.data;
};

// ─── Re-Cutting ──────────────────────────────────────────────────────────────

export const searchReCutEntries = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/recutting/search`, { params });
  return response.data;
};

export const getReCutRegisterById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/recutting/${id}`);
  return response.data;
};

export const createReCutEntry = async (data) => {
  const response = await axiosInstance.post(`${BASE}/recutting`, data);
  return response.data;
};

// ─── Wastage Reconciliation ──────────────────────────────────────────────────

export const searchWastageRecords = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/wastage/search`, { params });
  return response.data;
};

export const getWastageById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/wastage/${id}`);
  return response.data;
};

export const createWastage = async (data) => {
  const response = await axiosInstance.post(`${BASE}/wastage`, data);
  return response.data;
};

export const updateWastage = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/wastage/${id}`, data);
  return response.data;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const getCuttingDashboard = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/dashboard`, { params });
  return response.data;
};
