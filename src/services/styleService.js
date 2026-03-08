/**
 * Style Master API Service
 * Contains all API methods for Style CRUD operations.
 */

import axiosInstance from './axiosInstance';

const ENDPOINTS = {
  STYLES: '/styles',
};

/**
 * Create or update a style.
 * POST /api/v1/styles (id in body = update, null = create)
 * @param {Object} data - StyleRequest { id?, styleNo, garmentName, buyerId, season?, description?, isActive? }
 * @returns {Promise<Object>} StyleDTO
 */
export const saveStyle = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.STYLES, data);
  return response.data;
};

/**
 * Get all styles.
 * GET /api/v1/styles
 * @returns {Promise<Array>} StyleDTO[]
 */
export const getStyles = async () => {
  const response = await axiosInstance.get(ENDPOINTS.STYLES);
  return response.data ?? [];
};

/**
 * Get a style by ID.
 * GET /api/v1/styles/{id}
 * @param {number|string} id - Style ID
 * @returns {Promise<Object>} StyleDTO
 */
export const getStyleById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.STYLES}/${id}`);
  return response.data;
};

/**
 * Delete a style.
 * DELETE /api/v1/styles/{id}
 * @param {number|string} id - Style ID
 * @returns {Promise<void>}
 */
export const deleteStyle = async (id) => {
  await axiosInstance.delete(`${ENDPOINTS.STYLES}/${id}`);
};

/**
 * Get styles filtered by buyer ID.
 * GET /api/v1/styles/buyer/{buyerId}
 * @param {number|string} buyerId - Buyer ID
 * @returns {Promise<Array>} StyleDTO[]
 */
export const getStylesByBuyerId = async (buyerId) => {
  if (!buyerId) return [];
  const response = await axiosInstance.get(`${ENDPOINTS.STYLES}/buyer/${buyerId}`);
  return response.data ?? [];
};
