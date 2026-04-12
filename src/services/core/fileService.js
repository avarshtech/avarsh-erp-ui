import axiosInstance, { upload } from './axiosInstance';

/**
 * File Storage API Service
 * Centralized service for all file upload/download/delete operations.
 * Works with the backend /api/v1/files endpoints.
 */

const ENDPOINTS = {
  FILES: '/files',
  UPLOAD: '/files/upload',
  DOWNLOAD: '/files/download',
  METADATA: '/files/metadata',
  ENTITY: '/files/entity',
};

/**
 * Upload a file to GCS via the file storage API.
 *
 * @param {File} file - The file to upload
 * @param {Object} params - Upload parameters
 * @param {string} params.module - Module enum (ITEM_VARIANT, PURCHASE_ORDER, etc.)
 * @param {string} params.entity - Entity enum (ITEM_VARIANT, PO, etc.)
 * @param {number} [params.entityId] - Entity ID (optional for new entities)
 * @param {string} params.fileCategory - File category (IMAGE, DOCUMENT, PHOTO, etc.)
 * @param {string} [params.description] - Optional description
 * @param {Function} [onProgress] - Upload progress callback (percent: number)
 * @returns {Promise<Object>} FileStorageDTO
 */
export const uploadFile = async (file, params, onProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', params.module);
  formData.append('entity', params.entity);
  if (params.entityId != null) formData.append('entityId', params.entityId);
  formData.append('fileCategory', params.fileCategory);
  if (params.description) formData.append('description', params.description);

  return upload(ENDPOINTS.UPLOAD, formData, onProgress);
};

/**
 * Soft-delete a file by its UUID.
 * @param {string} fileId - File UUID
 * @returns {Promise<Object>} { success, message, fileId }
 */
export const deleteFile = async (fileId) => {
  const response = await axiosInstance.delete(`${ENDPOINTS.FILES}/${fileId}`);
  return response.data;
};

/**
 * Get all active files for a specific entity.
 * @param {string} entity - Entity enum (ITEM_VARIANT, PO, etc.)
 * @param {number} entityId - Entity instance ID
 * @returns {Promise<Array>} List of FileStorageDTO
 */
export const getFilesByEntity = async (entity, entityId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.ENTITY}/${entity}/${entityId}`);
  return response.data;
};

/**
 * Download a file as a Blob (for preview / display).
 * Uses the axios instance so the auth token is included.
 * @param {string} fileId - File UUID
 * @returns {Promise<Blob>}
 */
export const downloadFileAsBlob = async (fileId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.DOWNLOAD}/${fileId}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get file metadata by UUID.
 * @param {string} fileId - File UUID
 * @returns {Promise<Object>} FileStorageDTO
 */
export const getFileMetadata = async (fileId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.METADATA}/${fileId}`);
  return response.data;
};

export default {
  uploadFile,
  deleteFile,
  getFilesByEntity,
  downloadFileAsBlob,
  getFileMetadata,
};
