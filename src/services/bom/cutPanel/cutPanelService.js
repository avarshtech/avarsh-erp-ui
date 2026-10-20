/**
 * Cut Panel Requirement API client — the screens import only from here. Every command carries the version the
 * screen read and answers with the saved requirement, which the screen adopts.
 */
import axiosInstance from '../../core/axiosInstance';
import { listParams, toHistory, toOrderContext, toPage } from '../requirementApi';

const BASE = '/cut-panel-requirements';
const get = async (url, params) => (await axiosInstance.get(url, { params })).data;
const post = async (url, body) => (await axiosInstance.post(url, body)).data;

/** The server rebuilds descriptions and swatches; a line carries its ids, colour, sequence and quantities. */
const line = ({ colorCode: _code, colorHex: _hex, ...rest }) => rest;
const body = (doc) => ({
  orderId: doc.orderId, orderQtySnapshot: doc.orderQtySnapshot, remarks: doc.remarks,
  lastLineNo: doc.lastLineNo, lines: (doc.lines || []).map(line), version: doc.version,
});

export const listCprs = async (filters) => toPage(await get(BASE, listParams(filters)));
export const getCprFilterOptions = () => get(`${BASE}/filter-options`);
export const getCpr = (id) => get(`${BASE}/${id}`);
export const getCprsForOrder = (orderId, exceptId) => get(`${BASE}/by-order/${orderId}`, { exceptId: exceptId ?? undefined });
export const getCprEligibleOrders = () => get(`${BASE}/eligible-orders`);
export const getCprOrderContext = async (orderId) => toOrderContext(await get(`${BASE}/order-context/${orderId}`));
export const getCprAllocation = (id) => get(`${BASE}/${id}/allocation`);
export const getCprAudit = async (id) => toHistory(await get(`${BASE}/${id}/history`));

export const saveCpr = async (doc) => (doc.id
  ? (await axiosInstance.put(`${BASE}/${doc.id}`, body(doc))).data
  : post(BASE, body(doc)));
export const submitCpr = (doc) => post(`${BASE}/${doc.id}/submit`, { version: doc.version });
export const reviseCpr = (doc) => post(`${BASE}/${doc.id}/revise`, body(doc));
export const closeCpr = (doc, reason) => post(`${BASE}/${doc.id}/close`, { reason, version: doc.version });
export const deleteCpr = async (doc) => { await axiosInstance.delete(`${BASE}/${doc.id}`, { params: { version: doc.version } }); };
