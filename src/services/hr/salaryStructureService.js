import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/salary-structures';

/**
 * Get all salary structures for an employee (history).
 * GET /api/v1/hr/salary-structures/by-employee?employeeId=
 */
export const getSalaryStructuresByEmployee = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/by-employee`, {
    params: { employeeId },
  });
  return response.data ?? [];
};

/**
 * Get the current (latest effective) salary structure for an employee.
 * GET /api/v1/hr/salary-structures/current?employeeId=
 */
export const getCurrentSalaryStructure = async (employeeId) => {
  const response = await axiosInstance.get(`${BASE_URL}/current`, {
    params: { employeeId },
  });
  return response.data;
};

/**
 * Create a new salary structure.
 * POST /api/v1/hr/salary-structures
 */
export const createSalaryStructure = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Update an existing salary structure.
 * PUT /api/v1/hr/salary-structures/{id}
 */
export const updateSalaryStructure = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id: Number(id), ...data });
  return response.data;
};
