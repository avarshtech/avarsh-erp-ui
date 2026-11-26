import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/reports/salary-register';

/**
 * A month's salary register - every employee paid, every figure that was paid them.
 *
 * `unitId` is optional: leave it out and the register spans every unit that ran that
 * month, which is how the hand-kept workbook covered J1 and B1 on one sheet.
 *
 * GET /api/v1/hr/reports/salary-register?year=&month=&unitId=
 */
export const getSalaryRegister = async (params) => {
  const response = await axiosInstance.get(BASE_URL, { params });
  return response.data;
};

/**
 * The same register as a workbook, built afresh on the server so the file and the
 * screen cannot drift apart.
 *
 * GET /api/v1/hr/reports/salary-register/export?format=EXCEL
 */
export const exportSalaryRegister = async (params) => {
  const response = await axiosInstance.get(`${BASE_URL}/export`, {
    params: { ...params, format: 'EXCEL' },
    responseType: 'blob',
  });
  return response.data;
};
