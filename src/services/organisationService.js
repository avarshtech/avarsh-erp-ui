import axiosInstance from './axiosInstance';

/**
 * Organisation Info API Service
 * Retrieves company/organisation details for PO PDF generation and other uses.
 */

const ENDPOINTS = {
  ORGANISATION_INFO: '/organisation-info',
};

/**
 * Get all organisations
 * @returns {Promise<Array>} Array of organisation info
 */
export const getAllOrganisations = async () => {
  const response = await axiosInstance.get(ENDPOINTS.ORGANISATION_INFO);
  return response;
};

/**
 * Get active organisation info
 * @returns {Promise<Object>} Active organisation details
 */
export const getActiveOrganisation = async () => {
  const response = await axiosInstance.get(`${ENDPOINTS.ORGANISATION_INFO}/active`);
  return response;
};

/**
 * Get organisation by ID
 * @param {number} id - Organisation ID
 * @returns {Promise<Object>} Organisation object
 */
export const getOrganisationById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.ORGANISATION_INFO}/${id}`);
  return response;
};

export default {
  getAllOrganisations,
  getActiveOrganisation,
  getOrganisationById,
};
