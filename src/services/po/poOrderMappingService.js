/**
 * PO–Order Mapping API surface — the ONLY file screens import.
 *
 * Mock-only during this phase; every function keeps the signature the future real
 * endpoints (/api/v1/purchase-orders/order-mapping/…) will take, so integration
 * swaps the delegate without touching a screen. Flipping the flag before a
 * backend exists throws a loud, named error rather than returning undefined.
 */
import { USE_MOCK_PO_ORDER_MAPPING_DATA } from './poOrderMappingEnv';
import * as mockApi from './poOrderMappingMockApi';

const notReady = () => { throw new Error('PO–Order Mapping backend not implemented yet — mock phase'); };
const api = USE_MOCK_PO_ORDER_MAPPING_DATA ? mockApi : new Proxy({}, { get: () => notReady });

// ── Reads ── GET /purchase-orders/order-mapping/*
export const searchMappablePos = (...a) => api.searchMappablePos(...a);
export const getPoMapping = (...a) => api.getPoMapping(...a);
export const listMappableOrders = (...a) => api.listMappableOrders(...a);
export const listMappingSuppliers = (...a) => api.listMappingSuppliers(...a);

// ── Writes ── POST/DELETE /{poId}/allocations, POST /{poId}/map-all, PUT /{poId}/stock-only
export const addAllocation = (...a) => api.addAllocation(...a);
export const removeAllocation = (...a) => api.removeAllocation(...a);
export const mapWholePo = (...a) => api.mapWholePo(...a);
export const setStockOnly = (...a) => api.setStockOnly(...a);
