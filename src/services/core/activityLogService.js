import axiosInstance from './axiosInstance';

const ENDPOINTS = {
  ACTIVITY_LOGS: '/activity-logs',
};

/**
 * Get all activity logs for a specific user
 */
export const getActivityLogsByUserId = async (userId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.ACTIVITY_LOGS}/user/${userId}`);
  return response.data ?? response;
};

/**
 * Get paginated activity logs for a specific user
 */
export const getActivityLogsByUserIdPaginated = async (userId, params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  const queryString = queryParams.toString();
  const url = queryString
    ? `${ENDPOINTS.ACTIVITY_LOGS}/user/${userId}/paginated?${queryString}`
    : `${ENDPOINTS.ACTIVITY_LOGS}/user/${userId}/paginated`;
  const response = await axiosInstance.get(url);
  return response.data ?? response;
};

/**
 * Get last successful login for a specific user
 */
export const getLastLogin = async (userId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.ACTIVITY_LOGS}/user/${userId}/last-login`);
  return response.data ?? response;
};

/**
 * Get activity logs filtered by date range
 */
export const getActivityLogsByDateRange = async (startDate, endDate) => {
  const queryParams = new URLSearchParams();
  queryParams.append('startDate', startDate);
  queryParams.append('endDate', endDate);
  const response = await axiosInstance.get(`${ENDPOINTS.ACTIVITY_LOGS}/date-range?${queryParams.toString()}`);
  return response.data ?? response;
};
