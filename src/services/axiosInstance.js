import axios from 'axios';
import { message } from 'antd';

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
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
// Return `response.data` so service callers receive the payload directly
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = 'An unexpected error occurred';

    if (error.response) {
      const { status, data } = error.response;

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

      // Handle 401 redirect (except on login page)
      if (status === 401) {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
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
