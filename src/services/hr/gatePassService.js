import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/gate-pass';

/**
 * Create a gate pass request.
 * POST /api/v1/hr/gate-pass
 */
export const createGatePass = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Get gate pass requests by status.
 * GET /api/v1/hr/gate-pass/by-status?status=
 */
export const getGatePassByStatus = async (status) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-status`, {
    params: { status },
  });
  return response.data;
};

/**
 * Get gate pass requests for a specific employee.
 * GET /api/v1/hr/gate-pass/by-employee?employeeId=
 */
export const getGatePassByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, {
    params: { employeeId },
  });
  return response.data;
};

/**
 * Approve a gate pass request.
 * PUT /api/v1/hr/gate-pass/{id}/approve
 */
export const approveGatePass = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Reject a gate pass request.
 * PUT /api/v1/hr/gate-pass/{id}/reject
 */
export const rejectGatePass = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/reject`);
  return response.data;
};
