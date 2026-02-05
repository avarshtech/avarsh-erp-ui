import axiosInstance from './axiosInstance';

/**
 * Item Master API Service
 * Contains all API methods for Item Master operations
 */

const ENDPOINTS = {
  ITEM_META_DATA: '/items/meta',
  ITEMS: '/items',
};

/**
 * Get all items
 * @returns {Promise<Array>} List of items
 */
export const getItems = async () => {
  return axiosInstance.get(ENDPOINTS.ITEMS);
};

/**
 * Get item metadata (categories, subcategories, item types with attributes and UOMs)
 * @returns {Promise<Array>} Metadata array
 */
export const getItemMetaData = async () => {
  return axiosInstance.get(ENDPOINTS.ITEM_META_DATA);
};

/**
 * Get item by ID
 * @param {number} id - Item ID
 * @returns {Promise<Object>} Item data
 */
export const getItemById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.ITEMS}/${id}`);
};

/**
 * Create a new item
 * @param {Object} data - Item data
 * @returns {Promise<Object>} Created item
 */
export const createItem = async (data) => {
  return axiosInstance.post(ENDPOINTS.ITEMS, data);
};

/**
 * Update an existing item
 * @param {Object} data - Updated item data (must include id)
 * @returns {Promise<Object>} Updated item
 */
export const updateItem = async (data) => {
  return axiosInstance.post(ENDPOINTS.ITEMS, data);
};

/**
 * Delete an item
 * @param {number} id - Item ID
 * @returns {Promise<void>}
 */
export const deleteItem = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.ITEMS}/${id}`);
};

/**
 * Search items by query string
 * @param {string} query - Search query
 * @returns {Promise<Array>} Search results
 */
export const searchItems = async (query) => {
  return axiosInstance.get(`${ENDPOINTS.ITEMS}/search`, {
    params: { q: query },
  });
};

/**
 * Get items by array of IDs (with variants)
 * @param {number[]} ids - Array of item IDs
 * @returns {Promise<Array>} Items with variants
 */
export const getItemsByIds = async (ids) => {
  if (!ids || ids.length === 0) {
    return [];
  }
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('ids', id));
  return axiosInstance.get(`${ENDPOINTS.ITEMS}/ids?${params.toString()}`);
};

export default {
  getItems,
  getItemMetaData,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  getItemsByIds,
};
