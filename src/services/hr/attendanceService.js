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
 * Get all attendance records for a specific date and optional unit.
 * GET /api/v1/hr/attendance/by-date?date=&unitId=
 */
export const getAttendanceByDate = async (date, unitId) => {
  const params = { date };
  if (unitId) params.unitId = unitId;
  const response = await axiosInstance.get(`${BASE_URL}/by-date`, { params });
  return response.data;
};

/**
 * Lock attendance for a month (prevent further edits).
 * POST /api/v1/hr/attendance/lock?unitId=&month=&year=
 *
 * The API takes query parameters, not a body. This previously POSTed a JSON
 * body, so the call always failed with "Required request parameter 'unitId'
 * is not present".
 */
export const lockAttendanceMonth = async ({ unitId, month, year }) => {
  const response = await axiosInstance.post(`${BASE_URL}/lock`, null, {
    params: { unitId, month, year },
  });
  return response.data;
};

/**
 * Unlock attendance for a month (allow edits again).
 * POST /api/v1/hr/attendance/unlock?unitId=&month=&year=
 */
export const unlockAttendanceMonth = async ({ unitId, month, year }) => {
  const response = await axiosInstance.post(`${BASE_URL}/unlock`, null, {
    params: { unitId, month, year },
  });
  return response.data;
};

/**
 * Attendance totals for one employee over any range.
 * GET /api/v1/hr/attendance/summary?employeeId=&fromDate=&toDate=
 */
export const getAttendanceSummary = async (employeeId, fromDate, toDate) => {
  const response = await axiosInstance.get(`${BASE_URL}/summary`, {
    params: { employeeId, fromDate, toDate },
  });
  return response.data;
};

// ----- spreadsheet import -----

/**
 * Downloads a workbook pre-filled with the unit's active employees.
 * GET /api/v1/hr/attendance/import/template
 */
export const downloadAttendanceTemplate = async ({ unitId, periodFrom, periodTo }) => {
  const response = await axiosInstance.get(`${BASE_URL}/import/template`, {
    params: { unitId, periodFrom, periodTo },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Uploads a file for validation. Nothing is written by this call.
 * POST /api/v1/hr/attendance/import/parse
 */
export const parseAttendanceFile = async ({ file, unitId, periodFrom, periodTo }) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosInstance.post(`${BASE_URL}/import/parse`, formData, {
    params: { unitId, periodFrom, periodTo },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Writes the reviewed rows.
 * POST /api/v1/hr/attendance/import/commit
 */
export const commitAttendanceImport = async (rows, overwriteExisting = false) => {
  const response = await axiosInstance.post(`${BASE_URL}/import/commit`, rows, {
    params: { overwriteExisting },
  });
  return response.data;
};

/** Saves a blob the browser has already received (shared helper, re-exported for existing callers). */
export { triggerBrowserDownload } from '../../utils/download';

/**
 * Lock state for a unit-month.
 * GET /api/v1/hr/attendance/lock?unitId=&month=&year=
 *
 * Returns an unlocked shape when the period has never been locked, so callers
 * get an answer rather than a 404.
 */
export const getAttendanceLock = async (unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/lock`, {
    params: { unitId, month, year },
  });
  return response.data;
};
