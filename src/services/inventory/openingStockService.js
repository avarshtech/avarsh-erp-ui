/**
 * Opening Stock Balance API client.
 *
 * Captures inventory that predates the ERP. Endpoints mirror
 * OpeningStockController on the erp-purchase backend. The feature is available
 * indefinitely — it was once a one-time migration sealed by a `finalize` call,
 * and that lock is gone from both ends.
 *
 * Mock mode: governed by USE_MOCK_OPENING_STOCK_DATA defined locally in this
 * file so opening-stock can be toggled independently of the main inventory
 * mock flag. Mock state lives in openingStockMockData and mutates in-session
 * to simulate real API behaviour (create → list, post → committed to stock).
 */
import axiosInstance from '../core/axiosInstance';
import {
  mockGetStatus,
  mockListBatches,
  mockGetBatch,
  mockCreateBatch,
  mockUpdateBatch,
  mockPostBatch,
  mockCancelBatch,
  mockDownloadCsvTemplate,
  mockParseCsv,
} from './openingStockMockData';

const BASE = '/opening-stock';
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

// Dev-only flag — when true, opening-stock reads/writes are served from local
// mock state. Kept independent of USE_MOCK_INVENTORY_DATA so this module can be
// toggled separately from GRN/QC/stock/issue mocking.
export const USE_MOCK_OPENING_STOCK_DATA = false;

// ─── Status ───────────────────────────────────────────────────────────────────
export const getOpeningStockStatus = async () => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockGetStatus();
  }
  const { data } = await axiosInstance.get(`${BASE}/status`);
  return data;
};

// ─── Batches ──────────────────────────────────────────────────────────────────
export const listBatches = async ({ type, status, page = 0, size = 20 } = {}) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockListBatches({ type, status, page, size });
  }
  const params = {};
  if (type) params.type = type;
  if (status) params.status = status;
  params.page = page;
  params.size = size;
  const { data } = await axiosInstance.get(`${BASE}/batches`, { params });
  return data;
};

export const getBatch = async (id) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockGetBatch(id);
  }
  const { data } = await axiosInstance.get(`${BASE}/batches/${id}`);
  return data;
};

export const createDraftBatch = async (payload) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockCreateBatch(payload);
  }
  const { data } = await axiosInstance.post(`${BASE}/batches`, payload);
  return data;
};

export const updateDraftBatch = async (id, payload) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockUpdateBatch(id, payload);
  }
  const { data } = await axiosInstance.put(`${BASE}/batches/${id}`, payload);
  return data;
};

export const postBatch = async (id) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockPostBatch(id);
  }
  const { data } = await axiosInstance.post(`${BASE}/batches/${id}/post`);
  return data;
};

export const cancelBatch = async (id) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay();
    return mockCancelBatch(id);
  }
  const { data } = await axiosInstance.post(`${BASE}/batches/${id}/cancel`);
  return data;
};

// ─── CSV ──────────────────────────────────────────────────────────────────────
export const downloadCsvTemplate = async (type) => {
  // type: 'FABRIC' or 'ACCESSORIES'
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay(80);
    return mockDownloadCsvTemplate(type);
  }
  const path = type === 'FABRIC' ? 'fabric.csv' : 'accessories.csv';
  const response = await axiosInstance.get(`${BASE}/template/${path}`, {
    responseType: 'blob',
  });
  return response.data;
};

export const parseCsvUpload = async (file, type) => {
  if (USE_MOCK_OPENING_STOCK_DATA) {
    await delay(300);
    return mockParseCsv(file, type);
  }
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(`${BASE}/parse-csv`, formData, {
    params: { type },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
