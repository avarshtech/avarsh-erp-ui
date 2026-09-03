import axiosInstance from '../core/axiosInstance';

/**
 * Permissions API
 *
 * Permissions used to arrive as a JWT claim. They were moved to an endpoint because
 * the map grows with every module — at ~60 modules the Super Admin token reached
 * ~7.2 KB, pushing the Authorization header past Tomcat's 8 KB limit. Tomcat then
 * rejected every authenticated request with a bare 400 carrying no CORS headers,
 * which the browser reported as a CORS error.
 *
 * Requires the access token to already be in the in-memory store — the axios request
 * interceptor reads it to attach the Authorization header.
 */

/**
 * Fetch the authenticated user's role and permissions.
 * @returns {Promise<{role: string, permissions: object}>}
 */
export const getMyPermissions = async () => {
  const response = await axiosInstance.get('/me/permissions');
  return response.data;
};

export default { getMyPermissions };
