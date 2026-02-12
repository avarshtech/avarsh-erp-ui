import axiosInstance from './axiosInstance';

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
export const saveBuyer = async (data) => {
  const response = await axiosInstance.post(ENDPOINTS.BUYERS, { ...data, active: true });
  return response.data ?? response;
};

export const createBuyer = saveBuyer;

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

/**
 * Get location details by pincode (Indian postal code)
 */
export const getLocationByPincode = async (pincode) => {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return {
        city: po.District || po.Division,
        state: po.State,
        country: po.Country || 'India',
      };
    }
    return null;
  } catch {
    return null;
  }
};
