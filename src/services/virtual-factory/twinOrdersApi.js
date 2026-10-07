import { newest, twinGet } from './twinHttp';

/** Orders, supplier POs and the material checks behind them (read-only). */
export const fetchOrders = () => twinGet('/orders/search', newest(60, { orderType: 'BULK' }));

export const fetchPurchaseOrders = () => twinGet('/purchase-orders/search', newest(25));

/** Confirmed and in-production orders with their BOM, for the material check. */
export const fetchEligibleOrders = () => twinGet('/production/eligible-orders');

/** Stock against an order's BOM: one row per material, with shortageSurplus = available − required. */
export const fetchStockByBom = (order, kind) => twinGet(`/production/stock-by-bom/${order.bomId}`, { kind, orderNo: order.orderNo });
