/**
 * Garment Process Requirement API client — the screens import only from here. Every command carries the version
 * the screen read and answers with the saved requirement, which the screen adopts.
 */
import axiosInstance from '../../core/axiosInstance';
import { listParams, toHistory, toOrderContext, toPage } from '../requirementApi';

const BASE = '/garment-process-requirements';
const get = async (url, params) => (await axiosInstance.get(url, { params })).data;
const post = async (url, body) => (await axiosInstance.post(url, body)).data;

const body = (doc) => ({
  orderId: doc.orderId, remarks: doc.remarks, lastLineNo: doc.lastLineNo, lines: doc.lines || [], version: doc.version,
});

export const listGprs = async (filters) => toPage(await get(BASE, listParams(filters)));
export const getGprFilterOptions = () => get(`${BASE}/filter-options`);
export const getGpr = (id) => get(`${BASE}/${id}`);
export const getGprsForOrder = (orderId, exceptId) => get(`${BASE}/by-order/${orderId}`, { exceptId: exceptId ?? undefined });
export const getGprEligibleOrders = () => get(`${BASE}/eligible-orders`);
export const getGprOrderContext = async (orderId) => toOrderContext(await get(`${BASE}/order-context/${orderId}`));
export const getGprAllocation = (id) => get(`${BASE}/${id}/allocation`);
export const getGprAudit = async (id) => toHistory(await get(`${BASE}/${id}/history`));

export const saveGpr = async (doc) => (doc.id
  ? (await axiosInstance.put(`${BASE}/${doc.id}`, body(doc))).data
  : post(BASE, body(doc)));
export const submitGpr = (doc) => post(`${BASE}/${doc.id}/submit`, { version: doc.version });
export const reviseGpr = (doc) => post(`${BASE}/${doc.id}/revise`, body(doc));
export const closeGpr = (doc, reason) => post(`${BASE}/${doc.id}/close`, { reason, version: doc.version });
