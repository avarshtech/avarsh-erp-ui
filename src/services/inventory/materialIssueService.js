/**
 * Material Issue API — issues fabric rolls / accessories from live stock to an
 * approved production PO, clearing GRN-received stock. Real backend only (the
 * old inventoryService issue functions were display mocks with no save path).
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/material-issues';

export const listIssues = async (type, params = {}) => {
  const { data } = await axiosInstance.get(BASE, { params: { type, ...params } });
  return data; // { content, totalElements, ... }
};

export const getIssue = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/${id}`);
  return data;
};

/** Approved Cutting POs shaped for the FabricIssueForm (cuttingPONumber + lines[]). */
export const getIssueCuttingPos = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cutting-pos`);
  return { content: data || [], totalElements: (data || []).length };
};

/** Approved Work Orders shaped for the AccessoriesIssueForm (workOrderNumber + bomItems[]). */
export const getIssueWorkOrders = async () => {
  const { data } = await axiosInstance.get(`${BASE}/work-orders`);
  return { content: data || [], totalElements: (data || []).length };
};

/** Flat In_Stock rolls of one fabric item (weight = remaining available qty). */
export const getIssuableRolls = async (orderRef, itemCode) => {
  const { data } = await axiosInstance.get(`${BASE}/issuable-rolls`, { params: { orderRef, itemCode } });
  return data || [];
};

export const createFabricIssue = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/fabric`, payload);
  return data;
};

export const createAccessoriesIssue = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/accessories`, payload);
  return data;
};
