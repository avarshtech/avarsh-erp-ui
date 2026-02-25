/**
 * Secure In-Memory Session Store
 *
 * Stores sensitive credentials (access token, session ID) in JavaScript closures
 * instead of sessionStorage, preventing XSS from reading them via storage APIs.
 *
 * Non-credential display data (user name, role, permissions) is cached in
 * sessionStorage WITHOUT the token field for instant UI rendering on page refresh.
 *
 * This module has ZERO imports to prevent circular dependency issues.
 */

// ── Private in-memory state (not accessible via browser storage APIs) ────────

let _accessToken = null;
let _sessionId = null;
let _orgInfo = null;
let _tokenExp = null;

// ── JWT Decode Helper (self-contained) ──────────────────────────────────────

const decodeTokenPayload = (token) => {
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
  } catch {
    return {};
  }
};

// ── Access Token Management ─────────────────────────────────────────────────

/**
 * Store the access token in memory and extract session metadata from the JWT.
 * @param {string|null} token - JWT access token
 */
export const setAccessToken = (token) => {
  _accessToken = token;
  if (token) {
    const payload = decodeTokenPayload(token);
    _sessionId = payload.sessionId || null;
    _tokenExp = payload.exp || null;
  } else {
    _sessionId = null;
    _tokenExp = null;
  }
};

/** @returns {string|null} The in-memory access token */
export const getAccessToken = () => _accessToken;

/** @returns {string|null} The session ID extracted from the JWT */
export const getSessionId = () => _sessionId;

/**
 * Seconds until the access token expires.
 * @returns {number|null} Seconds remaining, or null if no token/no exp claim
 */
export const getTokenExpirySeconds = () => {
  if (!_tokenExp) return null;
  return _tokenExp - Math.floor(Date.now() / 1000);
};

/**
 * Check if an access token is present in memory and not yet expired.
 * @returns {boolean}
 */
export const isTokenValid = () => {
  if (!_accessToken) return false;
  const secs = getTokenExpirySeconds();
  return secs !== null && secs > 0;
};

/**
 * Decode and return the full JWT payload.
 * Useful when the caller needs claims beyond session ID / exp.
 * @param {string} token - JWT access token
 * @returns {object} Decoded payload
 */
export const decodeToken = (token) => decodeTokenPayload(token);

// ── Organisation Info Cache (in-memory only) ────────────────────────────────

/** @param {object|null} org */
export const setOrgInfo = (org) => { _orgInfo = org; };

/** @returns {object|null} */
export const getOrgInfo = () => _orgInfo;

// ── Session Active Flag (sessionStorage — non-sensitive boolean) ────────────

export const setSessionActiveFlag = () => {
  sessionStorage.setItem('sessionActive', 'true');
};

export const hasSessionActiveFlag = () => {
  return sessionStorage.getItem('sessionActive') === 'true';
};

export const clearSessionActiveFlag = () => {
  sessionStorage.removeItem('sessionActive');
};

// ── User Display Cache (sessionStorage — token field stripped) ───────────────

/**
 * Cache user display info (name, role, permissions) in sessionStorage.
 * The `token` field is explicitly removed before writing.
 * @param {object} user
 */
export const cacheUserDisplay = (user) => {
  if (!user) return;
  const { token, ...displayData } = user;
  sessionStorage.setItem('currentUser', JSON.stringify(displayData));
};

/**
 * Read the cached user display object from sessionStorage.
 * @returns {object|null}
 */
export const getCachedUserDisplay = () => {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ── Shared Refresh Lock (prevents concurrent refresh calls) ─────────────

let _refreshPromise = null;

/**
 * Execute a token refresh with deduplication.
 * If a refresh is already in progress, returns the existing promise
 * instead of starting a new one. This prevents race conditions between
 * the axios interceptor and SessionContext proactive refresh.
 *
 * @param {() => Promise<string|null>} refreshFn - Function that performs the refresh API call and returns the new token or null
 * @returns {Promise<string|null>} The new access token, or null on failure
 */
export const executeTokenRefresh = (refreshFn) => {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = refreshFn().catch(() => null).finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
};

/** @returns {boolean} True if a refresh is currently in progress */
export const isRefreshInProgress = () => _refreshPromise !== null;

/** @returns {Promise<string|null>|null} The current refresh promise, if any */
export const getRefreshPromise = () => _refreshPromise;

// ── Full Clear (logout / session expiry) ────────────────────────────────────

/**
 * Wipe all session state — both in-memory and sessionStorage.
 * Also removes legacy keys from the previous implementation.
 */
export const clearAll = () => {
  _accessToken = null;
  _sessionId = null;
  _orgInfo = null;
  _tokenExp = null;

  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('sessionActive');

  // Legacy key cleanup (from previous sessionStorage-based implementation)
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('organisationInfo');
};
