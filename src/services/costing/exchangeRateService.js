import axiosInstance from '../core/axiosInstance';

/**
 * The stored rate the server will save the cost sheet with — {rate, date, source} — or null
 * when none is stored (404), so the sheet can ask for one instead of guessing.
 */
export const getStoredRate = async (from, to) => {
  if (!from || !to || from === to) return { rate: 1, date: null, source: 'SAME' };
  try {
    const { data } = await axiosInstance.get('/exchange-rates/today', { params: { from, to }, silent: true });
    return data?.rate ? data : null;
  } catch {
    return null;
  }
};
