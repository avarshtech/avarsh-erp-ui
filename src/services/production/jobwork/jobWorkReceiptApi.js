/**
 * Receipts from vendors: GET /api/v1/job-work/receipts, POST /jobs/{id}/receipts,
 * POST /receipts/{id}/cancel (mock-only for now).
 */
import * as mock from './trackerMockReceipts';

export const searchReceipts = async (filters) => mock.searchReceipts(filters);
export const getReceiptForm = async (jobId) => mock.getReceiptForm(jobId);
export const postReceipt = async (jobId, payload) => mock.postReceipt(jobId, payload);
export const cancelReceipt = async (id, body) => mock.cancelReceipt(id, body);
