/**
 * Real `/api/v1/sample-*` client. srService.js is the only file screens import;
 * it delegates here.
 */
import axiosInstance, { upload } from '../core/axiosInstance';

/**
 * One-shot cleanup of the pre-cutover demo data.
 *
 * Every Sample Request screen ran off `avarsh.sr.mockStore.v1` in localStorage
 * until this module replaced the mock. That key is now dead weight in the
 * browser of anyone who used the mock build — a few hundred KB of sample
 * requests, dispatches and invoices that no code reads. Clearing it at module
 * load costs one call on the first import and nothing afterwards.
 */
try {
  localStorage.removeItem('avarsh.sr.mockStore.v1');
} catch {
  // Private-mode / storage-disabled browsers: nothing to clean up anyway.
}

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

/**
 * Re-agree the deadlines of a Submitted / In Production request. The originals stay as raised;
 * the linked order picks up the slip on its own dispatch date. Payload carries the version.
 */
export const reviseDeadline = async (id, payload) => (await axiosInstance.put(`${BASE}/${id}/revise-deadline`, payload)).data;

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
 * Reads a buyer's comment sheet and says what it found — writing nothing. The
 * user ticks the rows to keep and the feedback endpoints above save them.
 *
 * Posted through the shared upload helper so the multipart boundary is set
 * rather than the instance's JSON content type. Answers 503 AI_NOT_CONFIGURED
 * where no extraction key is configured.
 */
export const parseCommentSheet = async (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return upload(`${BASE}/${id}/comment-sheet/parse`, form);
};

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

// ── Dispatches ──────────────────────────────────────────────────────────────
// One dispatch groups many In-Production requests of a single customer. Only
// ids travel from here: the buyer name and country, the courier name and the
// buying-office label are all resolved and snapshotted server-side, so nothing
// this browser believes about a parcel can contradict what shipped.

const DISPATCHES = '/sample-dispatches';

export const searchDispatches = async (params = {}) => toPage((await axiosInstance.get(DISPATCHES, { params })).data);

export const getDispatch = async (id) => (await axiosInstance.get(`${DISPATCHES}/${id}`)).data;

/**
 * In-production requests still free to ship. Pass the draft being edited and
 * its own requests stay in the list — the server does the merge the form used
 * to do by hand, so "available" has one definition instead of two.
 */
export const listDispatchableSrs = async (buyerId, dispatchId) => (
  await axiosInstance.get(`${DISPATCHES}/dispatchable-srs`, { params: { buyerId, dispatchId } })
).data || [];

/**
 * Customers with something waiting to ship. `buyerId` travels with the name
 * because a hand delivery offers that buyer's own shipping locations as its
 * buying office; `overseas` is decided against the organisation's country.
 */
export const listDispatchableCustomers = async () => (await axiosInstance.get(`${DISPATCHES}/customers`)).data || [];

export const createDispatch = async (dto) => (await axiosInstance.post(DISPATCHES, dto)).data;

export const updateDispatch = async (id, dto) => (await axiosInstance.put(`${DISPATCHES}/${id}`, dto)).data;

export const deleteDispatch = async (id) => { await axiosInstance.delete(`${DISPATCHES}/${id}`); };

/**
 * The parcel leaves — irreversible. An overseas consignment whose requests are
 * not all covered by an issued commercial invoice comes back 409
 * INVOICE_REQUIRED with `uncoveredSrs`; axiosInstance stamps `error.code` and
 * skips its toast so the screen can show the modal instead.
 */
export const markDispatched = async (id, version) => (
  await axiosInstance.post(`${DISPATCHES}/${id}/mark-dispatched`, { version })
).data;

// ── Invoices ────────────────────────────────────────────────────────────────
// Two kinds under one path: COMMERCIAL travels with an overseas parcel and is
// what unlocks its dispatch, SAMPLE is the chargeable recovery document raised
// afterwards. The series and the number are decided server-side from the
// organisation profile — a payload cannot claim a number it was not given.

const INVOICES = '/sample-invoices';

/**
 * Both row tables key by `key` and a manual line has no id to key by. The
 * server sends one on every line; this only backstops a line that arrives
 * without, so a missing key can never collapse two rows into one.
 */
const withLineKeys = (inv) => (inv && Array.isArray(inv.lines)
  ? { ...inv, lines: inv.lines.map((l, i) => ({ ...l, key: l.key || (l.id ? `l${l.id}` : `m${i}`) })) }
  : inv);

/**
 * Not a page: the screen filters and sorts client-side over one financial
 * year, and the four cards above it count everything regardless of the filters.
 */
export const listInvoices = async (params = {}) => {
  const data = (await axiosInstance.get(INVOICES, { params })).data;
  return {
    content:       data?.content       || [],
    totalElements: data?.totalElements || 0,
    stats:         data?.stats         || null,
  };
};

export const getInvoice = async (id) => withLineKeys((await axiosInstance.get(`${INVOICES}/${id}`)).data);

/**
 * The requests this kind of invoice may cover — and the ones it may not, each
 * carrying the reason, because that is what the picker greys the row with.
 */
export const listEligibleSrs = async ({ type, consigneeBuyerId, dispatchId } = {}) => (
  await axiosInstance.get(`${INVOICES}/eligible-srs`, { params: { type, consigneeBuyerId, dispatchId } })
).data || [];

export const createInvoice = async (payload) => withLineKeys((await axiosInstance.post(INVOICES, payload)).data);

export const updateInvoice = async (id, payload) => withLineKeys((await axiosInstance.put(`${INVOICES}/${id}`, payload)).data);

/** Assigns the number out of the series and locks the document — irreversible. */
export const issueInvoice = async (id, version) => withLineKeys(
  (await axiosInstance.post(`${INVOICES}/${id}/issue`, { version })).data,
);

/** Withdraws an issued invoice and releases the requests it covered. */
export const cancelInvoice = async (id, reason, version) => withLineKeys(
  (await axiosInstance.post(`${INVOICES}/${id}/cancel`, { reason, version })).data,
);

/** Copies any invoice into a fresh draft dated today — how an issued one is corrected. */
export const duplicateInvoice = async (id) => withLineKeys(
  (await axiosInstance.post(`${INVOICES}/${id}/duplicate`)).data,
);
