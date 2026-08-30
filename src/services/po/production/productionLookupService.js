/**
 * Shared lookups for the Production PO screens — eligible orders, stock by BOM,
 * vendors, units, PP-sample gate. Real API with mock fallback (productionEnv).
 */
import axiosInstance from '../../core/axiosInstance';
import { USE_MOCK_PRODUCTION_DATA } from './productionEnv';
import * as mockApi from './mockApi';

// Confirmed orders enriched with BOM, PP status, allowance, garment processes and matrix rows.
export const getConfirmedOrders = async () => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getConfirmedOrders();
  const { data } = await axiosInstance.get('/production/eligible-orders');
  return data || [];
};

export const getOrderForPo = async (orderId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getOrderForPo(orderId);
  const { data } = await axiosInstance.get(`/production/eligible-orders/${orderId}`);
  return data;
};

export const getPpApprovalStatus = async (orderId) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getPpApprovalStatus(orderId);
  const { data } = await axiosInstance.get(`/production/pp-status/${orderId}`);
  return data?.status;
};

// Mark the PP sample approved/pending for an order (drives the PO submit gate).
export const setPpApprovalStatus = async (orderId, status = 'COMPLETED') => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getPpApprovalStatus(orderId);
  const { data } = await axiosInstance.patch(`/production/pp-status/${orderId}`, { status });
  return data?.status;
};

/**
 * Stock availability for the order's BOM items.
 * order: { id, bomId, orderNo } (the eligible-order / PO record in state).
 */
export const getStockByBom = async (order, kind = 'fabric', opts = {}) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getStockByBom(order?.id ?? order?.orderId, kind, opts);
  const bomId = order?.bomId;
  if (!bomId) return [];
  const { data } = await axiosInstance.get(`/production/stock-by-bom/${bomId}`, {
    params: {
      kind,
      plannedQty: opts.plannedQty,
      cadPerPc: opts.cadPerPc,
      orderNo: order?.orderNo,
      excludeType: opts.excludeType,
      excludePoId: opts.excludePoId,
    },
  });
  return data || [];
};

// Consumption comparison rows are the fabric stock rows (bomPerPc/cadPerPc/plannedQty
// are all present there) — no separate endpoint needed.
export const getConsumptionComparison = async (order, cadPerPc, plannedQty) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getConsumptionComparison(order?.id ?? order?.orderId, cadPerPc);
  const rows = await getStockByBom(order, 'fabric', { cadPerPc, plannedQty });
  return rows.map((r) => ({
    key: r.key, itemCode: r.itemCode, itemName: r.itemName, uom: r.uom,
    bomPerPc: r.bomPerPc, cadPerPc: r.cadPerPc, plannedQty: plannedQty ?? r.plannedQty,
  }));
};

export const getProcessingUnits = async (type) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getProcessingUnits(type);
  const { data } = await axiosInstance.get('/factories/active');
  return (data || []).map((f) => ({ id: f.id, name: f.factoryName || f.name }));
};

export const getVendors = async (service) => {
  if (USE_MOCK_PRODUCTION_DATA) return mockApi.getVendors(service);
  const { data } = await axiosInstance.get('/production/vendors');
  return data || [];
};

// No sewing-line master exists yet — static list (see gap report).
export const getSewingLines = () => mockApi.getSewingLines();
