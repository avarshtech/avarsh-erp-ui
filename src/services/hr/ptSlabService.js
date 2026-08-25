import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/pt-slabs';

/**
 * Professional Tax slabs.
 *
 * These were defined inline in PtSlabMaster, which broke the convention that no
 * page declares its own API calls - and the screen itself was unreachable, so
 * Chennai's half-yearly slabs could not be maintained at all.
 */

/** GET /api/v1/hr/pt-slabs */
export const getAllPtSlabs = async () => {
  const response = await axiosInstance.get(BASE_URL);
  return response.data;
};

/** POST /api/v1/hr/pt-slabs */
export const createPtSlab = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/** PUT /api/v1/hr/pt-slabs/{id} */
export const updatePtSlab = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });
  return response.data;
};

/** DELETE /api/v1/hr/pt-slabs/{id} */
export const deletePtSlab = async (id) => {
  const response = await axiosInstance.delete(`${BASE_URL}/${id}`);
  return response.data;
};
