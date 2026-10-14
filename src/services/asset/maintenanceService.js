import axiosInstance from '../core/axiosInstance';

/**
 * The maintenance log, hung off the asset it belongs to.
 *
 * Deliberately small: enough to know when a machine was last serviced, what it
 * cost and when it is next due. If a real maintenance module ever arrives it
 * takes this over.
 */

const base = (assetId) => `/assets/${assetId}/maintenance`;

export const getMaintenance = async (assetId) =>
  (await axiosInstance.get(base(assetId))).data;

export const logMaintenance = async (assetId, payload) =>
  (await axiosInstance.post(base(assetId), payload)).data;

/** The machine is back. Closing restores the status the breakdown took away. */
export const closeMaintenance = async (assetId, id, payload) =>
  (await axiosInstance.put(`${base(assetId)}/${id}/close`, payload)).data;

export const getMaintenanceTypes = async (assetId) =>
  (await axiosInstance.get(`${base(assetId)}/types`)).data;
