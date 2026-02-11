import axiosInstance from './axiosInstance';

/**
 * User API Service
 * Contains all API methods for User operations
 */

const ENDPOINTS = {
  USERS: '/users',
};

/**
 * Get all users with optional pagination
 * @param {Object} params - Query parameters (page, size, sort)
 * @returns {Promise<Object>} Response with users array
 */
export const getUsers = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) {
    queryParams.append('sort', params.sort);
    queryParams.append('sort', params.direction || 'asc');
  }
  const queryString = queryParams.toString();
  const url = queryString ? `${ENDPOINTS.USERS}?${queryString}` : ENDPOINTS.USERS;
  const response = await axiosInstance.get(url);
  return response.data;
};

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User object
 */
export const getUserById = async (userId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.USERS}/${userId}`);
  return response.data;
};

/**
 * Create a new user
 * @param {Object} userData - User data to create
 * @returns {Promise<Object>} Response with created user
 */
export const createUser = async (userData) => {
  const response = await axiosInstance.post(ENDPOINTS.USERS, userData);
  return response.data;
};

/**
 * Update an existing user
 * @param {number} userId - ID of user to update
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Response with updated user
 */
export const updateUser = async (userId, userData) => {
  const response = await axiosInstance.put(`${ENDPOINTS.USERS}/${userId}`, userData);
  return response.data;
};

/**
 * Save user (create or update)
 * Uses POST with id in body for update
 * @param {Object} userData - User data (include id for update)
 * @returns {Promise<Object>} Response with saved user
 */
export const saveUser = async (userData) => {
  const response = await axiosInstance.post(ENDPOINTS.USERS, userData);
  return response.data;
};

/**
 * Delete a user
 * @param {number} userId - ID of user to delete
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteUser = async (userId) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.USERS}/${userId}`);
  return response.data;
};

/**
 * Toggle user status (active/inactive)
 * @param {number} userId - ID of user
 * @param {boolean} active - New status
 * @returns {Promise<Object>} Response with updated user
 */
export const toggleUserStatus = async (userId, active) => {
  const response = await axiosInstance.patch(`${ENDPOINTS.USERS}/${userId}/status`, { active });
  return response.data;
};

/**
 * Reset user password
 * @param {number} userId - ID of user
 * @returns {Promise<Object>} Response with reset confirmation
 */
export const resetUserPassword = async (userId) => {
  const response = await axiosInstance.post(`${ENDPOINTS.USERS}/${userId}/reset-password`);
  return response.data;
};

/**
 * Change user password
 * @param {number} userId - ID of user
 * @param {Object} passwordData - { currentPassword, newPassword }
 * @returns {Promise<Object>} Response with confirmation
 */
export const changePassword = async (userId, passwordData) => {
  const response = await axiosInstance.post(`${ENDPOINTS.USERS}/${userId}/reset-password`, passwordData);
  return response.data;
};
