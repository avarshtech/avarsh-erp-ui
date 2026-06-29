import axiosInstance from '../core/axiosInstance';

/**
 * Fetch the consolidated home-dashboard summary.
 * GET /api/v1/dashboard/summary
 */
export const getDashboardSummary = async () => {
  const response = await axiosInstance.get('/dashboard/summary');
  return response.data;
};
