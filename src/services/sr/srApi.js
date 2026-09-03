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

// ── Sample issues ───────────────────────────────────────────────────────────
// A sample issue is an ordinary material issue with source_type SAMPLE_REQUEST,
// so it lives under its own path but answers with MaterialIssueResponse — the
// same shape the bulk registers, IssueViewDrawer and the slip PDF already read.
// Fabric and trims are SEPARATE documents against one request: the store picks
// rolls off a rack and counts trims out of a bin on different days.

const ISSUES = '/sample-issues';

/**
 * The register: rows plus the three cards above them and the requests nobody
 * has issued to yet. Filters (`search`, `dateFrom`, `dateTo`, `type`, `page`,
 * `size`) bind straight from the query string; `sourceType` is forced server
 * side, so this never returns a bulk document.
 */
export const listSampleIssues = async (params = {}) => (await axiosInstance.get(ISSUES, { params })).data;

export const getSampleIssue = async (id) => (await axiosInstance.get(`${ISSUES}/${id}`)).data;

/**
 * Submitted and in-production requests, each carrying `fabricLines[]` and
 * `trimLines[]` with required qty, live stock and what is already issued — so
 * neither form needs a second call once a request is picked.
 */
export const listIssuableSrs = async () => (await axiosInstance.get(`${ISSUES}/issuable-srs`)).data || [];

/**
 * The rolls behind one fabric line, already ordered by the server: this order's
 * rolls, then free stock, then rolls earmarked to another order (flagged with
 * `earmarkedTo` — a bulk PO legitimately supplies sample material).
 */
export const getSampleIssuableRolls = async (srId, lineNo) => (
  await axiosInstance.get(`${ISSUES}/issuable-rolls`, { params: { srId, lineNo } })
).data || [];

/** One fabric line, picked roll by roll; a partial roll leaves its remnant in stock. */
export const createSampleFabricIssue = async (payload) => (await axiosInstance.post(`${ISSUES}/fabric`, payload)).data;

/** Trims by quantity — the server consumes lots FIFO, right colour first. */
export const createSampleTrimsIssue = async (payload) => (await axiosInstance.post(`${ISSUES}/trims`, payload)).data;

/**
 * Puts the material back and, when no completed document remains, returns the
 * request to Submitted. Sample issues cancel HERE, not through the bulk
 * endpoint — that one refuses them, because only this path holds the request
 * row while the survivors are counted.
 */
export const cancelSampleIssue = async (id, reason) => (await axiosInstance.post(`${ISSUES}/${id}/cancel`, { reason })).data;
