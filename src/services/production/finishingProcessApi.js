/**
 * Finishing › External Process — garments issued to a process vendor (washing,
 * printing, embroidery) against an approved Work Order and received back.
 * Real API (/api/v1/finishing); the rest of Finishing is still the design mock. An in-house Work Order
 * issues against an approved Garment Process PO (getProcessJobWorkPos); an outsourced one free text.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/finishing';
const PAGE = { page: 0, size: 200 };

export const listProcessIssues = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/process-issues`, { params: { ...PAGE, ...params } });
  return data?.content || [];
};

export const createProcessIssue = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/process-issues`, payload);
  return data;
};

export const cancelProcessIssue = async (id) => {
  const { data } = await axiosInstance.post(`${BASE}/process-issues/${id}/cancel`);
  return data;
};

export const listProcessReturns = async (params = {}) => {
  const { data } = await axiosInstance.get(`${BASE}/process-returns`, { params: { ...PAGE, ...params } });
  return data?.content || [];
};

export const createProcessReturn = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/process-returns`, payload);
  return data;
};

/** Approved Work Orders with their colour x size plan and what already went to each process. */
export const getProcessWorkOrders = async () => {
  const { data } = await axiosInstance.get(`${BASE}/process-lookups/work-orders`);
  return data || [];
};

export const getProcessVendors = async () => {
  const { data } = await axiosInstance.get(`${BASE}/process-lookups/vendors`);
  return data || [];
};

/** The approved Garment Process POs an in-house Work Order may issue against, with what each line has left. */
export const getProcessJobWorkPos = async (workOrderId) => {
  const { data } = await axiosInstance.get(`${BASE}/process-lookups/job-work-pos`, { params: { workOrderId } });
  return data || [];
};
