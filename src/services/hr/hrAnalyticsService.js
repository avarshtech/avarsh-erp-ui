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
