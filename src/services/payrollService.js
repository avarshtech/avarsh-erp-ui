import axiosInstance from './axiosInstance';

const BASE_URL = '/hr/payroll';

/**
 * Get all payroll runs.
 * GET /api/v1/hr/payroll
 */
export const getAllPayrollRuns = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/**
 * Get a single payroll run by ID.
 * GET /api/v1/hr/payroll/{id}
 */
export const getPayrollRunById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Initiate a new payroll run (Draft).
 * POST /api/v1/hr/payroll/initiate
 */
export const initiatePayrollRun = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/initiate`, data);
  return response.data;
};

/**
 * Process salaries for a payroll run.
 * POST /api/v1/hr/payroll/{id}/process
 */
export const processPayrollRun = async (id) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/process`);
  return response.data;
};

/**
 * Approve and finalize a payroll run.
 * POST /api/v1/hr/payroll/{id}/approve
 */
export const approvePayrollRun = async (id) => {
  const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Get salary records for a payroll run.
 * GET /api/v1/hr/payroll/{runId}/records
 */
export const getPayrollRecords = async (runId) => {
  const response = await axiosInstance.get(`${BASE_URL}/${runId}/records`);
  return response.data;
};

/**
 * Get salary slip for a specific payroll record.
 * GET /api/v1/hr/payroll/records/{recordId}/slip
 */
export const getSalarySlip = async (recordId) => {
  const response = await axiosInstance.get(`${BASE_URL}/records/${recordId}/slip`);
  return response.data;
};
