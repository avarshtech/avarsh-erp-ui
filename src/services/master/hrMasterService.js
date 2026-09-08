import axiosInstance from '../core/axiosInstance';

// ── Departments ──

const DEPT_URL = '/hr/departments';

export const getAllDepartments = async () => {
  const response = await axiosInstance.get(DEPT_URL);
  return response.data;
};

export const getActiveDepartments = async () => {
  const response = await axiosInstance.get(`${DEPT_URL}/active`);
  return response.data;
};

export const getActiveDepartmentsByFactory = async (factoryId) => {
  const response = await axiosInstance.get(`${DEPT_URL}/active`, { params: { factoryId } });
  return response.data;
};

export const createDepartment = async (data) => {
  const response = await axiosInstance.post(DEPT_URL, data);
  return response.data;
};

export const updateDepartment = async (id, data) => {
  const response = await axiosInstance.put(`${DEPT_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteDepartment = async (id) => {
  const response = await axiosInstance.delete(`${DEPT_URL}/${id}`);
  return response.data;
};

// ── Designations ──

const DESIG_URL = '/hr/designations';

export const getAllDesignations = async () => {
  const response = await axiosInstance.get(DESIG_URL);
  return response.data;
};

export const getActiveDesignations = async () => {
  const response = await axiosInstance.get(`${DESIG_URL}/active`);
  return response.data;
};

export const getActiveDesignationsByDepartment = async (deptId) => {
  const response = await axiosInstance.get(`${DESIG_URL}/active`, { params: { departmentId: deptId } });
  return response.data;
};

export const createDesignation = async (data) => {
  const response = await axiosInstance.post(DESIG_URL, data);
  return response.data;
};

export const updateDesignation = async (id, data) => {
  const response = await axiosInstance.put(`${DESIG_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteDesignation = async (id) => {
  const response = await axiosInstance.delete(`${DESIG_URL}/${id}`);
  return response.data;
};

// ── Shifts ──

const SHIFT_URL = '/hr/shifts';

export const getAllShifts = async () => {
  const response = await axiosInstance.get(SHIFT_URL);
  return response.data;
};

export const getActiveShifts = async () => {
  const response = await axiosInstance.get(`${SHIFT_URL}/active`);
  return response.data;
};

export const createShift = async (data) => {
  const response = await axiosInstance.post(SHIFT_URL, data);
  return response.data;
};

export const updateShift = async (id, data) => {
  const response = await axiosInstance.put(`${SHIFT_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteShift = async (id) => {
  const response = await axiosInstance.delete(`${SHIFT_URL}/${id}`);
  return response.data;
};

// ── Holidays ──

const HOLIDAY_URL = '/hr/holidays';

export const getAllHolidays = async () => {
  const response = await axiosInstance.get(HOLIDAY_URL);
  return response.data;
};

// GET /hr/holidays/by-year — the root mapping takes no params, so sending
// ?year= there was silently ignored and returned every holiday.
export const getHolidaysByYear = async (year, factoryId) => {
  const params = { year };
  if (factoryId) params.factoryId = factoryId;
  const response = await axiosInstance.get(`${HOLIDAY_URL}/by-year`, { params });
  return response.data;
};

export const createHoliday = async (data) => {
  const response = await axiosInstance.post(HOLIDAY_URL, data);
  return response.data;
};

export const updateHoliday = async (id, data) => {
  const response = await axiosInstance.put(`${HOLIDAY_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteHoliday = async (id) => {
  const response = await axiosInstance.delete(`${HOLIDAY_URL}/${id}`);
  return response.data;
};

// ── Leave Types ──

const LEAVE_TYPE_URL = '/hr/leave-types';

export const getAllLeaveTypes = async () => {
  const response = await axiosInstance.get(LEAVE_TYPE_URL);
  return response.data;
};

export const getActiveLeaveTypes = async () => {
  const response = await axiosInstance.get(`${LEAVE_TYPE_URL}/active`);
  return response.data;
};

export const createLeaveType = async (data) => {
  const response = await axiosInstance.post(LEAVE_TYPE_URL, data);
  return response.data;
};

export const updateLeaveType = async (id, data) => {
  const response = await axiosInstance.put(`${LEAVE_TYPE_URL}/${id}`, { id, ...data });
  return response.data;
};

export const deleteLeaveType = async (id) => {
  const response = await axiosInstance.delete(`${LEAVE_TYPE_URL}/${id}`);
  return response.data;
};
