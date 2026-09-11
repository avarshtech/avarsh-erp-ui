import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/ess/me';

/**
 * Everything here is about the signed-in employee.
 *
 * None of these take an employee id, and none should ever be given one - the
 * server resolves who is asking from the session, which is what stops one
 * person reading another's pay.
 */

/** Why this month's pay differs from last month's. */
export const getMyPayComparison = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/pay-comparison`, { params });
  return response.data;
};

/** Payslips for a year, with the year totalled up. */
export const getMyPayslips = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/payslips`, { params });
  return response.data;
};

/** Leave balance as its ledger. */
export const getMyLeaveLedger = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/leave-ledger`, { params });
  return response.data;
};

/** A month of attendance, with the days that cost pay marked. */
export const getMyAttendance = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/attendance`, { params });
  return response.data;
};
