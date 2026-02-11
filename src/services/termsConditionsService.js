import axiosInstance from './axiosInstance';

/**
 * Terms & Conditions API Service
 * Handles CRUD operations for Terms & Conditions master data.
 * The description field supports rich-text HTML content and is stored/retrieved as-is.
 */

const ENDPOINTS = {
  TERMS_CONDITIONS: '/terms-conditions',
};

/**
 * Get all terms & conditions
 * @returns {Promise<Array>} Array of terms & conditions
 */
export const getAllTermsConditions = async () => {
  const response = await axiosInstance.get(ENDPOINTS.TERMS_CONDITIONS);
  return response;
};

/**
 * Get terms & conditions by ID
 * @param {number} id - Terms & Conditions ID
 * @returns {Promise<Object>} Terms & Conditions object
 */
export const getTermsConditionsById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.TERMS_CONDITIONS}/${id}`);
  return response;
};

/**
 * Create new terms & conditions
 * @param {Object} data - { name, description } where description may contain HTML
 * @returns {Promise<Object>} Created terms & conditions
 */
export const createTermsConditions = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.TERMS_CONDITIONS, data);
  return response;
};

/**
 * Update existing terms & conditions
 * @param {number} id - Terms & Conditions ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated terms & conditions
 */
export const updateTermsConditions = async (id, data) => {
  const response = await axiosInstance.put(`${ENDPOINTS.TERMS_CONDITIONS}/${id}`, { id, ...data });
  return response;
};

/**
 * Delete terms & conditions
 * @param {number} id - Terms & Conditions ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteTermsConditions = async (id) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.TERMS_CONDITIONS}/${id}`);
  return response;
};

export default {
  getAllTermsConditions,
  getTermsConditionsById,
  createTermsConditions,
  updateTermsConditions,
  deleteTermsConditions,
};
