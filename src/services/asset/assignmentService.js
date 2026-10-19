import axiosInstance from '../core/axiosInstance';

/**
 * Issuing an asset to a person and taking it back.
 *
 * An assignment is not a location: a laptop in somebody's bag is still recorded
 * in the unit it belongs to. Only a transfer moves an asset.
 */

export const getAssignments = async (assetId) =>
  (await axiosInstance.get(`/assets/${assetId}/assignments`)).data;

export const issueAsset = async (assetId, payload) =>
  (await axiosInstance.post(`/assets/${assetId}/assignments`, payload)).data;

export const returnAsset = async (assetId, id, payload) =>
  (await axiosInstance.put(`/assets/${assetId}/assignments/${id}/return`, payload)).data;

/** What this employee still holds - HR's exit-clearance question. */
export const getEmployeeAssets = async (employeeId) =>
  (await axiosInstance.get(`/employees/${employeeId}/assets`)).data;
