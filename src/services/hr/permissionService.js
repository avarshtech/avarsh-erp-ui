import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/permissions';

/**
 * Permissions: the hour a worker may take off, twice a month.
 *
 * A register, not a pay rule - nothing here reaches payroll. Lateness costs nothing in
 * this system today, so there is nothing for a permission to excuse; see the service
 * on the API side for why that is the consistent choice rather than an unfinished one.
 */

/** A month's permissions. Leave unitId out for every unit. */
export const getPermissions = async (params) => {
  const response = await axiosInstance.get(BASE_URL, { params });
  return response.data;
};

/**
 * What one employee has left this month, and the dates already used.
 *
 * `silent` because the dialog asks for this as soon as an employee is picked, and a
 * failure there should leave the balance blank rather than toast over a form somebody
 * is in the middle of filling.
 */
export const getPermissionBalance = async (employeeId, year, month) => {
  const response = await axiosInstance.get(`${BASE_URL}/balance`, {
    params: { employeeId, year, month },
    silent: true,
  });
  return response.data;
};

export const recordPermission = async (payload) => {
  const response = await axiosInstance.post(BASE_URL, payload);
  return response.data;
};

/** Takes one back, and the units with it. */
export const deletePermission = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};

export const getPermissionPolicy = async () => {
  const response = await axiosInstance.get(`${BASE_URL}/policy`);
  return response.data;
};

export const savePermissionPolicy = async (policy) => {
  const response = await axiosInstance.put(`${BASE_URL}/policy`, policy);
  return response.data;
};
