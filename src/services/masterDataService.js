import axiosInstance from './axiosInstance';

const ENDPOINTS = {
  CATEGORIES: '/categories',
  SUB_CATEGORIES: '/sub-categories',
  ITEM_TYPES: '/item-types',
  ATTRIBUTES: '/attribute-configs',
  UOMS: '/unit-of-measures',
  VARIANTS: '/variants',
};

// ==================== CATEGORIES ====================

/**
 * Get all categories
 * @returns {Promise<Array>} List of categories
 */
export const getAllCategories = async () => {
  return axiosInstance.get(ENDPOINTS.CATEGORIES);
};

/**
 * Get category by ID
 * @param {number} id - Category ID
 * @returns {Promise<Object>} Category data
 */
export const getCategoryById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.CATEGORIES}/${id}`);
};

/**
 * Create a new category
 * @param {Object} data - Category data { name }
 * @returns {Promise<Object>} Created category
 */
export const createCategory = async (data) => {
  return axiosInstance.post(ENDPOINTS.CATEGORIES, data);
};

/**
 * Update a category
 * @param {number} id - Category ID
 * @param {Object} data - Updated category data
 * @returns {Promise<Object>} Updated category
 */
export const updateCategory = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.CATEGORIES, { id, ...data });
};

/**
 * Delete a category
 * @param {number} id - Category ID
 * @returns {Promise<void>}
 */
export const deleteCategory = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.CATEGORIES}/${id}`);
};

// ==================== SUB-CATEGORIES ====================

/**
 * Get all sub-categories
 * @returns {Promise<Array>} List of sub-categories
 */
export const getAllSubCategories = async () => {
  return axiosInstance.get(ENDPOINTS.SUB_CATEGORIES);
};

/**
 * Get sub-categories by category ID
 * @param {number} categoryId - Parent category ID
 * @returns {Promise<Array>} List of sub-categories
 */
export const getSubCategoriesByCategoryId = async (categoryId) => {
  return axiosInstance.get(`${ENDPOINTS.SUB_CATEGORIES}/category/${categoryId}`);
};

/**
 * Get sub-category by ID
 * @param {number} id - Sub-category ID
 * @returns {Promise<Object>} Sub-category data
 */
export const getSubCategoryById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.SUB_CATEGORIES}/${id}`);
};

/**
 * Create a new sub-category
 * @param {Object} data - Sub-category data { name, categoryId }
 * @returns {Promise<Object>} Created sub-category
 */
export const createSubCategory = async (data) => {
  return axiosInstance.post(ENDPOINTS.SUB_CATEGORIES, data);
};

/**
 * Update a sub-category
 * @param {number} id - Sub-category ID
 * @param {Object} data - Updated sub-category data
 * @returns {Promise<Object>} Updated sub-category
 */
export const updateSubCategory = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.SUB_CATEGORIES, { id, ...data });
};

/**
 * Delete a sub-category
 * @param {number} id - Sub-category ID
 * @returns {Promise<void>}
 */
export const deleteSubCategory = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.SUB_CATEGORIES}/${id}`);
};

// ==================== ITEM TYPES ====================

/**
 * Get all item types
 * @returns {Promise<Array>} List of item types
 */
export const getAllItemTypes = async () => {
  return axiosInstance.get(ENDPOINTS.ITEM_TYPES);
};

/**
 * Get item types by sub-category ID
 * @param {number} subCategoryId - Parent sub-category ID
 * @returns {Promise<Array>} List of item types
 */
export const getItemTypesBySubCategoryId = async (subCategoryId) => {
  return axiosInstance.get(`${ENDPOINTS.ITEM_TYPES}/sub-category/${subCategoryId}`);
};

/**
 * Get item type by ID
 * @param {number} id - Item type ID
 * @returns {Promise<Object>} Item type data
 */
export const getItemTypeById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.ITEM_TYPES}/${id}`);
};

/**
 * Create a new item type
 * @param {Object} data - Item type data { name, subCategoryId, attributeIds, uomIds }
 * @returns {Promise<Object>} Created item type
 */
export const createItemType = async (data) => {
  return axiosInstance.post(ENDPOINTS.ITEM_TYPES, data);
};

/**
 * Update an item type
 * @param {number} id - Item type ID
 * @param {Object} data - Updated item type data
 * @returns {Promise<Object>} Updated item type
 */
export const updateItemType = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.ITEM_TYPES, { id, ...data });
};

/**
 * Delete an item type
 * @param {number} id - Item type ID
 * @returns {Promise<void>}
 */
export const deleteItemType = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.ITEM_TYPES}/${id}`);
};

