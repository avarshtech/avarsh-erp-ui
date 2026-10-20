import axiosInstance from '../core/axiosInstance';

/** Reading a five-minute recording or a long tech pack can take a couple of minutes. */
const AI_TIMEOUT_MS = 180000;

/**
 * POST /cost-sheets/ai-draft — a voice note, photos, a tech pack and/or text read into a draft
 * cost sheet (AiCostingDraftDTO: transcript, header, rows, warnings, sourceFileIds). Nothing is
 * saved but the source files. Silent: the capture dialog shows the error where it happened.
 */
export const createAiDraft = async ({ files = [], text, buyerId, styleId, signal }) => {
  const form = new FormData();
  files.forEach((file) => form.append('files', file, file.name));
  if (text?.trim()) form.append('text', text.trim());
  if (buyerId) form.append('buyerId', buyerId);
  if (styleId) form.append('styleId', styleId);
  const { data } = await axiosInstance.post('/cost-sheets/ai-draft', form, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: AI_TIMEOUT_MS, silent: true, signal,
  });
  return data;
};

/** The server's own words where it gave some; otherwise what most likely went wrong. */
export const aiErrorMessage = (err) => {
  if (err?.code === 'ECONNABORTED') return 'The AI took too long to answer. Try a shorter recording or fewer pages.';
  if (!err?.response) return 'The server could not be reached. Check the connection and try again.';
  return err.response.data?.message || 'The AI could not read this. Try again.';
};
