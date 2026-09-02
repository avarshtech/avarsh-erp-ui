/**
 * CRUD for the production masters. The read-only lists the sewing screens
 * consume live in sewingMasterService; this is the maintenance surface behind
 * the Production Masters screen.
 */
import axiosInstance from '../core/axiosInstance';

/** Every master here is a flat list with the same four calls. */
const crud = (path) => ({
  list: async () => (await axiosInstance.get(path)).data,
  create: async (payload) => (await axiosInstance.post(path, payload)).data,
  update: async (id, payload) => (await axiosInstance.put(`${path}/${id}`, payload)).data,
  remove: async (id) => (await axiosInstance.delete(`${path}/${id}`)).data,
});

export const productionLineApi = crud('/production-lines');
export const machineTypeApi = crud('/machine-types');
export const sewingOperationApi = crud('/sewing-operations');
export const sewingDefectTypeApi = crud('/sewing-defect-types');
export const sewingLookupApi = crud('/sewing-lookups');
export const incentiveSlabApi = crud('/incentive-slabs');

/**
 * The measurement chart is uploaded and replaces the style's chart outright, so
 * it has no per-row create or update — only a read by style.
 */
export const getMeasurementChart = async (styleNo) => {
  const { data } = await axiosInstance.get('/measurement-specs', { params: { styleNo } });
  return data;
};
