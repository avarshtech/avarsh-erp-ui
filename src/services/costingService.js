/**
 * Costing Service — Real API Integration
 * All endpoints follow the backend Swagger spec (CostSheetController).
 * Uses the same exported function names so frontend components work without import changes.
 */

import axiosInstance, { upload } from './axiosInstance';

const ENDPOINTS = {
  COST_SHEETS: '/cost-sheets',
  EXCHANGE_RATES: '/exchange-rates',
};

// ==================== CRUD OPERATIONS ====================

/**
 * Search cost sheets with filters and pagination.
 * GET /api/v1/cost-sheets/search?search=&status=&buyerId=&season=&dateFrom=&dateTo=&page=&size=&sort=&direction=
 * @param {Object} params - CostSheetSearchRequest query parameters
 * @returns {Promise<Object>} PaginatedResponseCostSheetResponse { content, totalElements, totalPages, pageNumber, pageSize, last }
 */
export const searchCostSheets = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  if (params.buyerId) queryParams.append('buyerId', params.buyerId);
  if (params.season) queryParams.append('season', params.season);
  if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.direction) queryParams.append('direction', params.direction);

  const queryString = queryParams.toString();
  const url = `${ENDPOINTS.COST_SHEETS}/search${queryString ? `?${queryString}` : ''}`;
  const response = await axiosInstance.get(url);
  const data = response.data;

  // Normalize pagination fields for frontend compatibility
  return {
    content: data.content || [],
    totalElements: data.totalElements || 0,
    totalPages: data.totalPages || 0,
    size: data.pageSize ?? data.size ?? 25,
    number: data.pageNumber ?? data.number ?? 0,
    last: data.last,
  };
};

/**
 * Get a cost sheet by ID (includes full detail with history).
 * GET /api/v1/cost-sheets/{id}
 * @param {number|string} id - Cost sheet ID
 * @returns {Promise<Object>} CostSheetResponse
 */
export const getCostSheetById = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.COST_SHEETS}/${id}`);
  return response.data;
};

/**
 * Get a cost sheet by its human-readable costing ID (e.g. CST/25-26/1001).
 * GET /api/v1/cost-sheets/costing-id/{costingId}
 * @param {string} costingId - Costing ID string
 * @returns {Promise<Object>} CostSheetResponse
 */
export const getCostSheetByCostingId = async (costingId) => {
  const response = await axiosInstance.get(`${ENDPOINTS.COST_SHEETS}/by-costing-id`, {
    params: { costingId },
  });
  return response.data;
};

/**
 * Create a new cost sheet.
 * POST /api/v1/cost-sheets (no id in body)
 * @param {Object} data - CostSheetRequest payload
 * @returns {Promise<Object>} CostSheetResponse
 */
export const createCostSheet = async (data) => {
  const { id, costingId, createdAt, updatedAt, history, ...payload } = data;
  const response = await axiosInstance.post(ENDPOINTS.COST_SHEETS, payload);
  return response.data;
};

/**
 * Update an existing cost sheet.
 * POST /api/v1/cost-sheets (id in body = update)
 * @param {number|string} id - Cost sheet ID
 * @param {Object} data - CostSheetRequest payload (partial or full)
 * @returns {Promise<Object>} CostSheetResponse
 */
export const updateCostSheet = async (id, data) => {
  const payload = { id: Number(id), ...data };
  const response = await axiosInstance.post(ENDPOINTS.COST_SHEETS, payload);
  return response.data;
};

/**
 * Delete a cost sheet (Draft status only).
 * DELETE /api/v1/cost-sheets/{id}
 * @param {number|string} id - Cost sheet ID
 * @returns {Promise<void>}
 */
export const deleteCostSheet = async (id) => {
  await axiosInstance.delete(`${ENDPOINTS.COST_SHEETS}/${id}`);
};

/**
 * Duplicate a cost sheet as a new Draft.
 * POST /api/v1/cost-sheets/{id}/duplicate
 * @param {number|string} id - Source cost sheet ID
 * @returns {Promise<Object>} CostSheetResponse (the new duplicate)
 */
export const duplicateCostSheet = async (id) => {
  const response = await axiosInstance.post(`${ENDPOINTS.COST_SHEETS}/${id}/duplicate`);
  return response.data;
};

// ==================== HISTORY ====================

/**
 * Get revision history for a cost sheet.
 * GET /api/v1/cost-sheets/{id}/history
 * @param {number|string} id - Cost sheet ID
 * @returns {Promise<Array>} HistoryEntryDTO[]
 */
export const getCostSheetHistory = async (id) => {
  const response = await axiosInstance.get(`${ENDPOINTS.COST_SHEETS}/${id}/history`);
  return response.data ?? [];
};

// ==================== PAST PRICES ====================

/**
 * Get past PO price suggestions for a given item.
 * GET /api/v1/cost-sheets/past-prices?type=fabric&itemId=42
 * @param {string} type - Item category ('fabric', 'trim', 'manufacturing', 'overhead')
 * @param {number} itemId - Item ID from items table
 * @returns {Promise<Array>} PastPriceSuggestionDTO[]
 */
export const getPastPOSuggestions = async (type, itemId) => {
  if (!itemId) return [];
  const response = await axiosInstance.get(`${ENDPOINTS.COST_SHEETS}/past-prices`, {
    params: { type, itemId },
  });
  return response.data ?? [];
};

// ==================== SUMMARIES ====================

/**
 * Get all cost sheet summaries for comparison dropdown (minimal data).
 * GET /api/v1/cost-sheets/summaries
 * @returns {Promise<Array>} CostSheetSummaryDTO[]
 */
export const getAllCostSheetSummaries = async () => {
  const response = await axiosInstance.get(`${ENDPOINTS.COST_SHEETS}/summaries`);
  return response.data ?? [];
};

// ==================== EXCHANGE RATES ====================

/**
 * Get today's exchange rate between two currencies.
 * Tries the backend first, then falls back to the free open ExchangeRate-API.
 * @param {string} fromCurrency - Source currency code (e.g. 'USD')
 * @param {string} toCurrency - Target currency code (e.g. 'INR')
 * @returns {Promise<number>} Exchange rate value
 */
export const getTodaysRate = async (fromCurrency, toCurrency) => {
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return 1;

  // Try live open exchange rate API first for up-to-date rates
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${fromCurrency}`
    );
    const data = await res.json();
    if (data?.result === 'success' && data.rates?.[toCurrency]) {
      return data.rates[toCurrency];
    }
  } catch {
    // Open API unavailable — fall through to backend
  }

  // Fallback: backend exchange rate
  try {
    const response = await axiosInstance.get(`${ENDPOINTS.EXCHANGE_RATES}/today`, {
      params: { from: fromCurrency, to: toCurrency },
    });
    if (response.data?.rate) return response.data.rate;
  } catch {
    // Backend also unavailable
  }

  return 1;
};

