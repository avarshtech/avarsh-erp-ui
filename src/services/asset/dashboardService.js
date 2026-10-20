import axiosInstance from '../core/axiosInstance';

const DASHBOARD = '/assets/dashboard';

/**
 * Every figure on the asset landing screen in one call.
 *
 * The server counts in the database and returns the tallies, the pending queues
 * and the recent movements together. Nine round trips to draw one screen is how
 * a dashboard becomes the slowest page in a module.
 */
export const getAssetDashboard = async () => (await axiosInstance.get(DASHBOARD)).data;
