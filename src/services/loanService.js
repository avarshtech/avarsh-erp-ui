import axiosInstance from './axiosInstance';

const BASE_URL = '/hr/loans';

/**
 * Get all loans.
 * GET /api/v1/hr/loans
 */
export const getAllLoans = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/**
 * Get loans for a specific employee.
 * GET /api/v1/hr/loans/by-employee?employeeId=
 */
export const getLoansByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, {
    params: { employeeId },
  });
  return response.data;
};

/**
 * Get a single loan by ID.
 * GET /api/v1/hr/loans/{id}
 */
export const getLoanById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Create a new loan.
 * POST /api/v1/hr/loans
 */
export const createLoan = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Close an active loan.
 * PUT /api/v1/hr/loans/{id}/close
 */
export const closeLoan = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/close`);
  return response.data;
};

/**
 * Cancel an active loan.
 * PUT /api/v1/hr/loans/{id}/cancel
 */
export const cancelLoan = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/cancel`);
  return response.data;
};
