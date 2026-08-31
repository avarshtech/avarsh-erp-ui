/**
 * Sewing master data. Small read-only client — the sewing screens only consume
 * these lists; maintaining them is a master-screen job.
 */
import axiosInstance from '../core/axiosInstance';

export const getProductionLines = async (factoryId) => {
  const { data } = await axiosInstance.get('/production-lines', { params: { factoryId } });
  return data;
};

export const getMachineTypes = async () => {
  const { data } = await axiosInstance.get('/machine-types/active');
  return data;
};

export const getSewingOperations = async () => {
  const { data } = await axiosInstance.get('/sewing-operations');
  return data;
};

/** Defects keyed by category — the shape the end-line dropdowns need. */
export const getSewingDefectTypes = async () => {
  const { data } = await axiosInstance.get('/sewing-defect-types/grouped');
  return data;
};

/** Every code list at once, keyed by lookup type. */
export const getSewingLookups = async () => {
  const { data } = await axiosInstance.get('/sewing-lookups/grouped');
  return data;
};

export const getIncentiveSlabs = async () => {
  const { data } = await axiosInstance.get('/incentive-slabs');
  return data;
};
