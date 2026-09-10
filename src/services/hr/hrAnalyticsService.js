import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/analytics';

/**
 * Why the payroll total moved between two periods.
 * GET /api/v1/hr/analytics/payroll-bridge
 */
export const getPayrollBridge = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/payroll-bridge`, { params });
  return response.data;
};

/**
 * The employees behind one driver of that movement.
 * GET /api/v1/hr/analytics/payroll-bridge/drivers/{code}
 */
export const getPayrollBridgeDriver = async (code, params) => {
  const response = await axiosInstance.get(`${BASE_URL}/payroll-bridge/drivers/${code}`, { params });
  return response.data;
};

/**
 * How the workforce changed over a date range, by factory, department or category.
 * GET /api/v1/hr/analytics/headcount-movement
 */
export const getHeadcountMovement = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/headcount-movement`, { params });
  return response.data;
};

/**
 * The employees behind one cell of that table.
 * GET /api/v1/hr/analytics/headcount-movement/employees
 */
export const getHeadcountEmployees = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/headcount-movement/employees`, { params });
  return response.data;
};

/**
 * Cost per head across a run of periods, split into people and pay.
 * GET /api/v1/hr/analytics/cost-per-head
 */
export const getCostPerHead = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/cost-per-head`, { params });
  return response.data;
};

/**
 * Attendance over a date range, grouped.
 * GET /api/v1/hr/analytics/attendance-summary
 */
export const getAttendanceSummary = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/attendance-summary`, { params });
  return response.data;
};
