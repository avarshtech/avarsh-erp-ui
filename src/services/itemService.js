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
export const updateItem = async (id, data) => {
  return axiosInstance.put(`${ENDPOINTS.ITEMS}/${id}`, data);
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
 * Autocomplete items by query string (for dropdowns/search inputs)
 * @param {string} query - Search query
 * @returns {Promise<Array>} Autocomplete results (ItemDTO[])
 */
export const autocompleteItems = async (query) => {
  return axiosInstance.get(`${ENDPOINTS.ITEMS}/autocomplete`, {
    params: { q: query },
  });
};

/**
 * Search items with pagination and filters (for Item Master table)
 * @param {Object} params - Search parameters
 * @param {number} params.page - Page number (0-indexed)
 * @param {number} params.size - Page size
 * @param {string} params.sort - Sort field
 * @param {string} params.direction - Sort direction (asc/desc)
 * @param {string} params.search - Free-text search keyword
 * @param {number} params.categoryId - Filter by category
 * @param {number} params.subCategoryId - Filter by sub-category
 * @param {number} params.itemTypeId - Filter by item type
 * @param {boolean} params.isActive - Filter by active status
 * @returns {Promise<Object>} Paginated response { content, totalElements, totalPages, pageNumber, pageSize, last }
 */
export const searchItems = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.direction) queryParams.append('direction', params.direction);
  if (params.search) queryParams.append('search', params.search);
  if (params.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params.subCategoryId) queryParams.append('subCategoryId', params.subCategoryId);
  if (params.itemTypeId) queryParams.append('itemTypeId', params.itemTypeId);
  if (params.isActive !== undefined && params.isActive !== null && params.isActive !== '') {
    queryParams.append('isActive', params.isActive);
  }
  const queryString = queryParams.toString();
  const url = `${ENDPOINTS.ITEMS}/search?${queryString}`;
  return axiosInstance.get(url);
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
  autocompleteItems,
  searchItems,
  getItemsByIds,
};
