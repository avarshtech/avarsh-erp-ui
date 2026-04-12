/**
 * Sewing Production Module API Service
 * All sewing sub-module API calls
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/sewing';

// ─── Sewing Lines ────────────────────────────────────────────────────────────

export const searchSewingLines = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/lines/search`, { params });
  return response.data;
};

export const getSewingLineById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/lines/${id}`);
  return response.data;
};

export const createSewingLine = async (data) => {
  const response = await axiosInstance.post(`${BASE}/lines`, data);
  return response.data;
};

export const updateSewingLine = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/lines/${id}`, data);
  return response.data;
};

export const deleteSewingLine = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/lines/${id}`);
  return response.data;
};

export const getAllActiveLines = async () => {
  const response = await axiosInstance.get(`${BASE}/lines`, { params: { status: 'ACTIVE' } });
  return response.data;
};

// ─── Sewing Operators ────────────────────────────────────────────────────────

export const searchOperators = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/operators/search`, { params });
  return response.data;
};

export const getOperatorById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/operators/${id}`);
  return response.data;
};

export const createOperator = async (data) => {
  const response = await axiosInstance.post(`${BASE}/operators`, data);
  return response.data;
};

export const updateOperator = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/operators/${id}`, data);
  return response.data;
};

export const deleteOperator = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/operators/${id}`);
  return response.data;
};

// ─── SAM Standards ───────────────────────────────────────────────────────────

export const searchSamStandards = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/sam-standards/search`, { params });
  return response.data;
};

export const getSamStandardById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/sam-standards/${id}`);
  return response.data;
};

export const createSamStandard = async (data) => {
  const response = await axiosInstance.post(`${BASE}/sam-standards`, data);
  return response.data;
};

export const updateSamStandard = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/sam-standards/${id}`, data);
  return response.data;
};

export const deleteSamStandard = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/sam-standards/${id}`);
  return response.data;
};

export const getSamByStyle = async (styleId) => {
  const response = await axiosInstance.get(`${BASE}/sam-standards/by-style/${styleId}`);
  return response.data;
};

// ─── Production Plans ────────────────────────────────────────────────────────

export const searchSewingPlans = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/production-plans/search`, { params });
  return response.data;
};

export const getSewingPlanById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/production-plans/${id}`);
  return response.data;
};

export const createSewingPlan = async (data) => {
  const response = await axiosInstance.post(`${BASE}/production-plans`, data);
  return response.data;
};

export const updateSewingPlan = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/production-plans/${id}`, data);
  return response.data;
};

export const changeSewingPlanStatus = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/production-plans/${id}/status`, data);
  return response.data;
};

export const deleteSewingPlan = async (id) => {
  const response = await axiosInstance.delete(`${BASE}/production-plans/${id}`);
  return response.data;
};

// ─── Cut Parts Receipt ───────────────────────────────────────────────────────

export const searchCutPartsReceipts = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/cut-parts-receipts/search`, { params });
  return response.data;
};

export const getCutPartsReceiptById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/cut-parts-receipts/${id}`);
  return response.data;
};

export const createCutPartsReceipt = async (data) => {
  const response = await axiosInstance.post(`${BASE}/cut-parts-receipts`, data);
  return response.data;
};

// ─── Hourly Production ───────────────────────────────────────────────────────

export const searchHourlyProduction = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/hourly-production/search`, { params });
  return response.data;
};

export const getHourlyProductionById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/hourly-production/${id}`);
  return response.data;
};

export const createHourlyProduction = async (data) => {
  const response = await axiosInstance.post(`${BASE}/hourly-production`, data);
  return response.data;
};

export const updateHourlyEntries = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/hourly-production/${id}/entries`, data);
  return response.data;
};

// ─── Garment Issue ───────────────────────────────────────────────────────────

export const searchGarmentIssues = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/garment-issues/search`, { params });
  return response.data;
};

export const getGarmentIssueById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/garment-issues/${id}`);
  return response.data;
};

export const createGarmentIssue = async (data) => {
  const response = await axiosInstance.post(`${BASE}/garment-issues`, data);
  return response.data;
};

// ─── Trim Verification ──────────────────────────────────────────────────────

export const searchTrimVerifications = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/trim-verifications/search`, { params });
  return response.data;
};

export const getTrimVerificationById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/trim-verifications/${id}`);
  return response.data;
};

export const createTrimVerification = async (data) => {
  const response = await axiosInstance.post(`${BASE}/trim-verifications`, data);
  return response.data;
};

// ─── Measurement Report ─────────────────────────────────────────────────────

export const searchMeasurementReports = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/measurement-reports/search`, { params });
  return response.data;
};

export const getMeasurementReportById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/measurement-reports/${id}`);
  return response.data;
};

export const createMeasurementReport = async (data) => {
  const response = await axiosInstance.post(`${BASE}/measurement-reports`, data);
  return response.data;
};

// ─── End-line TOPSE ─────────────────────────────────────────────────────────

export const searchEndlineTopse = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/endline-topse/search`, { params });
  return response.data;
};

export const getEndlineTopseById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/endline-topse/${id}`);
  return response.data;
};

export const createEndlineTopse = async (data) => {
  const response = await axiosInstance.post(`${BASE}/endline-topse`, data);
  return response.data;
};

// ─── Cut Parts Replacement ──────────────────────────────────────────────────

export const searchReplacements = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/cut-parts-replacements/search`, { params });
  return response.data;
};

export const getReplacementById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/cut-parts-replacements/${id}`);
  return response.data;
};

export const createReplacement = async (data) => {
  const response = await axiosInstance.post(`${BASE}/cut-parts-replacements`, data);
  return response.data;
};

export const updateReplacementStatus = async (id, data) => {
  const response = await axiosInstance.put(`${BASE}/cut-parts-replacements/${id}/status`, data);
  return response.data;
};

// ─── Operator Skills ─────────────────────────────────────────────────────────

export const getOperatorSkills = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/operator-skills`, { params });
  return response.data;
};

export const updateOperatorSkills = async (operatorId, data) => {
  const response = await axiosInstance.put(`${BASE}/operator-skills/${operatorId}`, data);
  return response.data;
};

// ─── Incentive Calculation ──────────────────────────────────────────────────

export const searchIncentives = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/incentive-calculations/search`, { params });
  return response.data;
};

export const getIncentiveById = async (id) => {
  const response = await axiosInstance.get(`${BASE}/incentive-calculations/${id}`);
  return response.data;
};

export const createIncentive = async (data) => {
  const response = await axiosInstance.post(`${BASE}/incentive-calculations`, data);
  return response.data;
};

export const approveIncentive = async (id) => {
  const response = await axiosInstance.put(`${BASE}/incentive-calculations/${id}/approve`);
  return response.data;
};

// ─── Dashboards ──────────────────────────────────────────────────────────────

export const getSewingFloorDashboard = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/dashboard/floor`, { params });
  return response.data;
};

export const getSewingQualityDashboard = async (params = {}) => {
  const response = await axiosInstance.get(`${BASE}/dashboard/quality`, { params });
  return response.data;
};
