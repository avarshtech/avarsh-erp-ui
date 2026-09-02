import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/bonus';

/**
 * Process bonus calculation for a factory/period.
 * POST /api/v1/hr/bonus/process
 */
export const processBonus = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/process`, data);
  return response.data;
};

/**
 * Approve a bonus run.
 * POST /api/v1/hr/bonus/{id}/approve
 */
export const approveBonus = async (id) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Get all bonus runs.
 * GET /api/v1/hr/bonus
 */
export const getAllBonusRuns = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/**
 * Get a single bonus run by ID.
 * GET /api/v1/hr/bonus/{id}
 */
export const getBonusRunById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Get bonus records for a run.
 * GET /api/v1/hr/bonus/{id}/records
 */
export const getBonusRecords = async (runId) => {
  const response = await axiosInstance.get(`${BASE_URL}/${runId}/records`);
  return response.data;
};

/**
 * Records that an approved bonus run has been paid.
 * POST /api/v1/hr/bonus/{id}/mark-paid
 */
export const markBonusPaid = async (runId) => {
  const response = await axiosInstance.post(`${BASE_URL}/${runId}/mark-paid`);
  return response.data;
};

/**
 * Abandon a bonus run calculated in error.
 * PUT /api/v1/hr/bonus/{id}/cancel
 *
 * Only while it is CALCULATED. There was no way back at all before, so a run at
 * the wrong rate blocked that factory and year permanently.
 */
export const cancelBonus = async (id, reason) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/cancel`, { reason });
  return response.data;
};
