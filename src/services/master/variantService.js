import axiosInstance from '../core/axiosInstance';

/**
 * Item Variant API Service
 *
 * Variants are the purchasable identity in the ERP — costing, BOM, PO, GRN and QC
 * all key off variantId / variantCode rather than the parent item.
 */

const ENDPOINTS = {
  VARIANTS: '/variants',
};

/**
 * Search active variants within a category by variant code or name.
 * A blank query returns the newest variants first.
 * @param {Object} params
 * @param {string} params.category - Exact category name, e.g. 'Fabric' or 'Local Trims'
 * @param {string} [params.q] - Free-text match on variant code or name
 * @param {number} [params.limit=10] - Max results (server caps at 50)
 * @returns {Promise<Array>} List of ItemVariantDTO
 */
export const searchVariants = async ({ category, q = '', limit = 10 }) => {
  const params = new URLSearchParams({ category, q, limit: String(limit) });
  return axiosInstance.get(`${ENDPOINTS.VARIANTS}/search?${params.toString()}`);
};

/**
 * Bulk variant lookup by IDs — used to resolve variant identity for saved lines.
 *
 * Result order is NOT guaranteed to match the requested id order, so callers must
 * key results by variantId rather than by array index.
 *
 * @param {number[]} ids
 * @returns {Promise<Array>} List of ItemVariantDTO
 */
export const getVariantsByIds = async (ids) => {
  const clean = (ids || []).filter((id) => id != null);
  if (clean.length === 0) return [];
  const params = new URLSearchParams();
  clean.forEach((id) => params.append('ids', id));
  return axiosInstance.get(`${ENDPOINTS.VARIANTS}/ids?${params.toString()}`);
};

export default { searchVariants, getVariantsByIds };
