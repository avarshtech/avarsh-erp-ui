/**
 * Return to Supplier & Debit Note service (CRD_INV_004).
 *
 * Endpoints:
 *   GET  /inventory/returns-to-supplier/pos?type=FABRIC|ACCESSORIES
 *   GET  /inventory/returns-to-supplier/pos/{poId}/pending-items?type=...
 *   POST /inventory/returns-to-supplier
 *   GET  /inventory/returns-to-supplier?<search>
 *   GET  /inventory/returns-to-supplier/{id}
 *   GET  /inventory/debit-notes?<search>
 *   GET  /inventory/debit-notes/{id}
 *   GET  /inventory/debit-notes/by-return/{returnId}
 *
 * Mock mode: governed by USE_MOCK_RETURN_TO_SUPPLIER_DATA below. Mirrors the
 * opening-stock pattern — kept independent of USE_MOCK_INVENTORY_DATA so this
 * module can be demoed without a running backend. In-session mutations persist
 * in returnToSupplierMockData.
 */
import axiosInstance from '../core/axiosInstance';
import {
  mockListPOsWithPendingReturns,
  mockGetPendingItems,
  mockCreateReturn,
  mockSearchReturns,
  mockGetReturnById,
  mockSearchDebitNotes,
  mockGetDebitNoteById,
  mockGetDebitNoteByReturnId,
} from './returnToSupplierMockData';

const RTS_ENDPOINT = '/inventory/returns-to-supplier';
const DBN_ENDPOINT = '/inventory/debit-notes';

export const RETURN_TYPE = {
  FABRIC: 'FABRIC',
  ACCESSORIES: 'ACCESSORIES',
};

// Dev-only flag — when true, return/debit-note reads and writes are served
// from local mock state. Flip to false to hit the real API at
// /api/v1/inventory/returns-to-supplier + /inventory/debit-notes.
export const USE_MOCK_RETURN_TO_SUPPLIER_DATA = false;

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

// ─── PO dropdown + pending items ────────────────────────────────────────────

export const listPOsWithPendingReturns = async (type) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockListPOsWithPendingReturns(type);
  }
  const res = await axiosInstance.get(`${RTS_ENDPOINT}/pos`, { params: { type } });
  return res.data || [];
};

export const getPendingItems = async (poId, type) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockGetPendingItems(poId, type);
  }
  const res = await axiosInstance.get(`${RTS_ENDPOINT}/pos/${poId}/pending-items`, {
    params: { type },
  });
  return res.data || [];
};

// ─── CRUD ───────────────────────────────────────────────────────────────────

export const createReturn = async (payload) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay(250);
    return mockCreateReturn(payload);
  }
  const res = await axiosInstance.post(RTS_ENDPOINT, payload);
  return res.data;
};

export const searchReturns = async (criteria = {}) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockSearchReturns(criteria);
  }
  const res = await axiosInstance.get(RTS_ENDPOINT, { params: criteria });
  return res.data;
};

export const getReturnById = async (id) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockGetReturnById(id);
  }
  const res = await axiosInstance.get(`${RTS_ENDPOINT}/${id}`);
  return res.data;
};

// ─── Debit notes ────────────────────────────────────────────────────────────

export const searchDebitNotes = async (criteria = {}) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockSearchDebitNotes(criteria);
  }
  const res = await axiosInstance.get(DBN_ENDPOINT, { params: criteria });
  return res.data;
};

export const getDebitNoteById = async (id) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockGetDebitNoteById(id);
  }
  const res = await axiosInstance.get(`${DBN_ENDPOINT}/${id}`);
  return res.data;
};

export const getDebitNoteByReturnId = async (returnId) => {
  if (USE_MOCK_RETURN_TO_SUPPLIER_DATA) {
    await delay();
    return mockGetDebitNoteByReturnId(returnId);
  }
  const res = await axiosInstance.get(`${DBN_ENDPOINT}/by-return/${returnId}`);
  return res.data;
};
