import axiosInstance from './axiosInstance';

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
