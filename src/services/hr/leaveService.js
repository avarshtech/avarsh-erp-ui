import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/leaves';

/**
 * Apply for leave.
 * POST /api/v1/hr/leaves/apply
 */
export const applyLeave = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/apply`, data);
  return response.data;
};

/**
 * Approve a leave application.
 * PUT /api/v1/hr/leaves/{id}/approve
 */
export const approveLeave = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Reject a leave application with reason.
 * PUT /api/v1/hr/leaves/{id}/reject?reason=
 */
// The API reads the reason from the request body. Sending it as a query
// parameter left the body empty, and the endpoint rejected the call outright
// with "Required request body is missing".
export const rejectLeave = async (id, reason) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/reject`, { reason });
  return response.data;
};

/**
 * Cancel a leave application.
 * PUT /api/v1/hr/leaves/{id}/cancel
 */
export const cancelLeave = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/cancel`);
  return response.data;
};

/**
 * Get all leave applications for an employee.
 * GET /api/v1/hr/leaves/by-employee?employeeId=
 */
export const getLeavesByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, {
    params: { employeeId },
  });
  return response.data;
};

/**
 * Get leave applications filtered by status.
 * GET /api/v1/hr/leaves/by-status?status=
 */
export const getLeavesByStatus = async (status) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-status`, {
    params: { status },
  });
  return response.data;
};

/**
 * Get leave balances for an employee for a given year.
 * GET /api/v1/hr/leaves/balances?employeeId=&year=
 */
export const getLeaveBalances = async (employeeId, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/balances`, {
    params: { employeeId, year },
  });
  return response.data;
};
