/**
 * Export packing lists REST client (/api/v1/export-docs/packing-lists), and the export audit trail
 * (/api/v1/export-docs/audit) that the packing-list commands write to.
 *
 * - The server holds the lists and runs their rules: one function per endpoint, and every write
 *   takes the version the screen read and answers with the whole list (revise with the new draft,
 *   delete with nothing). A request body carries the API's fields only.
 * - `e.message` is the backend's text and `e.code` its error code, as the other export clients map them.
 * - The times the server keeps as date-times come back stamped as the web app stamped its own
 *   ("2026-11-18 10:05"), so the screens, the prints and the reports show them as before.
 * - `silent` keeps the global error toast off for a caller that degrades on its own: the mirror's
 *   refresh, and what Carton Packing asks of the lists.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/export-docs/packing-lists';
const AUDIT = '/export-docs/audit';

/** Screens read `e.message` and branch on `e.code`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) => request.then((res) => res.data).catch((e) => {
  e.message = e.errorMessage || e.message;
  if (e.response?.data?.error) e.code = e.response.data.error;
  throw e;
});

/** Request options: `silent` for a caller that degrades on its own, `timeout` for one that must not hang. */
const quiet = ({ silent = false, timeout } = {}) => ({ silent, ...(timeout ? { timeout } : {}) });

/** "2026-11-18T10:05:12.345" -> "2026-11-18 10:05"; anything else as it is. */
const stamp = (v) => {
  const m = typeof v === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v) : null;
  return m ? `${m[1]} ${m[2]}` : v;
};

const STAMPED = ['createdAt', 'updatedAt', 'finalisedAt', 'exportedAt', 'cancelledAt'];

/** A list, a register row or a comparison side, its times stamped as the web app stamps them. */
export const fromApi = (pl) => {
  if (!pl || typeof pl !== 'object') return pl;
  const out = { ...pl };
  STAMPED.filter((k) => k in out).forEach((k) => { out[k] = stamp(out[k]); });
  if (out.approval) out.approval = { ...out.approval, submittedAt: stamp(out.approval.submittedAt) };
  if (out.returned) out.returned = { ...out.returned, at: stamp(out.returned.at) };
  if (Array.isArray(out.revisions)) out.revisions = out.revisions.map(fromApi);
  return out;
};

const list = async (request) => fromApi(await call(request));

const unitOf = (u) => ({ packingEntryId: u.packingEntryId, poKey: u.poKey ?? null });

const searchParams = (p = {}) => ({
  ...(p.status ? { status: p.status } : {}),
  ...(p.shipmentId != null ? { shipmentId: p.shipmentId } : {}),
  ...(p.buyerId != null ? { buyerId: p.buyerId } : {}),
  ...(p.search ? { search: p.search } : {}),
  ...(p.branchId != null ? { branchId: p.branchId } : {}),
  page: p.page ?? 0,
  size: p.size ?? 25,
});

// ── Reads ─────────────────────────────────────────────────────────────────────

/** The register: summaries with their stored totals and findings, newest first. */
export const searchApiPackingLists = async (params = {}) => {
  const page = await call(axiosInstance.get(BASE, { params: searchParams(params) }));
  return { ...page, content: (page.content || []).map(fromApi) };
};

/** One list as the workspace reads it: blocks (offers on a draft), findings, revisions. */
export const getApiPackingList = (id) => list(axiosInstance.get(`${BASE}/${id}`));

export const getApiPlRevisions = async (id) => (await call(axiosInstance.get(`${BASE}/${id}/revisions`))).map(fromApi);

/** Any two lists compared, row by row. */
export const compareApiPackingLists = async (id, otherId) => {
  const result = await call(axiosInstance.get(`${BASE}/${id}/compare/${otherId}`));
  return { ...result, a: fromApi(result.a), b: fromApi(result.b) };
};

/** What a new list of the shipment could take, order by order and PO by PO. */
export const getApiBindable = (shipmentId) => call(axiosInstance.get(`${BASE}/bindable`, { params: { shipmentId } }));

/** entry id -> the live lists holding it ({ plId, plNo, status, buyerPoNo }), at most 200 entries at a time. */
export const getApiListsOfEntries = (ids, options) =>
  call(axiosInstance.get(`${BASE}/by-entries`, { params: { ids: ids.join(',') }, ...quiet(options) }));

/** The drafts whose buyer's plan still wants cartons of the order: [{ plId, plNo, shipmentNo, rows }]. */
export const getApiOpenPlans = (orderId, options) =>
  call(axiosInstance.get(`${BASE}/open-plans`, { params: { orderId }, ...quiet(options) }));

/** Every list at the caller's branches, without blocks, with its stored findings. */
export const getApiPlMirror = async (options) =>
  (await call(axiosInstance.get(`${BASE}/mirror`, quiet(options)))).map(fromApi);

// ── Create, header, delete ────────────────────────────────────────────────────

