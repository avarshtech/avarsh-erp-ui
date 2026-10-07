/**
 * Materials at vendors (packing issue, vendor material return) and the order split view.
 * At integration the material calls move to /api/v1/material-issues and the split to
 * /api/v1/job-work/orders/{id}/split (mock-only for now).
 */
import * as mats from './trackerMockMaterials';
import * as split from './trackerMockSplit';

export const PACKING_ITEMS = mats.PACKING_ITEMS;
export const getJobMaterials = async (jobId) => mats.getJobMaterials(jobId);
export const listMaterialJobs = async (filters) => mats.listMaterialJobs(filters);
export const getPackingTargets = async () => mats.getPackingTargets();
export const issuePacking = async (jobId, payload) => mats.issuePacking(jobId, payload);
export const postVendorReturn = async (jobId, payload) => mats.postVendorReturn(jobId, payload);
export const listSplitOrders = async () => split.listSplitOrders();
export const getOrderSplit = async (orderId) => split.getOrderSplit(orderId);
