import axiosInstance from '../core/axiosInstance';

// ── EL Encashment ──

/**
 * Process EL encashment for a factory/year.
 * POST /api/v1/hr/el-encashment/process
 */
export const processElEncashment = async (data) => {
  const response = await axiosInstance.post('/hr/el-encashment/process', data);
  return response.data;
};

/**
 * Approve an EL encashment run.
 * POST /api/v1/hr/el-encashment/{id}/approve
 */
export const approveElEncashment = async (id) => {
  const response = await axiosInstance.post(`/hr/el-encashment/${id}/approve`);
  return response.data;
};

/**
 * Get all EL encashment runs.
 * GET /api/v1/hr/el-encashment
 */
export const getAllElEncashmentRuns = async () => {
  const response = await axiosInstance.get('/hr/el-encashment');
  return response.data;
};

/**
 * Get EL encashment records for a run.
 * GET /api/v1/hr/el-encashment/{id}/records
 */
export const getElEncashmentRecords = async (runId) => {
  const response = await axiosInstance.get(`/hr/el-encashment/${runId}/records`);
  return response.data;
};

// ── PT Returns ──

/**
 * One EL encashment run.
 * GET /api/v1/hr/el-encashment/{id}
 */
export const getElEncashmentRunById = async (id) => {
  const response = await axiosInstance.get(`/hr/el-encashment/${id}`);
  return response.data;
};

/**
 * Records that an approved encashment run has been paid.
 * POST /api/v1/hr/el-encashment/{id}/mark-paid
 */
export const markElEncashmentPaid = async (id) => {
  const response = await axiosInstance.post(`/hr/el-encashment/${id}/mark-paid`);
  return response.data;
};

/**
 * Generate a PT return for a factory/period.
 * POST /api/v1/hr/pt-returns/generate
 */
export const generatePtReturn = async (data) => {
  const response = await axiosInstance.post('/hr/pt-returns/generate', data);
  return response.data;
};

/**
 * Mark a PT return as filed.
 * POST /api/v1/hr/pt-returns/{id}/file
 */
export const filePtReturn = async (id) => {
  const response = await axiosInstance.post(`/hr/pt-returns/${id}/file`);
  return response.data;
};

/**
 * Get all PT returns.
 * GET /api/v1/hr/pt-returns
 */
export const getAllPtReturns = async () => {
  const response = await axiosInstance.get('/hr/pt-returns');
  return response.data;
};

/**
 * Get PT return records for a return.
 * GET /api/v1/hr/pt-returns/{id}/records
 */
export const getPtReturnRecords = async (returnId) => {
  const response = await axiosInstance.get(`/hr/pt-returns/${returnId}/records`);
  return response.data;
};
