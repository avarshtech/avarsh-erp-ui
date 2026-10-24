import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/reports/strength';

/**
 * The daily strength report. Every param is optional: date (YYYY-MM-DD, default today),
 * unitId, joinedFrom / joinedTo (default the 30 days to the date), focus (default Tailor).
 * GET /api/v1/hr/reports/strength
 */
export const getStrengthReport = async (params) => {
  const response = await axiosInstance.get(BASE_URL, { params });
  return response.data;
};

/**
 * The same report as a file, built afresh on the server. format: 'EXCEL' | 'PDF'.
 * GET /api/v1/hr/reports/strength/export
 */
export const exportStrengthReport = async (params, format) => {
  const response = await axiosInstance.get(`${BASE_URL}/export`, {
    params: { ...params, format },
    responseType: 'blob',
  });
  return response.data;
};
