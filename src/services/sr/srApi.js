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

// ── Sample requests ─────────────────────────────────────────────────────────
// The list endpoint answers with PaginatedResponse{content,pageNumber,pageSize,
// totalElements,totalPages,last}; the table wants the AntD/Spring-page shape,
// so it is normalised in one place rather than in every caller.

const toPage = (data) => ({
  content:       data?.content       || [],
  totalElements: data?.totalElements || 0,
  totalPages:    data?.totalPages    || 0,
  size:          data?.pageSize      ?? data?.size   ?? 10,
  number:        data?.pageNumber    ?? data?.number ?? 0,
});

/** Filters bind straight from the query string (SampleRequestSearchRequest). */
export const searchSampleRequests = async (params = {}) => toPage((await axiosInstance.get(BASE, { params })).data);

export const getSampleRequest = async (id) => (await axiosInstance.get(`${BASE}/${id}`)).data;

export const createSampleRequest = async (payload) => (await axiosInstance.post(BASE, payload)).data;

export const updateSampleRequest = async (id, payload) => (await axiosInstance.put(`${BASE}/${id}`, payload)).data;

/** The two fields that stay editable once the sample is In Production. */
export const updateInstructions = async (id, payload) => (await axiosInstance.patch(`${BASE}/${id}/instructions`, payload)).data;

export const deleteSampleRequest = async (id) => { await axiosInstance.delete(`${BASE}/${id}`); };

/**
 * Order numbers carry slashes (SG/26-27/1001), so the order goes in the query
 * string — a path segment would split into two.
 */
export const listByOrderNo = async (orderNo) => (await axiosInstance.get(`${BASE}/by-order`, { params: { orderNo } })).data;

/** Facet for the list filter — the buyers that actually have sample requests. */
export const listSrBuyers = async () => (await axiosInstance.get(`${BASE}/buyers`)).data;

/**
 * Only DRAFT → SUBMITTED and SUBMITTED → DRAFT are taken here; production,
 * dispatch and the buyer's verdict are recorded where they actually happen.
 */
export const changeStatus = async (id, status, version) => (await axiosInstance.put(`${BASE}/${id}/status`, { status, version })).data;

export const getSampleDashboard = async () => (await axiosInstance.get(`${BASE}/dashboard`)).data;

/** Comments typed but not yet ruled on — the request stays where it is. */
export const saveFeedbackDraft = async (id, dto) => (await axiosInstance.put(`${BASE}/${id}/feedback/draft`, dto)).data;

/** The buyer's verdict. Closes the request. */
export const recordFeedback = async (id, dto) => (await axiosInstance.put(`${BASE}/${id}/feedback`, dto)).data;

/**
 * What a new request starts from. The server materialises the BOM into sample
 * material lines, resolves the buyer's country and reads live stock, so the
 * form never has to assemble a draft out of three separate fetches.
 * Either key works; the BOM wins when the caller has both.
 */
export const bomPreview = async ({ bomId, orderNo } = {}) => (
  await axiosInstance.get(`${BASE}/bom-preview`, { params: bomId ? { bomId } : { orderNo } })
).data;
