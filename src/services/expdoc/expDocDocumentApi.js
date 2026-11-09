/**
 * Export documents REST client (/api/v1/export-docs/documents): the packing lists, invoices,
 * sticker runs, audit trail and masters the document store (expDocStore) loads and saves.
 *
 *   GET  ?kinds=PACKING_LIST,INVOICE,…  → [{key, kind, docNo, shipmentId, status, version, body}]
 *   POST /batch {upserts:[{key, kind, version|null, body}], deletes:[{key, version}]} → the saved
 *        upserts, same shape. One transaction; a stale version is the usual 409
 *        OPTIMISTIC_LOCK_CONFLICT, a number another document holds a 409 CONFLICT.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/export-docs/documents';

export const DOCUMENT_KIND = {
  PACKING_LIST: 'PACKING_LIST',
  INVOICE: 'INVOICE',
  STICKER_RUN: 'STICKER_RUN',
  AUDIT: 'AUDIT',
  SETTINGS: 'SETTINGS',
};

/** Screens read `e.message` and branch on `e.code`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) => request.then((res) => res.data).catch((e) => {
  e.message = e.errorMessage || e.message;
  // The API's error code (CONFLICT, OPTIMISTIC_LOCK_CONFLICT, …), as the mock's errors carried it
  if (e.response?.data?.error) e.code = e.response.data.error;
  throw e;
});

/** `silent` for a background refresh that degrades on its own. */
export const listDocuments = (kinds = Object.values(DOCUMENT_KIND), { silent = false } = {}) =>
  call(axiosInstance.get(BASE, { params: { kinds: kinds.join(',') }, silent }));

export const saveDocuments = ({ upserts = [], deletes = [] }, { silent = false } = {}) =>
  call(axiosInstance.post(`${BASE}/batch`, { upserts, deletes }, { silent }));