// ==================== TECHPACK AI IMPORT ====================

/**
 * Upload a Buyer Techpack PDF and extract costing data using AI.
 * The backend runs Gemini extraction + master data matching.
 * Returns TechpackCostingDTO with match info for the frontend review modal.
 * POST /api/v1/cost-sheets/extract-techpack (multipart/form-data)
 * @param {File} file - PDF techpack file
 * @returns {Promise<Object>} TechpackCostingDTO
 */
export const extractTechpackForCosting = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return upload(`${ENDPOINTS.COST_SHEETS}/extract-techpack`, formData);
};

// ==================== CONSUMPTION CALCULATION ====================

/**
 * Calculate fabric consumption per size from a measurement chart + optional techpack.
 * AI uses industry-standard formulas:
 *   Knits → L × W × NOP × GSM / 10000 per panel → kg
 *   Woven → panel area / fabric width / marker efficiency → meters
 * POST /api/v1/cost-sheets/calculate-consumption (multipart/form-data)
 * @param {File} measurementChart - Size spec image (PNG/JPG) or PDF
 * @param {File|null} [techpack] - Optional techpack PDF (improves GSM/classification accuracy)
 * @returns {Promise<Object>} ConsumptionExtractionDTO
 */
export const calculateConsumption = async (measurementChart, techpack = null) => {
  const formData = new FormData();
  formData.append('measurementChart', measurementChart);
  if (techpack) formData.append('techpack', techpack);
  return upload(`${ENDPOINTS.COST_SHEETS}/calculate-consumption`, formData);
};

// ==================== ATTACHMENTS (Generic File Storage) ====================

/**
 * Batch upload categorized file attachments for a cost sheet.
 * Sends all files in a single network request.
 * POST /api/v1/files/upload-batch (multipart/form-data)
 * @param {number|string} costSheetId - Cost sheet ID
 * @param {Array<{file: File, category: string}>} items - Files with their categories
 * @param {Function} [onProgress] - Optional upload progress callback
 * @returns {Promise<Array>} FileStorageDTO[]
 */
export const uploadAttachmentsBatch = async (costSheetId, items, onProgress) => {
  if (!items.length) return [];
  const formData = new FormData();
  formData.append('module', 'COSTING');
  formData.append('entity', 'COST_SHEET');
  formData.append('entityId', costSheetId);
  items.forEach(({ file, category }) => {
    formData.append('files', file);
    formData.append('fileCategories', category);
  });
  return upload('/files/upload-batch', formData, onProgress);
};

/**
 * Get all attachments for a cost sheet, grouped by category.
 * GET /api/v1/files/entity/COST_SHEET/{costSheetId}
 * @param {number|string} costSheetId - Cost sheet ID
 * @returns {Promise<Array>} FileStorageDTO[]
 */
export const getAttachments = async (costSheetId) => {
  const response = await axiosInstance.get(`/files/entity/COST_SHEET/${costSheetId}`);
  return response.data ?? [];
};

/**
 * Download an attachment file.
 * GET /api/v1/files/download/{fileId}
 * @param {string} fileId - File UUID
 * @returns {Promise<Blob>} File binary data
 */
export const downloadAttachment = async (fileId) => {
  const response = await axiosInstance.get(
    `/files/download/${fileId}`,
    { responseType: 'blob' }
  );
  return response.data;
};

/**
 * Delete an attachment (soft delete).
 * DELETE /api/v1/files/{fileId}
 * @param {string} fileId - File UUID
 * @returns {Promise<void>}
 */
export const deleteAttachment = async (fileId) => {
  await axiosInstance.delete(`/files/${fileId}`);
};

// ==================== WHATSAPP NOTIFICATIONS ====================

/**
 * Send a WhatsApp notification for a cost sheet.
 * POST /api/v1/whatsapp/test/send
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} templateName - WhatsApp template name
 * @param {string} [languageCode='en_US'] - Language code
 * @returns {Promise<Object>} Response with success status
 */
export const sendWhatsAppNotification = async (phoneNumber, templateName, languageCode = 'en_US') => {
  const response = await axiosInstance.post('/whatsapp/test/send', {
    phoneNumber,
    templateName,
    languageCode,
  });
  return response.data;
};
