import axiosInstance from './axiosInstance';

/**
 * Organisation Info API Service
 * Retrieves company/organisation details for PO PDF generation and other uses.
 */

const ENDPOINTS = {
  ORGANISATION_INFO: '/organisation-info',
};

const ORG_INFO_SESSION_KEY = 'organisationInfo';

/**
 * Get all organisations
 * @returns {Promise<Array>} Array of organisation info
 */
export const getAllOrganisations = async () => {
  const response = await axiosInstance.get(ENDPOINTS.ORGANISATION_INFO);
  return response;
};

/**
 * Fetch organisation info and save the first item to session storage.
 * This should be called after login to cache org info for PDF generation.
 * Does not throw errors - silently fails if API is unavailable.
 * @returns {Promise<Object|null>} The saved organisation object or null
 */
export const fetchAndCacheOrganisation = async () => {
  try {
    const response = await axiosInstance.get(ENDPOINTS.ORGANISATION_INFO);
    const data = response?.data || response;
    const orgs = Array.isArray(data) ? data : (data?.content || []);
    
    if (orgs.length > 0) {
      const org = orgs[0];
      sessionStorage.setItem(ORG_INFO_SESSION_KEY, JSON.stringify(org));
      return org;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch organisation info:', error);
    return null;
  }
};

/**
 * Get cached organisation info from session storage
 * @returns {Object|null} Cached organisation object or null
 */
export const getCachedOrganisation = () => {
  try {
    const cached = sessionStorage.getItem(ORG_INFO_SESSION_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

/**
 * Clear cached organisation info from session storage
 */
export const clearCachedOrganisation = () => {
  sessionStorage.removeItem(ORG_INFO_SESSION_KEY);
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
  fetchAndCacheOrganisation,
  getCachedOrganisation,
  clearCachedOrganisation,
  getOrganisationById,
};
