import axiosInstance from './axiosInstance';

/**
 * Supplier API Service
 * Contains all API methods for Supplier operations
 */

// API endpoints
const ENDPOINTS = {
  SUPPLIERS: '/suppliers',
};

/**
 * Get all suppliers
 * @returns {Promise<Array>} Array of suppliers
 */
export const getSuppliers = async () => {
  const response = await axiosInstance.get(ENDPOINTS.SUPPLIERS);
  return response;
};

/**
 * Get supplier by ID
 * @param {number} id - Supplier ID
 * @returns {Promise<Object>} Supplier object
 */
export const getSupplierById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.SUPPLIERS}/${id}`);
  return response;
};

/**
 * Create or update a supplier (POST with optional ID for update)
 * @param {Object} supplierData - Supplier data to create or update
 * @returns {Promise<Object>} Response with created/updated supplier
 */
export const saveSupplier = async (supplierData) => {
  const response = await axiosInstance.post(ENDPOINTS.SUPPLIERS, supplierData);
  return response;
};

/**
 * Create a new supplier
 * @param {Object} supplierData - Supplier data to create
 * @returns {Promise<Object>} Response with created supplier
 */
export const createSupplier = async (supplierData) => {
  return saveSupplier(supplierData);
};

/**
 * Update an existing supplier
 * @param {Object} supplierData - Updated supplier data (must include id)
 * @returns {Promise<Object>} Response with updated supplier
 */
export const updateSupplier = async (supplierData) => {
  return saveSupplier(supplierData);
};

/**
 * Delete a supplier
 * @param {number} supplierId - ID of supplier to delete
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteSupplier = async (supplierId) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.SUPPLIERS}/${supplierId}`);
  return response;
};

/**
 * Get location details by pincode (using external API)
 * @param {string} pincode - 6-digit pincode
 * @returns {Promise<Object|null>} Location object with city, state, country or null
 */
export const getLocationByPincode = async (pincode) => {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
      const postOffice = data[0].PostOffice[0];
      return {
        city: postOffice.District || postOffice.Block || '',
        state: postOffice.State || '',
        country: 'India',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching location by pincode:', error);
    return null;
  }
};
