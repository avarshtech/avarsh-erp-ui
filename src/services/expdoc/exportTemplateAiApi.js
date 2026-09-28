import axiosInstance from '../core/axiosInstance';
import { catalogueForReader } from '../../utils/expDocTemplateSchema';

/** Reading a three-page workbook with its sheets can take a couple of minutes. */
const AI_TIMEOUT_MS = 180000;

/**
 * POST /export-docs/templates/extract — a buyer's packing list / invoice (PDF or Excel)
 * read into template drafts for review (ExtractionResultDTO). Nothing is saved. The
 * field catalogue travels with the file, so the screens stay its single owner. Silent:
 * the upload dialog shows the error where it happened.
 */
export const extractTemplate = async (file, { buyerId, docTypeHint, signal } = {}) => {
  const form = new FormData();
  form.append('file', file, file.name);
  if (buyerId) form.append('buyerId', buyerId);
  form.append('docTypeHint', docTypeHint || 'AUTO');
  form.append('catalogue', JSON.stringify(catalogueForReader()));
  const { data } = await axiosInstance.post('/export-docs/templates/extract', form, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: AI_TIMEOUT_MS, silent: true, signal,
  });
  return data;
};

/** The server's own words where it gave some; otherwise what most likely went wrong. */
export const templateAiErrorMessage = (err) => {
  if (err?.code === 'ECONNABORTED') return 'The AI took too long to read this document. Try again, or upload one sheet at a time.';
  if (!err?.response) return 'The server could not be reached. Check the connection and try again.';
  return err.response.data?.message || 'The AI could not read this document. Try again.';
};

export const isAiNotConfigured = (err) => err?.response?.status === 503;

/**
 * 422: the file was checked and refused — it is not a packing list or an invoice, or
 * not the type the user chose. The message says what it is instead.
 */
export const isNotATemplateDocument = (err) => err?.response?.status === 422;
