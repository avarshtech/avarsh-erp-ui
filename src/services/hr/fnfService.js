import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/fnf';

/**
 * Calculate F&F settlement for an employee.
 * POST /api/v1/hr/fnf/calculate
 */
export const calculateFnf = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/calculate`, data);
  return response.data;
};

/**
 * Approve a F&F settlement.
 * POST /api/v1/hr/fnf/{id}/approve
 */
export const approveFnf = async (id) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Settle (finalize) a F&F settlement.
 * POST /api/v1/hr/fnf/{id}/settle
 */
export const settleFnf = async (id) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/settle`);
  return response.data;
};

/**
 * Get all F&F settlements.
 * GET /api/v1/hr/fnf
 */
export const getAllFnfSettlements = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/**
 * Get a single F&F settlement by ID.
 * GET /api/v1/hr/fnf/{id}
 */
export const getFnfById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Save user overrides on a settlement.
 * PUT /api/v1/hr/fnf/{id}
 *
 * The form's amount fields had no endpoint behind them until this existed, so
 * edits were discarded on approve. Totals are recomputed server-side; whatever
 * this sends for them is ignored.
 */
export const updateFnf = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, data);
  return response.data;
};

/**
 * Abandon a settlement calculated in error.
 * POST /api/v1/hr/fnf/{id}/cancel
 *
 * Only before approval. Settling marks the employee inactive and records their
 * leaving date, so undoing that is a reversal, not a cancellation.
 */
export const cancelFnf = async (id, reason) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/cancel`, { reason });
  return response.data;
};

/**
 * Recompute a settlement from the source data as it stands now.
 * POST /api/v1/hr/fnf/{id}/recalculate
 *
 * Loans, leave balances, advances and the salary structure all keep moving
 * after a settlement is first calculated. Pass a last working date or
 * separation reason to correct those at the same time. Manual overrides are
 * replaced - they adjusted a calculation that no longer stands.
 */
export const recalculateFnf = async (id, changes) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/recalculate`, changes || {});
  return response.data;
};
