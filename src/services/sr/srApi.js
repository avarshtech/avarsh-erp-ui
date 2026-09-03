/**
 * Real `/api/v1/sample-*` client — functions are added per cutover stage.
 *
 * srService.js is the only file screens import; it will delegate here instead of
 * to the srMock* modules as each stage lands.
 */
import axiosInstance from '../core/axiosInstance';

/** Every Sample Request endpoint hangs off this path (axiosInstance owns /api/v1). */
export const BASE = '/sample-requests';

/** The configured client every function in this file calls through. */
export const client = axiosInstance;
