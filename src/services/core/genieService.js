import axiosInstance from './axiosInstance';

/**
 * POST /genie/chat — one turn with the Help Genie: { screenId, message | audioBase64, history,
 * context } → { reply, transcript, actions, proposals }. Silent: the panel shows its own errors.
 */
export const genieChat = async (body, signal) => {
  const { data } = await axiosInstance.post('/genie/chat', body, { timeout: 120000, silent: true, signal });
  return data;
};

export const genieErrorMessage = (err) => {
  if (err?.code === 'ECONNABORTED') return 'The Genie took too long to answer. Try asking for one thing at a time.';
  if (!err?.response) return 'The server could not be reached. Check the connection and try again.';
  if (err.response.status === 403) return 'You do not have access to the Genie on this screen.';
  return err.response.data?.message || 'The Genie could not answer. Try again.';
};

/** A recorded File → base64 without the data: prefix. */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});
