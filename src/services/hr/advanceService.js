import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/advances';

/**
 * Salary advances.
 *
 * The API for these has existed since the module was written, but nothing in
 * the UI called it: advanceRecovery was deducted on every payslip while
 * advances could not be created, listed or waived from the application.
 */

/** GET /api/v1/hr/advances?status= */
export const getAllAdvances = async (status) => {
  const response = await axiosInstance.get(BASE_URL, { params: status ? { status } : {} });
  return response.data;
};

/** GET /api/v1/hr/advances/by-employee?employeeId= */
export const getAdvancesByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, { params: { employeeId } });
  return response.data;
};

/** GET /api/v1/hr/advances/pending?month=&year= — what the next payroll will recover. */
export const getPendingAdvances = async (month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/pending`, { params: { month, year } });
  return response.data;
};

/** POST /api/v1/hr/advances */
export const createAdvance = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * PUT /api/v1/hr/advances/{id}/recover
 * For an advance settled outside payroll. Payroll marks its own recoveries when
 * a run is approved.
 */
export const recoverAdvance = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/recover`);
  return response.data;
};

/** PUT /api/v1/hr/advances/{id}/waive — write the advance off. */
export const waiveAdvance = async (id) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/waive`);
  return response.data;
};
