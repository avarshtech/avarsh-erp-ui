import axios from 'axios';
import axiosInstance from './axiosInstance';
import { getEmptyPermissions } from '../utils/permissions';
import { fetchAndCacheOrganisation } from './organisationService';
import {
  setAccessToken,
  getAccessToken,
  isTokenValid,
  getTokenExpirySeconds as storeGetTokenExpirySeconds,
  decodeToken,
  cacheUserDisplay,
  getCachedUserDisplay,
  setSessionActiveFlag,
  hasSessionActiveFlag,
  clearAll,
  executeTokenRefresh,
} from './sessionStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Build a user session object from a JWT and optional fallback user data.
 * @param {string} token - JWT access token
 * @param {object|null} fallbackUser - Existing user data to merge with
 * @returns {object} User session object
 */
const buildUserSession = (token, fallbackUser = null) => {
  const payload = decodeToken(token);
  const rawPermissions = payload.permissions || {};
  const normalizedPermissions = normalizeTokenPermissions(rawPermissions);

  return {
    id: payload.userId || payload.sub || fallbackUser?.id || null,
    username: payload.sub || fallbackUser?.username || '',
    name: payload.name || fallbackUser?.name || '',
    email: payload.email || fallbackUser?.email || '',
    role: payload.role || fallbackUser?.role || '',
    permissions: normalizedPermissions,
    token, // included in the in-memory object; stripped by cacheUserDisplay before sessionStorage
  };
};

// ── Authentication ──────────────────────────────────────────────────────────

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

    const userSession = buildUserSession(token, { username, email: `${username}@avarsh.com` });

    // Store token in memory (NOT in sessionStorage)
    setAccessToken(token);
    // Cache user display info in sessionStorage (token field is stripped automatically)
    cacheUserDisplay(userSession);
    // Mark that this tab has an active session (for page-refresh bootstrap)
    setSessionActiveFlag();

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

// ── Session Accessors ───────────────────────────────────────────────────────

/**
 * Get current user display info from the session cache.
 * @returns {object|null} Current user object or null
 */
export const getCurrentUser = () => getCachedUserDisplay();

/**
 * Update the cached user display info.
 * @param {object} user - User object to cache
 */
export const setCurrentUser = (user) => cacheUserDisplay(user);

/**
 * Get the in-memory access token.
 * @returns {string|null} Bearer token or null
 */
export const getToken = () => getAccessToken();

// ── Logout ──────────────────────────────────────────────────────────────────

/**
 * Logout user and clear session.
 * Calls the backend logout endpoint to revoke the refresh token and clear the HttpOnly cookie,
 * then clears the client-side session. Errors from the backend call are handled silently
 * to ensure the client-side cleanup always runs.
 */
export const logoutUser = async () => {
  // Attempt server-side logout to revoke refresh token and clear the HttpOnly cookie.
  try {
    await axiosInstance.post('/auth/logout');
  } catch {
    // Silently ignore — the session is being cleared client-side regardless
  }

  clearAll();
  window.dispatchEvent(new Event('authChange'));
};

// ── Session State Checks ────────────────────────────────────────────────────

/**
 * Check if user is authenticated (token exists in memory and is not expired).
 * @returns {boolean} True if user is logged in with valid token
 */
export const isAuthenticated = () => {
  if (isTokenValid()) return true;

  // If the in-memory token is gone or expired, check if we have cached user display
  // data — if so, the session may still be bootstrappable via refresh cookie.
  // However, this function answers "is the user authenticated RIGHT NOW",
  // so we return false and let the caller decide whether to attempt a refresh.
  return false;
};

/**
 * Get token expiry time in seconds from now.
 * @returns {number|null} Seconds until token expires, or null
 */
export const getTokenExpirySeconds = () => storeGetTokenExpirySeconds();

// ── Permissions ─────────────────────────────────────────────────────────────

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

// ── Token Refresh ───────────────────────────────────────────────────────────

/**
 * Refresh the session using the HttpOnly refresh token cookie.
 * The browser sends the cookie automatically with the request (withCredentials: true).
 * Updates the in-memory access token and cached user session on success.
 * @returns {Promise<boolean>} True if refresh succeeded
 */
export const refreshSession = async () => {
  try {
    // Use the shared lock to prevent concurrent refresh calls
    // (e.g., SessionContext proactive refresh vs. axios interceptor refresh).
    // Uses raw `axios` (NOT axiosInstance) so the request interceptor does NOT
    // add the Authorization header — the JWT filter would reject an expired
    // access token before the refresh endpoint is reached.
    const newToken = await executeTokenRefresh(() =>
      axios.post(
        `${axiosInstance.defaults.baseURL}/auth/refresh`,
        null,
        { withCredentials: true }
      ).then((r) => r.data?.token || null)
    );

    if (!newToken) return false;

    const currentUser = getCurrentUser();
    const updatedUser = buildUserSession(newToken, currentUser);

    // Store new token in memory
    setAccessToken(newToken);
    // Update cached user display info
    cacheUserDisplay(updatedUser);
    // Ensure the session active flag is set
    setSessionActiveFlag();

    // Refresh token rotation is handled server-side via Set-Cookie header.
    // The browser updates the HttpOnly cookie automatically.

    window.dispatchEvent(new Event('authChange'));
    return true;
  } catch {
    return false;
  }
};

// ── Session Initialization (page refresh bootstrap) ─────────────────────────

// Serialization promise to prevent concurrent initializeSession calls
let _initPromise = null;

/**
 * Initialize the session on page load / refresh.
 * If the in-memory token is already valid, returns immediately.
 * If a `sessionActive` flag exists in sessionStorage, attempts to restore the session
 * by calling the refresh endpoint (the HttpOnly cookie is sent automatically).
 * @returns {Promise<boolean>} True if session was successfully initialized
 */
export const initializeSession = async () => {
  // Fast path: token already in memory and valid
  if (isTokenValid()) return true;

  // No session flag means no refresh cookie is expected
  if (!hasSessionActiveFlag()) return false;

  // Serialize concurrent calls (e.g., ProtectedRoute + Login both calling on F5)
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const success = await refreshSession();
      if (success) {
        // Re-fetch org info into in-memory cache
        fetchAndCacheOrganisation().catch(() => {});
        return true;
      }

      // Refresh failed — clear everything
      clearAll();
      window.dispatchEvent(new Event('authChange'));
      return false;
    } finally {
      _initPromise = null;
    }
  })();

  return _initPromise;
};

// ── Admin Utilities ─────────────────────────────────────────────────────────

/**
 * Admin reset password for a user
 * @param {Object} data - { userId, newPassword }
 * @returns {Promise<Object>} Response
 */
export const adminResetPassword = async (data) => {
  const response = await axiosInstance.post('/admin/reset-password', data);
  return response.data ?? response;
};