// ==================== ATTRIBUTES ====================

/**
 * Get all attribute configurations
 * @returns {Promise<Array>} List of attributes
 */
export const getAllAttributes = async () => {
  return axiosInstance.get(ENDPOINTS.ATTRIBUTES);
};

/**
 * Get attribute by ID
 * @param {number} id - Attribute ID
 * @returns {Promise<Object>} Attribute data
 */
export const getAttributeById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.ATTRIBUTES}/${id}`);
};

/**
 * Create a new attribute
 * @param {Object} data - Attribute data { attributeName, dataType }
 * @returns {Promise<Object>} Created attribute
 */
export const createAttribute = async (data) => {
  return axiosInstance.post(ENDPOINTS.ATTRIBUTES, data);
};

/**
 * Update an attribute
 * @param {number} id - Attribute ID
 * @param {Object} data - Updated attribute data
 * @returns {Promise<Object>} Updated attribute
 */
export const updateAttribute = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.ATTRIBUTES, { id, ...data });
};

/**
 * Delete an attribute
 * @param {number} id - Attribute ID
 * @returns {Promise<void>}
 */
export const deleteAttribute = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.ATTRIBUTES}/${id}`);
};

// ==================== UOM (Unit of Measures) ====================

/**
 * Get all unit of measures
 * @returns {Promise<Array>} List of UOMs
 */
export const getAllUOMs = async () => {
  return axiosInstance.get(ENDPOINTS.UOMS);
};

/**
 * Get UOM by ID
 * @param {number} id - UOM ID
 * @returns {Promise<Object>} UOM data
 */
export const getUOMById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.UOMS}/${id}`);
};

/**
 * Create a new UOM
 * @param {Object} data - UOM data { name }
 * @returns {Promise<Object>} Created UOM
 */
export const createUOM = async (data) => {
  return axiosInstance.post(ENDPOINTS.UOMS, data);
};

/**
 * Update a UOM
 * @param {number} id - UOM ID
 * @param {Object} data - Updated UOM data
 * @returns {Promise<Object>} Updated UOM
 */
export const updateUOM = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.UOMS, { id, ...data });
};

/**
 * Delete a UOM
 * @param {number} id - UOM ID
 * @returns {Promise<void>}
 */
export const deleteUOM = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.UOMS}/${id}`);
};

// ==================== VARIANTS ====================

/**
 * Get all variants
 * @returns {Promise<Array>} List of variants
 */
export const getAllVariants = async () => {
  return axiosInstance.get(ENDPOINTS.VARIANTS);
};

/**
 * Get variant by ID
 * @param {number} id - Variant ID
 * @returns {Promise<Object>} Variant data
 */
export const getVariantById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.VARIANTS}/${id}`);
};

/**
 * Create a new variant
 * @param {Object} data - Variant data
 * @returns {Promise<Object>} Created variant
 */
export const createVariant = async (data) => {
  return axiosInstance.post(ENDPOINTS.VARIANTS, data);
};

/**
 * Update a variant
 * @param {number} id - Variant ID
 * @param {Object} data - Updated variant data
 * @returns {Promise<Object>} Updated variant
 */
export const updateVariant = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.VARIANTS, { id, ...data });
};

/**
 * Delete a variant
 * @param {number} id - Variant ID
 * @returns {Promise<void>}
 */
export const deleteVariant = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.VARIANTS}/${id}`);
};

export default {
  // Categories
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Sub-Categories
  getAllSubCategories,
  getSubCategoriesByCategoryId,
  getSubCategoryById,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  // Item Types
  getAllItemTypes,
  getItemTypesBySubCategoryId,
  getItemTypeById,
  createItemType,
  updateItemType,
  deleteItemType,
  // Attributes
  getAllAttributes,
  getAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  // UOMs
  getAllUOMs,
  getUOMById,
  createUOM,
  updateUOM,
  deleteUOM,
  // Variants
  getAllVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
};
