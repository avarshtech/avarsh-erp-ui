/**
 * Export shipments REST client (/api/v1/export-docs/shipments). Every record comes back
 * through the adapter. `silent` keeps the global error toast off for a caller that
 * degrades on its own: the mirror's refresh, a document's printed header.
 */
import axiosInstance from '../core/axiosInstance';
import { fromApi, toApi, toSearchParams } from './shipmentAdapter';

const BASE = '/export-docs/shipments';

/** Screens read `e.message`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) => request.then((res) => res.data).catch((e) => {
  e.message = e.errorMessage || e.message;
  throw e;
});

/** `timeout` for a caller that must not hang (the mirror): axios otherwise waits a minute. */
export const searchApiShipments = async (params = {}, { silent = false, timeout } = {}) => {
  const page = await call(axiosInstance.get(BASE, { params: toSearchParams(params), silent, ...(timeout ? { timeout } : {}) }));
  return { ...page, content: (page.content || []).map(fromApi) };
};

export const getApiShipment = async (id, { silent = false } = {}) =>
  fromApi(await call(axiosInstance.get(`${BASE}/${id}`, { silent })));

export const createApiShipment = async (shipment) => fromApi(await call(axiosInstance.post(BASE, toApi(shipment))));

export const updateApiShipment = async (id, shipment) =>
  fromApi(await call(axiosInstance.put(`${BASE}/${id}`, toApi(shipment))));

export const deleteApiShipment = (id, version) =>
  call(axiosInstance.delete(`${BASE}/${id}`, { params: { version } }));

// Close and reopen are asked for by the documents, never by a person (expDocShipmentBridge),
// so a refusal stays quiet and a hung API does not hold the document action for long.
// Both are idempotent.
const QUIET = { silent: true, timeout: 10000 };

export const closeApiShipment = async (id) =>
  fromApi(await call(axiosInstance.post(`${BASE}/${id}/close`, null, QUIET)));

export const reopenApiShipment = async (id) =>
  fromApi(await call(axiosInstance.post(`${BASE}/${id}/reopen`, null, QUIET)));

/** The consignee's orders a shipment may carry: every status but cancelled, at the working branch. */
export const listApiOrderOptions = (buyerId, search, size = 50) =>
  call(axiosInstance.get(`${BASE}/order-options`, { params: { buyerId, ...(search ? { search } : {}), size } }));
