import axiosInstance from '../core/axiosInstance';
import { setOrgInfo, getOrgInfo } from '../auth/sessionStore';

/**
 * Organisation Info API Service
 * Retrieves company/organisation details for PO PDF generation and other uses.
 * Organisation data is cached in-memory (via sessionStore) rather than sessionStorage
 * to protect sensitive business information from XSS.
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
 * Fetch organisation info and cache the first item in memory.
 * This should be called after login to cache org info for PDF generation.
 * Does not throw errors - silently fails if API is unavailable.
 * @returns {Promise<Object|null>} The cached organisation object or null
 */
export const fetchAndCacheOrganisation = async () => {
  try {
    const response = await axiosInstance.get(ENDPOINTS.ORGANISATION_INFO);
    const data = response?.data || response;
    const orgs = Array.isArray(data) ? data : (data?.content || []);

    if (orgs.length > 0) {
      const org = orgs[0];
      setOrgInfo(org);
      return org;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch organisation info:', error);
    return null;
  }
};

/**
 * Get cached organisation info from in-memory store.
 * @returns {Object|null} Cached organisation object or null
 */
export const getCachedOrganisation = () => getOrgInfo();

/**
 * Clear cached organisation info from in-memory store.
 */
export const clearCachedOrganisation = () => setOrgInfo(null);

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
