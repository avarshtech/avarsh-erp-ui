import axiosInstance from './axiosInstance';
import { getEmptyPermissions, getOperationsForModule, MODULES } from '../utils/permissions';
import { fetchAndCacheOrganisation, clearCachedOrganisation } from './organisationService';

/**
 * Decode JWT token payload
 * @param {string} token - JWT token
 * @returns {object} Decoded payload
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1] || '';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload || '{}');
  } catch (e) {
    console.error('Failed to decode token payload', e);
    return {};
  }
};

/**
 * Authenticate user with username and password
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, user?: object, message?: string}>}
 */
export const authenticateUser = async (username, password) => {
  try {
    const response = await axiosInstance.post('/auth/login', { username, password });

    const { data, status } = response;
    if (status !== 200) {
      return { success: false, message: data || `Login failed with status: ${status}` };
    }

    const { token } = data || {};
    if (!token) {
      return { success: false, message: 'Invalid response from server (missing token)' };
    }

    // Decode JWT payload
    const payload = decodeToken(token);

    // Normalize permissions from token against known module structure.
    // This ensures that even if the token's permission object has a different
    // shape (e.g., missing modules, extra keys), the app always has every
    // expected module key with its correct operations.
    const rawPermissions = payload.permissions || {};
    const normalizedPermissions = normalizeTokenPermissions(rawPermissions);

    // Build user session from token payload
    const userSession = {
      id: payload.userId || payload.sub || null,
      username: payload.sub || username,
      name: payload.name || username,
      email: payload.email || `${username}@avarsh.com`,
      role: payload.role || '',
      permissions: normalizedPermissions,
      token,
    };

    // Persist session
    setCurrentUser(userSession);
    sessionStorage.setItem('authToken', token);
    window.dispatchEvent(new Event('authChange'));

    // Fetch and cache organisation info in background (no await - fire and forget)
    fetchAndCacheOrganisation().catch(() => {
      // Silently ignore errors - org info will be fetched later if needed
    });

    return { success: true, user: userSession };
  } catch (error) {
    console.error('Login Error:', error);
    return {
      success: false,
      message: error.errorMessage || error.response?.data?.message || 'Network error. Please try again.',
    };
  }
};

/**
 * Get current user from session storage
 * @returns {object|null} Current user object or null
 */
export const getCurrentUser = () => {
  const user = sessionStorage.getItem('currentUser');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

/**
 * Set current user in session storage
 * @param {object} user - User object to store
 */
export const setCurrentUser = (user) => {
  sessionStorage.setItem('currentUser', JSON.stringify(user));
};

/**
 * Get authentication token
 * @returns {string|null} Bearer token or null
 */
export const getToken = () => {
  const sessionToken = sessionStorage.getItem('authToken');
  if (sessionToken) return sessionToken;

  const user = getCurrentUser();
  return user?.token || null;
};

/**
 * Logout user and clear session
 */
export const logoutUser = () => {
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('authToken');
  clearCachedOrganisation();
  window.dispatchEvent(new Event('authChange'));
};

/**
 * Check if user is authenticated (token exists and is not expired)
 * @returns {boolean} True if user is logged in with valid token
 */
export const isAuthenticated = () => {
  const user = sessionStorage.getItem('currentUser');
  const token = sessionStorage.getItem('authToken');
  if (!(user && token)) return false;

  // Check token expiry
  const payload = decodeToken(token);
  if (payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      // Token has expired — clear session
      logoutUser();
      return false;
    }
  }
  return true;
};

/**
 * Get token expiry time in seconds from now.
 * Returns null if no token or no exp claim.
 * @returns {number|null} Seconds until token expires, or null
 */
export const getTokenExpirySeconds = () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload.exp) return null;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now;
};

/**
 * Check if user has a specific permission
 * @param {string} module - Module name
 * @param {string} action - Action name
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (module, action) => {
  const user = getCurrentUser();
  if (!user || !user.permissions) return false;

  const modulePermissions = user.permissions[module];
  if (!modulePermissions) return false;

  return modulePermissions[action] === true;
};

/**
 * Normalize raw permission object from JWT token against the known module structure.
 * Merges incoming permissions with empty template so every module key exists
 * with its applicable operations. Unknown keys from the token are preserved.
 *
 * @param {object} raw - Raw permissions object from decoded JWT
 * @returns {object} Normalized permissions object
 */
const normalizeTokenPermissions = (raw) => {
  if (!raw || typeof raw !== 'object') return getEmptyPermissions();

  const empty = getEmptyPermissions();
  const merged = { ...empty };

  Object.keys(raw).forEach((moduleId) => {
    if (merged[moduleId]) {
      merged[moduleId] = {
        access: !!raw[moduleId]?.access,
        operations: {
          ...merged[moduleId].operations,
          ...(raw[moduleId]?.operations || {}),
        },
      };
    } else {
      // Unknown module from token – carry forward
      merged[moduleId] = raw[moduleId];
    }
  });

  return merged;
};
