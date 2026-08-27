import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/loans';

/**
 * Search loans with filters and pagination.
 * GET /api/v1/hr/loans
 *
 * Every filter is optional; calling with no params returns the full register.
 */
export const searchLoans = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.append('search', params.search);
  if (params.employeeId) queryParams.append('employeeId', params.employeeId);
  if (params.status) queryParams.append('status', params.status);
  if (params.fromDate) queryParams.append('fromDate', params.fromDate);
  if (params.toDate) queryParams.append('toDate', params.toDate);
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.direction) queryParams.append('direction', params.direction);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}${queryString ? `?${queryString}` : ''}`;
  const response = await axiosInstance.get(url);
  const data = response.data;

  // Normalize pagination fields for frontend compatibility
  return {
    content: data.content || [],
    totalElements: data.totalElements || 0,
    totalPages: data.totalPages || 0,
    size: data.pageSize ?? data.size ?? 25,
    number: data.pageNumber ?? data.number ?? 0,
    last: data.last,
  };
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

/**
 * Records a repayment made outside payroll — cash, early settlement or a
 * correction. Payroll creates its own recovery rows for the monthly EMI.
 * POST /api/v1/hr/loans/{id}/recoveries
 */
/**
 * Repayment schedule for a loan.
 * GET /api/v1/hr/loans/{id}/recoveries
 *
 * Recoveries are a separate resource - LoanDTO does not carry them. The detail
 * view read loan.recoveries, which is always undefined, so the schedule showed
 * as empty no matter how many repayments had been taken.
 */
export const getLoanRecoveries = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}/recoveries`);
  return response.data;
};

export const recordLoanRecovery = async (loanId, { amount, recoveryDate, remarks }) => {
  const response = await axiosInstance.post(`${BASE_URL}/${loanId}/recoveries`, {
    amount, recoveryDate, remarks,
  });
  return response.data;
};
