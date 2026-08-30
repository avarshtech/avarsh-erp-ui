import axiosInstance from './axiosInstance';

const AI_BASE = '/ai';

/**
 * Extract order line data from a buyer PO document using AI.
 * @param {File} file - The uploaded file (PDF, image, etc.)
 * @param {string} styleNo - Style number to search for in the document
 * @returns {Promise<OrderLineExtractionDTO>}
 */
export const extractOrderLine = async (file, styleNo) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('styleNo', styleNo);

  const response = await axiosInstance.post(`${AI_BASE}/extract-order-line`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min — AI processing can be slow
  });
  return response.data;
};
