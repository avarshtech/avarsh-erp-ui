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
 * POST /api/v1/hr/attendance/lock?factoryId=&month=&year=
 *
 * The API takes query parameters, not a body. This previously POSTed a JSON
 * body, so the call always failed with "Required request parameter 'factoryId'
 * is not present".
 */
export const lockAttendanceMonth = async ({ factoryId, month, year }) => {
  const response = await axiosInstance.post(`${BASE_URL}/lock`, null, {
    params: { factoryId, month, year },
  });
  return response.data;
};

/**
 * Unlock attendance for a month (allow edits again).
 * POST /api/v1/hr/attendance/unlock?factoryId=&month=&year=
 */
export const unlockAttendanceMonth = async ({ factoryId, month, year }) => {
  const response = await axiosInstance.post(`${BASE_URL}/unlock`, null, {
    params: { factoryId, month, year },
  });
  return response.data;
};

// ----- spreadsheet import -----

/**
 * Downloads a workbook pre-filled with the factory's active employees.
 * GET /api/v1/hr/attendance/import/template
 */
export const downloadAttendanceTemplate = async ({ factoryId, periodFrom, periodTo }) => {
  const response = await axiosInstance.get(`${BASE_URL}/import/template`, {
    params: { factoryId, periodFrom, periodTo },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Uploads a file for validation. Nothing is written by this call.
 * POST /api/v1/hr/attendance/import/parse
 */
export const parseAttendanceFile = async ({ file, factoryId, periodFrom, periodTo }) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosInstance.post(`${BASE_URL}/import/parse`, formData, {
    params: { factoryId, periodFrom, periodTo },
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

/** Saves a blob the browser has already received. */
export const triggerBrowserDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
