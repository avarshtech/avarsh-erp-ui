import axios from 'axios';
import { message } from 'antd';
// Import directly from sessionStore (not authService) to avoid circular dependencies
import { getAccessToken, setAccessToken, clearAll } from './sessionStore';

/**
 * Axios instance configuration for API requests
 * Includes interceptors for auth token and error handling
 */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Track whether a token refresh is already in progress
let isRefreshing = false;
let refreshSubscribers = [];

// Request interceptor to add auth token from in-memory store
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to queue failed requests while refresh is in progress
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

const onTokenRefreshFailed = () => {
  refreshSubscribers.forEach((cb) => cb(null));
  refreshSubscribers = [];
};

// Response interceptor for error handling
// Return full response object so service callers can access status, headers, and data
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    let errorMessage = 'An unexpected error occurred';
    const originalRequest = error.config;

    if (error.response) {
      const { status, data } = error.response;

      // Attempt token refresh on 401 (except for login/refresh/logout endpoints)
      if (
        status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/login') &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/logout') &&
        !window.location.pathname.includes('/login')
      ) {
        if (isRefreshing) {
          // Another refresh is in progress — queue this request
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newToken) => {
              if (newToken) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                resolve(axiosInstance(originalRequest));
              } else {
                reject(error);
              }
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Refresh token is sent automatically via HttpOnly cookie (withCredentials: true)
          // No request body needed — the backend reads the cookie directly
          const refreshResponse = await axios.post(
            `${axiosInstance.defaults.baseURL}/auth/refresh`,
            null,
            { withCredentials: true }
          );

          const newToken = refreshResponse.data?.token;
          if (newToken) {
            // Store new token in memory (NOT in sessionStorage)
            setAccessToken(newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            onTokenRefreshed(newToken);
            isRefreshing = false;
            return axiosInstance(originalRequest);
          }
        } catch {
          onTokenRefreshFailed();
          isRefreshing = false;
        }

        // Refresh failed — clear all session state
        clearAll();
        // Don't hard-redirect — let SessionExpiryGuard handle the expired state
        error.errorMessage = 'Session expired. Please login again.';
        return Promise.reject(error);
      }

      // Extract message from response data
      if (data) {
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors.join(', ');
        }
      }

      // Set default messages if no message extracted
      if (!data?.message && !data?.error) {
        switch (status) {
          case 401:
            errorMessage = 'Session expired. Please login again.';
            break;
          case 403:
            errorMessage = 'Access denied. You do not have permission.';
            break;
          case 404:
            errorMessage = 'Resource not found.';
            break;
          case 409:
            errorMessage = 'A conflict occurred. The resource may already exist.';
            break;
          case 422:
            errorMessage = 'Validation failed. Please check your input.';
            break;
          case 500:
            errorMessage = 'Server error occurred. Please try again later.';
            break;
          default:
            break;
        }
      }
    } else if (error.request) {
      errorMessage = 'Network error - please check your connection';
    }

    // Attach extracted message to error object
    error.errorMessage = errorMessage;

    // Show error toast for non-401 errors
    if (!error.response || error.response.status !== 401) {
      message.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

/**
 * File upload wrapper (multipart/form-data)
 */
export const upload = async (url, formData, onProgress = null) => {
  const config = {
    headers: { 'Content-Type': 'multipart/form-data' },
  };

  if (onProgress) {
    config.onUploadProgress = (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onProgress(percentCompleted);
    };
  }

  const response = await axiosInstance.post(url, formData, config);
  return response.data;
};

export default axiosInstance;
