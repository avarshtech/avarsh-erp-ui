import axiosInstance from '../core/axiosInstance';

/**
 * Item Variant API service.
 */

const ENDPOINTS = {
  VARIANT_SEARCH: '/variants/search',
};

/**
 * Search active variants within a category ("Fabric" / "Trims") by variant code or name.
 * A blank query returns the latest variants (newest first). Used by variant pickers such as
 * the costing fabric/trim dropdowns.
 *
 * @param {Object} params
 * @param {string} params.category - Category name to filter by (e.g. "Fabric", "Trims")
 * @param {string} [params.q] - Search text (matches variant code or name)
 * @param {number} [params.limit=10] - Max results
 * @returns {Promise<Array>} ItemVariantDTO[]
 */
export const searchVariants = async ({ category, q = '', limit = 10 }) => {
  const params = new URLSearchParams();
  params.append('category', category);
  if (q) params.append('q', q);
  params.append('limit', limit);
  return axiosInstance.get(`${ENDPOINTS.VARIANT_SEARCH}?${params.toString()}`);
};

/**
 * Bulk variant lookup by ids. Returns ItemVariantDTO[] (order not guaranteed).
 * @param {number[]} ids
 */
export const getVariantsByIds = async (ids = []) => {
  const clean = (ids || []).filter((id) => id != null);
  if (clean.length === 0) return [];
  const params = new URLSearchParams();
  clean.forEach((id) => params.append('ids', id));
  return axiosInstance.get(`/variants/ids?${params.toString()}`);
};

export default { searchVariants, getVariantsByIds };
