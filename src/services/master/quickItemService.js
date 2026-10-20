import axiosInstance from '../core/axiosInstance';

/**
 * Find or create one material: the item for its Category / Sub-category / Item Type and the
 * variant by name within it. Returns {item, variant, itemCreated, variantCreated, classifiersCreated}.
 */
export const findOrCreateItem = async (request) => {
  const { data } = await axiosInstance.post('/items/find-or-create', request);
  return data;
};

/**
 * All rows or none. A refused batch rejects with error.response.data.rowErrors keyed by clientRef.
 * `config` passes through to axios ({ silent: true } when the caller shows the errors itself).
 */
export const findOrCreateItems = async (rows, config) => {
  const { data } = await axiosInstance.post('/items/find-or-create/batch', { rows }, config);
  return data;
};
