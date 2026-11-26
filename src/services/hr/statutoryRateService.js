import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/statutory-rates';

/**
 * The figures payroll runs on: PF and ESI rates and ceilings, bonus and gratuity
 * limits, and the working days a month's wage is divided by.
 *
 * The rows have always been effective-dated and payroll has always read the right
 * one for the month it is running. What was missing was any way to write one - the
 * PF ceiling was changed by connecting to the database.
 */

/** GET /api/v1/hr/statutory-rates */
export const getAllStatutoryRates = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/** POST /api/v1/hr/statutory-rates */
export const createStatutoryRate = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/** PUT /api/v1/hr/statutory-rates/{id} */
export const updateStatutoryRate = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

/** DELETE /api/v1/hr/statutory-rates/{id} */
export const deleteStatutoryRate = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
