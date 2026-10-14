import axiosInstance from '../core/axiosInstance';

/**
 * Asset Register API.
 *
 * There is no delete: an asset that leaves the company is disposed, which keeps
 * its cost and its history for the auditor.
 */

const ASSETS = '/assets';
const SETUP = '/asset-setup';

/** Only the filters the user actually set are sent, so the server's defaults apply. */
const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getAssets = async (params = {}) =>
  (await axiosInstance.get(`${ASSETS}${query(params)}`)).data;

export const getAsset = async (id) => (await axiosInstance.get(`${ASSETS}/${id}`)).data;

export const getAssetMovements = async (id) =>
  (await axiosInstance.get(`${ASSETS}/${id}/movements`)).data;

export const createAsset = async (payload) => (await axiosInstance.post(ASSETS, payload)).data;

export const updateAsset = async (id, payload) =>
  (await axiosInstance.put(`${ASSETS}/${id}`, payload)).data;

export const getCategories = async () => (await axiosInstance.get(`${SETUP}/categories`)).data;

export const createCategory = async (payload) =>
  (await axiosInstance.post(`${SETUP}/categories`, payload)).data;

export const updateCategory = async (id, payload) =>
  (await axiosInstance.put(`${SETUP}/categories/${id}`, payload)).data;

export const getSections = async (departmentId) =>
  (await axiosInstance.get(`${SETUP}/sections${query({ departmentId })}`)).data;

export const createSection = async (payload) =>
  (await axiosInstance.post(`${SETUP}/sections`, payload)).data;

export const updateSection = async (id, payload) =>
  (await axiosInstance.put(`${SETUP}/sections/${id}`, payload)).data;

export const createLine = async (payload) => (await axiosInstance.post(`${SETUP}/lines`, payload)).data;

export const updateLine = async (id, payload) =>
  (await axiosInstance.put(`${SETUP}/lines/${id}`, payload)).data;

// ── Pickers ──
// The asset module's own lookups, not /units or /hr/employees: those are HR
// permission keys, so an asset clerk would collect four 403s on an empty form.

const LOOKUPS = '/asset-lookups';

export const getUnitOptions = async () => (await axiosInstance.get(`${LOOKUPS}/units`)).data;

export const getDepartmentOptions = async () =>
  (await axiosInstance.get(`${LOOKUPS}/departments`)).data;

export const getSupplierOptions = async () => (await axiosInstance.get(`${LOOKUPS}/suppliers`)).data;

export const getEmployeeOptions = async (search) =>
  (await axiosInstance.get(`${LOOKUPS}/employees${query({ search })}`)).data;

// ── Status ──
// Its own call rather than part of the update: the reason is required here and
// nowhere else, and an edit must not be a way round it.

export const changeAssetStatus = async (id, payload) =>
  (await axiosInstance.put(`${ASSETS}/${id}/status`, payload)).data;

export const getAssetStatusHistory = async (id) =>
  (await axiosInstance.get(`${ASSETS}/${id}/status-history`)).data;

export const getStatusReasons = async () =>
  (await axiosInstance.get(`${ASSETS}/status-reasons`)).data;
