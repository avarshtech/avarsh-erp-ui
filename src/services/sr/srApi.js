/**
 * Real `/api/v1/sample-*` client — functions are added per cutover stage.
 *
 * srService.js is the only file screens import; it delegates here instead of
 * to the srMock* modules as each stage lands.
 */
import axiosInstance from '../core/axiosInstance';

/** Every Sample Request endpoint hangs off this path (axiosInstance owns /api/v1). */
export const BASE = '/sample-requests';

const MASTERS = `${BASE}/masters`;

// ── Masters ─────────────────────────────────────────────────────────────────
// Fixed by the process rather than by a user, so they are served from one place
// and cached by useSampleMasters instead of being fetched per screen.

export const listSampleTypes = async () => (await axiosInstance.get(`${MASTERS}/sample-types`)).data;

export const listCouriers = async () => (await axiosInstance.get(`${MASTERS}/couriers`)).data;

export const listRejectionReasons = async () => (await axiosInstance.get(`${MASTERS}/rejection-reasons`)).data;

/**
 * One global label set — the per-buyer variant the mock carried was dropped,
 * so the buyer name callers still pass is accepted and ignored.
 */
export const getFeedbackCategoryLabels = async () => (await axiosInstance.get(`${MASTERS}/feedback-categories`)).data;

export const listHsnCodes = async () => (await axiosInstance.get(`${MASTERS}/hsn-codes`)).data;

/** HSN for a garment category, falling back to the Default row then to blank. */
export const getHsnDefault = async (category) => {
  const codes = await listHsnCodes();
  const hit = codes.find((c) => category && c.category?.toLowerCase() === String(category).toLowerCase());
  return (hit || codes.find((c) => c.category === 'Default') || {}).code || '';
};
