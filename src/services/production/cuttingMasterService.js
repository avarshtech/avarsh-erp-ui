/**
 * Cutting master data API — fabric types, cutting/lay tables and the code lists
 * (TMB comments, re-cut reasons, thresholds…) that used to be hard-coded arrays
 * in cuttingConstants.js. Real backend only.
 */
import axiosInstance from '../core/axiosInstance';

export const getFabricTypes = async () => {
  const { data } = await axiosInstance.get('/fabric-types/active');
  return data;
};

export const getCuttingTables = async () => {
  const { data } = await axiosInstance.get('/cutting-tables/active');
  return data;
};

/** Every active code list at once, keyed by lookup type. */
export const getCuttingLookups = async () => {
  const { data } = await axiosInstance.get('/cutting-lookups/grouped');
  return data;
};
