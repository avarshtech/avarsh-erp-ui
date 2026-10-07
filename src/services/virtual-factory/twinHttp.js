import axiosInstance from '../core/axiosInstance';

/**
 * Read-only GET for the Virtual Factory. `silent` keeps the global error toast quiet: the screen
 * reads a dozen sources at once and shows a locked or failed source on its own zone instead.
 */
export const twinGet = (url, params) => axiosInstance.get(url, { params, silent: true }).then((res) => res.data);

/** The newest rows first, a page large enough for the floor but small enough to stay quick. */
export const newest = (size, extra = {}) => ({ page: 0, size, sort: 'id', direction: 'desc', ...extra });
