import axios from 'axios';
import axiosInstance from '../core/axiosInstance';
import { getEmptyPermissions } from '../../utils/permissions';
import { fetchAndCacheOrganisation } from '../admin/organisationService';
import { getMyPermissions } from './permissionsService';
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
import { applyUpdate, checkForUpdate } from '../../utils/swRegistration';

// ── PWA Detection ───────────────────────────────────────────────────────────

const isPwaMode = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: window-controls-overlay)').matches
  || navigator.standalone === true;

const getPwaHeaders = () => (isPwaMode() ? { 'X-Client-Mode': 'pwa' } : {});

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
 *
 * Permissions no longer travel in the JWT (they pushed the Authorization header past
 * Tomcat's 8 KB limit); they are fetched from GET /me/permissions and passed in here.
 *
 * @param {string} token - JWT access token
 * @param {object|null} fallbackUser - Existing user data to merge with
 * @param {object|null} permissions - Permissions map from /me/permissions.
 *   Falls back to the cached user's permissions when omitted.
 * @returns {object} User session object
 */
const buildUserSession = (token, fallbackUser = null, permissions = null) => {
  const payload = decodeToken(token);
  const rawPermissions = permissions ?? fallbackUser?.permissions ?? {};
  const normalizedPermissions = normalizeTokenPermissions(rawPermissions);

  return {
    id: payload.userId || payload.sub || fallbackUser?.id || null,
    username: payload.sub || fallbackUser?.username || '',
    name: payload.name || fallbackUser?.name || '',
    email: payload.email || fallbackUser?.email || '',
    role: payload.role || fallbackUser?.role || '',
    permissions: normalizedPermissions,
    idleTimeoutMinutes: payload.idleTimeoutMinutes || 30,
    idleWarningSeconds: payload.idleWarningSeconds || 120,
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
    const response = await axiosInstance.post('/auth/login', { username, password }, {
      headers: getPwaHeaders(),
    });

    const { data, status } = response;
    if (status !== 200) {
      return { success: false, message: data || `Login failed with status: ${status}` };
    }

    const { token } = data || {};
    if (!token) {
      return { success: false, message: 'Invalid response from server (missing token)' };
    }

    // Store token in memory (NOT in sessionStorage) BEFORE any authenticated call —
    // the axios request interceptor reads it to attach the Authorization header.
    setAccessToken(token);

    // Permissions are no longer a JWT claim; the session is not usable without them.
    let permissions;
    try {
      ({ permissions } = await getMyPermissions());
    } catch {
      // Fail the login rather than proceed with an empty permission set — that would
      // render an app with no menu and no reachable routes, which reads as a broken
      // app rather than a failed sign-in.
      clearAll();
      return {
        success: false,
        message: "Signed in, but couldn't load your permissions. Please try again.",
      };
    }

    const userSession = buildUserSession(
      token,
      { username, email: `${username}@avarsh.com` },
      permissions
    );

    // Cache user display info in localStorage (token field is stripped automatically)
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
 *
 * Logout is also the update boundary for browser tabs: if a new build is waiting in
 * the service worker it is activated here, so the next login always runs the latest
 * code. When that happens the browser navigates to /login and nothing after the
 * applyUpdate() call runs — callers must not rely on this resolving.
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

  // Ask the server one last time rather than trusting the background check —
  // a build deployed minutes ago may not have been picked up yet.
  if (await checkForUpdate()) {
    applyUpdate('/login');
  }
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
        { withCredentials: true, headers: getPwaHeaders() }
      ).then((r) => r.data?.token || null)
    );

    if (!newToken) return false;

    // Store new token in memory BEFORE any authenticated call — the axios request
    // interceptor reads it to attach the Authorization header.
    setAccessToken(newToken);

    const currentUser = getCurrentUser();

    // Permissions are cached from login and only change on re-login, so reuse them
    // rather than paying a request on every refresh cycle. Fetch only when the cache
    // is missing (e.g. bootstrap after storage was cleared). A failure here throws to
    // the outer catch, which returns false — initializeSession then clears the session.
    let permissions = currentUser?.permissions;
    if (!permissions || Object.keys(permissions).length === 0) {
      ({ permissions } = await getMyPermissions());
    }

    const updatedUser = buildUserSession(newToken, currentUser, permissions);

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
