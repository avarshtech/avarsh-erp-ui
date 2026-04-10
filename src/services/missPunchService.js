import axiosInstance from './axiosInstance';

const BASE_URL = '/hr/miss-punch';

/**
 * Create a miss punch request.
 * POST /api/v1/hr/miss-punch
 */
export const createMissPunch = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Get miss punch requests by status.
 * GET /api/v1/hr/miss-punch/by-status?status=
 */
export const getMissPunchByStatus = async (status) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-status`, {
    params: { status },
  });
  return response.data;
};

/**
 * Get miss punch requests for a specific employee.
 * GET /api/v1/hr/miss-punch/by-employee?employeeId=
 */
export const getMissPunchByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, {
    params: { employeeId },
  });
  return response.data;
};

/**
 * Approve a miss punch request.
 * PUT /api/v1/hr/miss-punch/{id}/approve
 */
export const approveMissPunch = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Reject a miss punch request.
 * PUT /api/v1/hr/miss-punch/{id}/reject
 */
export const rejectMissPunch = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/reject`);
  return response.data;
};
