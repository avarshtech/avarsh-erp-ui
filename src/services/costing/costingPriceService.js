import axiosInstance from '../core/axiosInstance';

/** Recent PO prices for one variant, newest first: [{price, vendor, date, poNo, uomSymbol}]. */
export const getVariantPastPrices = async (variantId) => {
  if (!variantId) return [];
  const { data } = await axiosInstance.get('/cost-sheets/past-prices', { params: { variantId }, silent: true });
  return data ?? [];
};

/** Newest PO price and newest costing rate per variant: [{variantId, poPrice, costingPrice, …}]. */
export const getLastPrices = async (variantIds) => {
  const ids = [...new Set((variantIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data } = await axiosInstance.get('/cost-sheets/last-prices', { params: { variantIds: ids.join(',') } });
  return data ?? [];
};

/** Recent cost sheets to copy from, optionally one buyer's. */
export const getRecentCostings = async ({ buyerId, limit = 15 } = {}) => {
  const { data } = await axiosInstance.get('/cost-sheets/recent', { params: { buyerId, limit } });
  return data ?? [];
};
