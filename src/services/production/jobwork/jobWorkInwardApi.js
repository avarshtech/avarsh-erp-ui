/**
 * Inward job work — job orders, principals and new orders: /api/v1/job-work/inward/orders*, the Buyer
 * master's principal fields and Orders of type Job work (mock-only for now).
 */
import * as orders from './inwardMockOrders';
import * as masters from './inwardMockMasters';
import { resetInwardDb } from './inwardStore';
import { latency } from './jobWorkTrackerStore';

export const searchJobOrders = async (filters) => orders.searchJobOrders(filters);
export const getJobOrderKpis = async (filters) => orders.getJobOrderKpis(filters);
export const getJobOrder = async (id) => orders.getJobOrder(id);
export const closeJobOrder = async (id, body) => orders.closeJobOrder(id, body);
export const cancelJobOrder = async (id, body) => orders.cancelJobOrder(id, body);
export const listInwardFilterOptions = async () => orders.listInwardFilterOptions();
export const createJobOrder = async (payload) => masters.createJobOrder(payload);
export const listPrincipals = async () => masters.listPrincipals();
export const savePrincipal = async (payload) => masters.savePrincipal(payload);
export const resetInwardDemoData = async () => {
  resetInwardDb();
  return latency({ ok: true });
};
