import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/attendance';

/**
 * Mark attendance for a single employee.
 * POST /api/v1/hr/attendance
 */
export const markAttendance = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Bulk mark attendance for multiple employees on a date.
 * POST /api/v1/hr/attendance/bulk
 */
export const bulkMarkAttendance = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/bulk`, data);
  return response.data;
};

/**
 * Get attendance calendar for an employee for a given month/year.
 * GET /api/v1/hr/attendance/calendar?employeeId=&year=&month=
 */
export const getAttendanceCalendar = async (employeeId, year, month) => {
  const response = await axiosInstance.get(`${BASE_URL}/calendar`, {
    params: { employeeId, year, month },
  });
  return response.data;
};

/**
 * Get all attendance records for a specific date and optional factory.
 * GET /api/v1/hr/attendance/by-date?date=&factoryId=
 */
export const getAttendanceByDate = async (date, factoryId) => {
  const params = { date };
  if (factoryId) params.factoryId = factoryId;
  const response = await axiosInstance.get(`${BASE_URL}/by-date`, { params });
  return response.data;
};

/**
 * Lock attendance for a month (prevent further edits).
 * POST /api/v1/hr/attendance/lock
 */
export const lockAttendanceMonth = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/lock`, data);
  return response.data;
};

/**
 * Unlock attendance for a month (allow edits again).
 * POST /api/v1/hr/attendance/unlock
 */
export const unlockAttendanceMonth = async (data) => {
  const response = await axiosInstance.post(`${BASE_URL}/unlock`, data);
  return response.data;
};
