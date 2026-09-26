/**
 * Carton packing REST client (/api/v1/packing). Every entry comes back through
 * decorateEntry, so the screens read the same derived totals and issues the mock
 * used to hand them.
 */
import axiosInstance from '../core/axiosInstance';
import { decorateEntry } from '../../utils/packingEntryIssues';

const BASE = '/packing';

/** Screens read `e.message`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) =>
  request.then((res) => res.data).catch((e) => {
    e.message = e.errorMessage || e.message;
    throw e;
  });

/** Groups are rebuilt server-side: new rows carry `tmp-…` ids and derived fields are recomputed. */
const toPayload = ({ groups = [], ...rest }) => ({
  ...rest,
  groups: groups.map(({ id: _id, cartonCount: _c, piecesPerCarton: _p, totalPieces: _t, cbm: _cbm, ...g }) => g),
});

export const searchPackingEntries = async (params = {}) => {
  const page = await call(axiosInstance.get(`${BASE}/entries`, { params }));
  return { ...page, content: (page.content || []).map(decorateEntry) };
};

export const getPackingEntry = async (id) =>
  decorateEntry(await call(axiosInstance.get(`${BASE}/entries/${id}`)));

export const createPackingEntry = async (payload) =>
  decorateEntry(await call(axiosInstance.post(`${BASE}/entries`, toPayload(payload))));

export const updatePackingEntry = async (id, payload) =>
  decorateEntry(await call(axiosInstance.put(`${BASE}/entries/${id}`, toPayload(payload))));

export const setPackingEntryStatus = async (id, status) =>
  decorateEntry(await call(axiosInstance.post(`${BASE}/entries/${id}/status`, { status })));

export const deletePackingEntry = (id) => call(axiosInstance.delete(`${BASE}/entries/${id}`));

/** Cartons and pieces packed on `date` (YYYY-MM-DD), one row per order/style. */
export const getDailyPackingSummary = (date) =>
  call(axiosInstance.get(`${BASE}/daily-summary`, { params: { date } }));
