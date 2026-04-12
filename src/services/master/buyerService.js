import axiosInstance from '../core/axiosInstance';

const ENDPOINTS = {
  BUYERS: '/buyers',
};

/**
 * Get all buyers
 */
export const getBuyers = async () => {
  const response = await axiosInstance.get(ENDPOINTS.BUYERS);
  return response.data ?? response;
};

/**
 * Get buyer by ID
 */
export const getBuyerById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.BUYERS}/${id}`);
  return response.data ?? response;
};

/**
 * Create a new buyer (POST)
 */
export const createBuyer = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.BUYERS, { ...data, active: true });
  return response.data ?? response;
};


/**
 * Update an existing buyer (POST with id in body)
 */
export const updateBuyer = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.BUYERS, data);
  return response.data ?? response;
};

/**
 * Delete buyer (soft delete - POST with active: false)
 */
export const deleteBuyer = async (id) => {
  const response = await axiosInstance.post(ENDPOINTS.BUYERS, { id, active: false });
  return response.data ?? response;
};
