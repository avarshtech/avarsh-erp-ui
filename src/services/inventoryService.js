/**
 * Inventory Module Service — Mock Data Layer
 * Returns Promises to simulate API calls. Replace with real API when backend is ready.
 */
import {
  MOCK_FABRIC_GRNS, MOCK_ACCESSORIES_GRNS, MOCK_FABRIC_QC, MOCK_TRIMS_QC,
  MOCK_FABRIC_STOCK, MOCK_ACCESSORIES_STOCK, MOCK_FABRIC_ISSUES, MOCK_ACCESSORIES_ISSUES,
  MOCK_ADJUSTMENTS, MOCK_PURCHASE_ORDERS_FOR_GRN, MOCK_PRODUCTION_ORDERS, MOCK_DASHBOARD_STATS,
} from './inventoryMockData';

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// ─── GRN ───────────────────────────────────────────────────────────────────────
export const getGRNList = async (params = {}) => {
  await delay();
  const all = [...MOCK_FABRIC_GRNS, ...MOCK_ACCESSORIES_GRNS].sort((a, b) => b.id - a.id);
  let filtered = all;
  if (params.type) filtered = filtered.filter((g) => g.type === params.type);
  if (params.status) filtered = filtered.filter((g) => g.status === params.status);
  if (params.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter((g) => g.grnNumber.toLowerCase().includes(s) || g.supplier.toLowerCase().includes(s) || g.poNumber.toLowerCase().includes(s));
  }
  return { content: filtered, totalElements: filtered.length };
};

export const getFabricGRN = async (id) => { await delay(); return MOCK_FABRIC_GRNS.find((g) => g.id === Number(id)); };
export const getAccessoriesGRN = async (id) => { await delay(); return MOCK_ACCESSORIES_GRNS.find((g) => g.id === Number(id)); };
export const getPurchaseOrdersForGRN = async () => { await delay(); return MOCK_PURCHASE_ORDERS_FOR_GRN; };

// ─── QC ────────────────────────────────────────────────────────────────────────
export const getFabricQCList = async () => { await delay(); return { content: MOCK_FABRIC_QC, totalElements: MOCK_FABRIC_QC.length }; };
export const getTrimsQCList = async () => { await delay(); return { content: MOCK_TRIMS_QC, totalElements: MOCK_TRIMS_QC.length }; };
export const getFabricQCById = async (id) => { await delay(); return MOCK_FABRIC_QC.find((q) => q.id === Number(id)); };
export const getTrimsQCById = async (id) => { await delay(); return MOCK_TRIMS_QC.find((q) => q.id === Number(id)); };

// ─── STOCK ─────────────────────────────────────────────────────────────────────
export const getFabricStock = async (params = {}) => {
  await delay();
  let filtered = [...MOCK_FABRIC_STOCK];
  if (params.status) filtered = filtered.filter((s) => s.status === params.status);
  if (params.shadeLot) filtered = filtered.filter((s) => s.shadeLot === params.shadeLot);
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((s) => s.rollNumber.toLowerCase().includes(q) || s.fabricDescription.toLowerCase().includes(q));
  }
  return { content: filtered, totalElements: filtered.length };
};

export const getAccessoriesStock = async (params = {}) => {
  await delay();
  let filtered = [...MOCK_ACCESSORIES_STOCK];
  if (params.category) filtered = filtered.filter((s) => s.category === params.category);
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((s) => s.itemCode.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }
  return { content: filtered, totalElements: filtered.length };
};

// ─── ISSUE ─────────────────────────────────────────────────────────────────────
export const getFabricIssueList = async () => { await delay(); return { content: MOCK_FABRIC_ISSUES, totalElements: MOCK_FABRIC_ISSUES.length }; };
export const getAccessoriesIssueList = async () => { await delay(); return { content: MOCK_ACCESSORIES_ISSUES, totalElements: MOCK_ACCESSORIES_ISSUES.length }; };
export const getProductionOrders = async () => { await delay(); return MOCK_PRODUCTION_ORDERS; };

// ─── ADJUSTMENT ────────────────────────────────────────────────────────────────
export const getAdjustmentList = async () => { await delay(); return { content: MOCK_ADJUSTMENTS, totalElements: MOCK_ADJUSTMENTS.length }; };

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
export const getDashboardStats = async () => { await delay(); return MOCK_DASHBOARD_STATS; };