/** `templateId` null is the standard layout; `units` the entry x PO pairs to start with. */
export const createApiPackingList = (p) => list(axiosInstance.post(BASE, {
  shipmentId: p.shipmentId,
  templateId: p.templateId ?? null,
  plDate: p.plDate ?? null,
  descriptionOfGoods: p.descriptionOfGoods ?? null,
  marksAndNos: p.marksAndNos ?? null,
  numbering: p.numbering ?? null,
  firstCartonNo: p.firstCartonNo ?? null,
  tolerancePercent: p.tolerancePercent ?? null,
  units: (p.units || []).map(unitOf),
}));

/** A draft's header, saved whole: the list's own values, with the version it was read at. */
export const updateApiPlHeader = (id, h) => list(axiosInstance.put(`${BASE}/${id}`, {
  version: h.version,
  plDate: h.plDate ?? null,
  descriptionOfGoods: h.descriptionOfGoods ?? null,
  marksAndNos: h.marksAndNos ?? null,
  containerNo: h.containerNo ?? null,
  sealNo: h.sealNo ?? null,
  remarks: h.remarks ?? null,
  numbering: h.numbering ?? null,
  firstCartonNo: h.firstCartonNo ?? null,
  tolerancePercent: h.tolerancePercent ?? null,
}));

export const deleteApiPackingList = (id, version) => call(axiosInstance.delete(`${BASE}/${id}`, { params: { version } }));

// ── A draft's commands ────────────────────────────────────────────────────────

export const bindApiUnits = (id, version, units) =>
  list(axiosInstance.post(`${BASE}/${id}/bind`, { version, units: (units || []).map(unitOf) }));

export const unbindApiUnit = (id, version, unit) =>
  list(axiosInstance.post(`${BASE}/${id}/unbind`, { version, ...unitOf(unit) }));

/** An order's block one place up (-1) or down (1). */
export const moveApiBlock = (id, version, orderId, delta) =>
  list(axiosInstance.post(`${BASE}/${id}/blocks/move`, { version, orderId, delta: Math.sign(delta) }));

export const dropApiBlock = (id, version, orderId) =>
  list(axiosInstance.post(`${BASE}/${id}/blocks/drop`, { version, orderId }));

/** One order's buyer's plan, saved whole (no rows clears it). */
export const saveApiPlan = (id, version, orderId, rows) =>
  list(axiosInstance.put(`${BASE}/${id}/plans/${orderId}`, { version, rows: rows || [] }));

/** A planned range marked Not shipping with a reason, or shipping again (`reason` null). */
export const markApiNotShipping = (id, version, orderId, planRowId, reason) =>
  list(axiosInstance.post(`${BASE}/${id}/plans/${orderId}/not-shipping`, { version, planRowId, reason: reason ?? null }));

/** A warning acknowledged: named by its rule and target, its values read again on the server. */
export const acknowledgeApiFinding = (id, version, { code, targetKey }, reason) =>
  list(axiosInstance.post(`${BASE}/${id}/ack`, { version, code, targetKey, reason }));

/** The cartons and the orders read again. */
export const refreshApiPackingList = (id, version) => list(axiosInstance.post(`${BASE}/${id}/refresh`, { version }));

/** `templateId` null is the standard layout; another template than a newer revision needs a reason. */
export const changeApiPlTemplate = (id, version, templateId, reason) =>
  list(axiosInstance.post(`${BASE}/${id}/template`, { version, templateId: templateId ?? null, reason: reason ?? null }));

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Final at once, or waiting for approval where a flow applies. */
export const submitApiPackingList = (id, version) => list(axiosInstance.post(`${BASE}/${id}/submit`, { version }));

/** A submission waiting for approval taken back to draft. */
export const withdrawApiPackingList = (id, version) => list(axiosInstance.post(`${BASE}/${id}/withdraw`, { version }));

/** A final list released with the export documents; `detail` says how. */
export const releaseApiPackingList = (id, version, detail) =>
  list(axiosInstance.post(`${BASE}/${id}/release`, { version, detail: detail ?? null }));

export const cancelApiPackingList = (id, version, reason) =>
  list(axiosInstance.post(`${BASE}/${id}/cancel`, { version, reason }));

/** A final or released list revised: the answer is the new draft revision. */
export const reviseApiPackingList = (id, version, reason) =>
  list(axiosInstance.post(`${BASE}/${id}/revise`, { version, reason }));

// ── Audit trail ───────────────────────────────────────────────────────────────

/**
 * The export audit trail, newest first: the server's lines merged with the ones the web app still
 * writes for invoices and sticker runs, and the users and document types its filters offer.
 */
export const searchApiExportAudit = (p = {}) => call(axiosInstance.get(AUDIT, {
  params: {
    ...(p.entityType ? { entityType: p.entityType } : {}),
    ...(p.entityId != null ? { entityId: p.entityId } : {}),
    ...(p.search ? { search: p.search } : {}),
    ...(p.user ? { user: p.user } : {}),
    ...(p.withReasonOnly ? { withReasonOnly: true } : {}),
    ...(p.withChangesOnly ? { withChangesOnly: true } : {}),
    ...(p.branchId != null ? { branchId: p.branchId } : {}),
    page: p.page ?? 0,
    size: p.size ?? 25,
  },
}));
