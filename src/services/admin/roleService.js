import axiosInstance from '../core/axiosInstance';

/**
 * Role API Service
 * Contains all API methods for Role operations
 */

const ENDPOINTS = {
  ROLES: '/roles',
};

/**
 * Get all roles
 * @returns {Promise<Array>} Response with roles array
 */
export const getRoles = async () => {
  const response = await axiosInstance.get(ENDPOINTS.ROLES);
  return response.data;
};

/**
 * Get role by ID
 * @param {number} roleId - Role ID
 * @returns {Promise<Object>} Role object
 */
export const getRoleById = async (roleId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.ROLES}/${roleId}`);
  return response.data;
};

/**
 * Create a new role
 * @param {Object} roleData - Role data to create
 * @returns {Promise<Object>} Response with created role
 */
export const createRole = async (roleData) => {
  const response = await axiosInstance.post(ENDPOINTS.ROLES, roleData);
  return response.data;
};

/**
 * Update an existing role (uses POST with id in payload)
 * @param {number} roleId - ID of role to update
 * @param {Object} roleData - Updated role data
 * @returns {Promise<Object>} Response with updated role
 */
export const updateRole = async (roleId, roleData) => {
  const response = await axiosInstance.put(`${ENDPOINTS.ROLES}/${roleId}`, roleData);
  return response.data;
};

/**
 * Save role (create or update)
 * @param {Object} roleData - Role data (include id for update)
 * @returns {Promise<Object>} Response with saved role
 */
export const saveRole = async (roleData) => {
  const response = await axiosInstance.post(ENDPOINTS.ROLES, roleData);
  return response.data;
};

/**
 * Delete a role
 * @param {number} roleId - ID of role to delete
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteRole = async (roleId) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.ROLES}/${roleId}`);
  return response.data;
};
