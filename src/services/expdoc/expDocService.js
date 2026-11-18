/**
 * Export Documentation API surface — the ONLY file screens import.
 *
 * Everything is the API's: shipments (/api/v1/export-docs/shipments) and packing lists
 * (/api/v1/export-docs/packing-lists, rules and all), the buyer templates for packing lists,
 * invoices and carton stickers (/api/v1/export-docs/templates, via expDocTemplateStore), the
 * audit trail (/api/v1/export-docs/audit), and the invoices, sticker runs and masters
 * (/api/v1/export-docs/documents, via expDocStore). The invoices' and sticker runs' rules still
 * run here, in the expDocMock*.js modules, against the documents the store loaded; the section
 * comments record the endpoint each group would map to if those rules move to the server.
 *
 * - A call that reads documents syncs the store and the packing-list mirror first
 *   (withDocuments, fresh within 30 s).
 * - A call that changes them is a document action (docWrite): the packing lists and the
 *   documents reload, the rules run, and every change is saved in one batch, or none is.
 * - The documents read the API's shipments and packing lists from in-memory mirrors
 *   (expDocShipmentMirror, expDocPlMirror), synced before each call that reads them. An invoice
 *   closes or reopens its shipment once its change is saved (thenSyncShipment); a packing list's
 *   action leaves that to the server, and the shipment is read again after it.
 */
import { USE_MOCK_EXPDOC_DATA } from './expDocEnv';
import * as mockMasters from './expDocMockMasters';
import * as mockShipments from './expDocMockShipments';
import * as shipmentApi from './shipmentApi';
import * as plApi from './packingListApi';
import { optionOf } from './shipmentAdapter';
import { syncShipmentMirror, mirrorPut, mirrorRemove } from './expDocShipmentMirror';
import { syncPlMirror, mirrorPutPl, mirrorRemovePl } from './expDocPlMirror';
import { syncShipmentStatus, assertShipmentDeletable } from './expDocShipmentBridge';
import { syncDocuments, runWrite, countStickerRuns } from './expDocStore';
import { buyerCodeOf } from './expDocMockData';
import {
  syncPackingMirror, putPackingEntry, removePackingEntry as forgetPackingEntry, canReadPacking as packingReadable,
} from './expDocPackingMirror';
import * as mockStickers from './expDocMockStickers';
import * as mockInvoices from './expDocMockInvoices';
import * as mockReports from './expDocMockReports';
import * as mockNotifications from './expDocMockNotifications';
import * as mockDashboard from './expDocMockDashboard';
import * as templateStore from './expDocTemplateStore';
import {
  listTemplateCandidates as candidatesFor, loadTemplateSnapshot, findNewerTemplateRevision as newerRevision,
} from './expDocTemplateBridge';
import { resolveStickerTemplate } from './expDocStickerTemplates';
import { INCOTERMS, SHIPMENT_STATUS } from '../../utils/expDocConstants';
import { isSystemTemplateId } from '../../utils/expDocSystemTemplates';

const notReady = () => {
  throw new Error('Export Documentation documents are switched off (USE_MOCK_EXPDOC_DATA)');
};
const guard = (impl) => (USE_MOCK_EXPDOC_DATA ? impl : new Proxy({}, { get: () => notReady }));

const masters = guard(mockMasters);
const stickers = guard(mockStickers);
const invoices = guard(mockInvoices);
const reports = guard(mockReports);
const notifications = guard(mockNotifications);
const dashboard = guard(mockDashboard);

/** The documents and the packing lists, fresh within 30 s, or reloaded now (`force`). Never throws. */
const syncReads = ({ force = false } = {}) => Promise.all([syncDocuments({ force }), syncPlMirror({ force })]);

/** A call that reads documents reads the API's: the store and the packing lists are synced first, fresh within 30 s. */
const withDocuments = (fn) => async (...a) => {
  await syncReads();
  return fn(...a);
};

/**
 * A document action: the packing lists and the documents are reloaded (so numbers, statuses and
 * versions are the latest), `fn` runs, and everything it changed is saved as one batch. Outermost
 * but for thenSyncShipment, which must see the change saved.
 */
const docWrite = (fn) => async (...a) => {
  await syncPlMirror({ force: true });
  return runWrite(() => fn(...a));
};

/**
 * A call that reads shipments reads the API's: the mirror is synced first, fresh
 * within 30 s and holding every shipment this browser's documents name, plus any the
 * call itself names (`idsOf`).
 */
const withShipments = (fn, idsOf = () => []) => async (...a) => {
  await syncShipmentMirror([...mockShipments.documentShipmentIds(), ...idsOf(...a)]);
  return fn(...a);
};

/**
 * A call that reads cartons reads the REAL Carton Packing entries: the mirror is synced first
 * for the orders `ordersOf` names (fresh within 30 s). After the shipments, which tell it the
 * orders. It never writes.
 */
const withPacking = (fn, ordersOf = () => [], options = {}) => async (...a) => {
  await syncPackingMirror(ordersOf(...a), options);
  return fn(...a);
};

/**
 * A document action that can close or reopen its shipment, which then follows its
 * documents once they are saved. `before` names the shipment when the result cannot (a delete).
 */
const thenSyncShipment = (fn, before = () => null) => async (...a) => {
  const shipmentId = before(...a);
  const result = await fn(...a);
  await syncShipmentStatus(result?.shipmentId ?? shipmentId);
  return result;
};

/** What Carton Packing asks of the packing lists: no toast (its screens degrade on their own), and never a long wait. */
const QUIET = { silent: true, timeout: 10000 };

// ── Masters ── GET /export-docs/masters/*
// Incoterms are a fixed list (utils/expDocConstants.js); ports come from the port catalogue
// (services/master/portService.js).
export const listIncoterms = async () => INCOTERMS;
export const listHsCodes = withDocuments((...a) => masters.listHsCodes(...a));
export const getExporterProfileExtra = (...a) => masters.getExporterProfileExtra(...a);
export const getTenantConfig = (...a) => masters.getTenantConfig(...a);
export const getFxRate = withDocuments((...a) => masters.getFxRate(...a));

// ── Shipments ── REAL API /export-docs/shipments
// Every record carries its document counts, and every write lands in the mirror at
// once, so the next document raised sees it.
export const searchShipments = async (params = {}) => {
  const [page] = await Promise.all([shipmentApi.searchApiShipments(params), syncReads()]);
  return { ...page, content: mockShipments.withLocalDocumentsAll(page.content) };
};
/** `silent` for a document's printed header, which shows a dash for a shipment it cannot read. */
export const getShipment = async (id, { silent = false } = {}) => {
  const [shipment] = await Promise.all([shipmentApi.getApiShipment(id, { silent }), syncReads()]);
  return mockShipments.withLocalDocuments(shipment);
};
/** The pickers' shipments: the OPEN ones for a new document, every one for a report filter. */
export const listShipmentOptions = async ({ includeClosed = false } = {}) => {
  const page = await shipmentApi.searchApiShipments({
    status: includeClosed ? undefined : SHIPMENT_STATUS.OPEN, page: 0, size: 200,
  });
  return page.content.map((s) => optionOf({ ...s, buyerCode: buyerCodeOf(s.buyerName) }));
};
export const createShipment = async (shipment) =>
  mockShipments.withLocalDocuments(mirrorPut(await shipmentApi.createApiShipment(shipment)));
export const updateShipment = async (id, shipment) =>
  mockShipments.withLocalDocuments(mirrorPut(await shipmentApi.updateApiShipment(id, shipment)));
/** Takes the record (id, version, shipmentNo). Refused while documents name it; the API refuses too. */
export const deleteShipment = async (shipment) => {
  await syncReads({ force: true });
  assertShipmentDeletable(shipment);
  await shipmentApi.deleteApiShipment(shipment.id, shipment.version);
  mirrorRemove(shipment.id);
};
/** The consignee's orders for the Orders picker: every status but cancelled, at the working branch. */
export const listConsigneeOrders = (buyerId, search, shipmentId) => shipmentApi.listApiOrderOptions(buyerId, search, 50, shipmentId);

// ── Carton packing entry ── the Packing screens use the real API
//    (services/production/packingService.js). These let the Carton Packing screens see the
//    packing lists that hold their entries, and the dashboard see a save at once.
/** Whether this user can read Carton Packing, without which a packing list shows no cartons. */
export const canReadPacking = () => packingReadable();
/** The most entries one question names. */
const ENTRIES_PER_ASK = 200;
/**
 * entry id -> the live packing lists holding it ([{ plId, plNo, status, buyerPoNo }]). Quiet: a
 * refusal rejects without a toast, and the screen shows no lists.
 */
export const packingListsOfEntries = async (entryIds = []) => {
  const ids = [...new Set(entryIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const out = {};
  for (let i = 0; i < ids.length; i += ENTRIES_PER_ASK) {
    Object.assign(out, await plApi.getApiListsOfEntries(ids.slice(i, i + ENTRIES_PER_ASK), QUIET));
  }
  return out;
};
/** A Carton Packing save, seen at once by the dashboard. */
export const afterPackingEntrySaved = (entry) => putPackingEntry(entry);
export const afterPackingEntryDeleted = (entry) => forgetPackingEntry(entry);

// ── Packing lists ── REAL API /export-docs/packing-lists (packingListApi)
//    The server holds the lists and runs their rules. A command on a draft's blocks or plan
//    takes (id, …, version); the header, the warnings, the template and the lifecycle take the
//    list itself and send its version. Every answer lands in the mirror at once (expDocPlMirror),
//    which the invoice, sticker, report and dashboard rules read. The server closes or reopens
//    the shipment itself; a lifecycle action reads it again for the shipment mirror.

/** A list as the workspace reads it: the API's answer, in the mirror, with the sticker runs the web app keeps for it. */
const adopt = (pl) => (pl?.id == null ? pl : { ...mirrorPutPl(pl), stickerRunCount: countStickerRuns(pl.id) });

/** The shipment read again, as the server may have closed or reopened it. Quiet: the action stands either way. */
const refreshShipment = async (shipmentId) => {
  if (shipmentId == null) return;
  try {
    mirrorPut(await shipmentApi.getApiShipment(shipmentId, { silent: true }));
  } catch {
    // The mirror's next refresh reads it
  }
};

/** A lifecycle action: its answer lands in the mirror, and its shipment is read again. */
const lifecycle = (fn) => async (...a) => {
  const pl = adopt(await fn(...a));
  await refreshShipment(pl?.shipmentId);
  return pl;
};

/** The standard layout is the API's null template; the pickers name it SYSTEM-PACKING_LIST. */
const apiTemplateId = (templateId) => (isSystemTemplateId(templateId) ? null : (templateId ?? null));

/** The register: the API's page, each list with its stored totals and findings. */
export const searchPackingLists = (params = {}) => plApi.searchApiPackingLists(params);
/** One list as the workspace reads it; the sticker runs it counts are the documents', loaded alongside. */
export const getPackingList = async (id) => {
  const [pl] = await Promise.all([plApi.getApiPackingList(id), syncDocuments()]);
  return adopt(pl);
};
/**
 * `templateId` is the template the user chose (null or a SYSTEM-* id: the standard layout); the
 * server numbers the list (PKL/…), snapshots the template and reads the shipment's orders.
 */
export const createPackingList = async (payload) =>
  adopt(await plApi.createApiPackingList({ ...payload, templateId: apiTemplateId(payload.templateId) }));
/** A draft's header, saved whole: the list's own values with `patch` over them, at the list's version. */
export const updatePackingList = async (pl, patch = {}) =>
  adopt(await plApi.updateApiPlHeader(pl.id, { ...pl, ...patch, version: pl.version }));
/** Reads the cartons and the orders again, so new packing and corrections arrive. */
export const refreshFromPacking = async (pl) => adopt(await plApi.refreshApiPackingList(pl.id, pl.version));
/** A warning acknowledged with a reason; `finding` names it ({ code, targetKey }). */
export const acknowledgeWarning = async (pl, finding, reason) =>
  adopt(await plApi.acknowledgeApiFinding(pl.id, pl.version, finding, reason));
/** Block actions on a draft: take units (entry x PO) on, take one off, move a block, drop an orphan. */
export const bindPackingEntries = async (id, units, version) => adopt(await plApi.bindApiUnits(id, version, units));
export const removePackingEntry = async (id, unit, version) => adopt(await plApi.unbindApiUnit(id, version, unit));
export const moveBlock = async (id, orderId, delta, version) => adopt(await plApi.moveApiBlock(id, version, orderId, delta));
export const dropBlock = async (id, orderId, version) => adopt(await plApi.dropApiBlock(id, version, orderId));
/** The buyer's plan of one order on a draft, and a planned range marked (or no longer) Not shipping. */
export const savePlPlan = async (id, orderId, rows, version) => adopt(await plApi.saveApiPlan(id, version, orderId, rows));
export const markPlanNotShipping = async (id, orderId, planRowId, reason, version) =>
  adopt(await plApi.markApiNotShipping(id, version, orderId, planRowId, reason));
/** For Carton Packing: the draft lists that plan cartons of this order still to pack. Quiet, as its screen degrades. */
export const listOpenPlansForOrder = (orderId) => plApi.getApiOpenPlans(orderId, QUIET);
/** Move a draft to a newer revision of its template, or (with a reason) to another template. */
export const changePlTemplate = async (pl, templateId, reason) =>
  adopt(await plApi.changeApiPlTemplate(pl.id, pl.version, apiTemplateId(templateId), reason));
/** Finalise a draft: final at once, frozen with its template version. */
export const finalisePackingList = lifecycle((pl) => plApi.finaliseApiPackingList(pl.id, pl.version));
/** Release a final list with the export documents; `detail` says how. */
export const markPackingListExported = lifecycle((pl, { detail } = {}) => plApi.releaseApiPackingList(pl.id, pl.version, detail));
export const cancelPackingList = lifecycle((pl, reason) => plApi.cancelApiPackingList(pl.id, pl.version, reason));
const revise = lifecycle((pl, reason) => plApi.reviseApiPackingList(pl.id, pl.version, reason));
/** A final or released list revised: the answer is the new draft; the revision it supersedes is read again. */
export const revisePackingList = async (pl, reason) => {
  const draft = await revise(pl, reason);
  await syncPlMirror({ force: true });
  return draft;
};
export const comparePackingLists = (idA, idB) => plApi.compareApiPackingLists(idA, idB);
/**
 * Takes the record (id, version, revision, shipmentId). A draft revision deleted brings back the
 * revision it superseded, and the shipment follows what remains.
 */
export const deletePackingList = async (record) => {
  await plApi.deleteApiPackingList(record.id, record.version);
  mirrorRemovePl(record.id);
  if (record.revision > 0) await syncPlMirror({ force: true });
  await refreshShipment(record.shipmentId);
};
/** What a new packing list of a shipment could take, order by order and PO by PO. */
export const listBindableForShipment = (shipmentId) => plApi.getApiBindable(shipmentId);

// ── Carton stickers ── GET /packing-lists/{id}/stickers/context · /preview ·
//    /check · POST /sticker-runs · GET /sticker-runs · /cartons/{no}/history
//    The sticker template is an API template: it is chosen here for the run's
//    `templateId` and handed to the rules as `layout` with the choices (`layoutOptions`).
const withStickerTemplate = async (plId, options = {}) => ({
  ...options,
  ...(await resolveStickerTemplate(stickers.stickerTemplateRequest(plId), options.templateId)),
});
export const getStickerContext = withDocuments(withShipments(async (plId, options) =>
  stickers.getStickerContext(plId, await withStickerTemplate(plId, options))));
export const previewCartons = withDocuments(withShipments((...a) => stickers.previewCartons(...a)));
export const checkStickerGeneration = withDocuments(withShipments(async (plId, options) =>
  stickers.checkStickerGeneration(plId, await withStickerTemplate(plId, options))));
/** Numbered here (STK/…), on the documents just reloaded. */
export const generateStickerRun = docWrite(withShipments(async (plId, options) =>
  stickers.generateStickerRun(plId, await withStickerTemplate(plId, options))));
export const searchStickerRuns = withDocuments(withShipments((...a) => stickers.searchStickerRuns(...a)));
export const cartonPrintHistory = withDocuments(withShipments((...a) => stickers.cartonPrintHistory(...a)));

// ── Export invoices ── /export-docs/invoices
const invoiceShipment = (id) => mockShipments.shipmentOfDocument('invoices', id);
/** An invoice action that can close or reopen its shipment: saved as one batch, then the shipment follows. */
const invoiceWrite = (fn, before) => thenSyncShipment(docWrite(withShipments(fn)), before);
export const searchInvoices = withDocuments(withShipments((...a) => invoices.searchInvoices(...a)));
export const getInvoice = withDocuments(withShipments((...a) => invoices.getInvoice(...a)));
export const listInvoiceablePls = withDocuments(withShipments((...a) => invoices.listInvoiceablePls(...a)));
/**
 * The shipment's orders' currency, payment terms and style HS codes. Creating an invoice needs
 * them; a rebuild does without (`optional`): its lines keep the HS codes they had.
 */
const orderTermsOf = (shipmentId, { optional = false } = {}) => {
  if (shipmentId == null) return Promise.resolve(optional ? null : []);
  const read = shipmentApi.getApiOrderTerms(shipmentId, { silent: optional });
  return optional ? read.catch(() => null) : read;
};
export const createInvoice = invoiceWrite(async (payload) => invoices.createInvoice({
  ...payload,
  templateSnapshot: await loadTemplateSnapshot(payload.templateId),
  orderTerms: await orderTermsOf(mockShipments.shipmentOfDocument('packingLists', payload.plIds?.[0])),
}));
export const changeInvoiceTemplate = docWrite(withShipments(async (id, templateId, reason) =>
  invoices.changeInvoiceTemplate(id, await loadTemplateSnapshot(templateId), {
    reason, orderTerms: await orderTermsOf(invoiceShipment(id), { optional: true }),
  })));
export const updateInvoice = docWrite(withShipments((...a) => invoices.updateInvoice(...a)));
export const regenerateInvoiceLines = docWrite(withShipments(async (id, options = {}) =>
  invoices.regenerateLines(id, { ...options, orderTerms: await orderTermsOf(invoiceShipment(id), { optional: true }) })));
export const acknowledgeInvoiceWarning = docWrite(withShipments((...a) => invoices.acknowledgeInvoiceWarning(...a)));
/** Finalising numbers the invoice (EXP/…) on the documents just reloaded, so the series stays gapless. */
export const changeInvoiceStatus = invoiceWrite((...a) => invoices.changeInvoiceStatus(...a));
export const reviseInvoice = invoiceWrite((...a) => invoices.reviseInvoice(...a));
export const markInvoiceExported = invoiceWrite((...a) => invoices.markInvoiceExported(...a));
export const deleteInvoice = invoiceWrite((...a) => invoices.deleteInvoice(...a), invoiceShipment);

// ── Buyer document templates ── REAL API /export-docs/templates (packing list,
//    invoice and carton sticker). Writes take the template object. A template shows how
//    many documents use it, so the documents are synced first.
export const listAllTemplates = withDocuments((...a) => templateStore.listAllTemplates(...a));
export const getTemplate = withDocuments((...a) => templateStore.getTemplate(...a));
export const createTemplate = withDocuments((...a) => templateStore.createTemplate(...a));
export const saveUploadedTemplates = withDocuments((...a) => templateStore.saveUploadedTemplates(...a));
export const cloneTemplate = withDocuments((...a) => templateStore.cloneTemplate(...a));
export const newTemplateVersion = withDocuments((...a) => templateStore.newTemplateVersion(...a));
export const updateTemplate = withDocuments((...a) => templateStore.updateTemplate(...a));
export const publishTemplate = withDocuments((...a) => templateStore.publishTemplate(...a));
export const retireTemplate = withDocuments((...a) => templateStore.retireTemplate(...a));
export const deleteTemplate = (...a) => templateStore.deleteTemplate(...a);
export const compareTemplates = (...a) => templateStore.compareTemplates(...a);
export const getTemplateSample = withShipments((...a) => templateStore.getTemplateSample(...a));
export const listTemplateCandidates = (...a) => candidatesFor(...a);
export const findNewerTemplateRevision = (...a) => newerRevision(...a);
export {
  extractTemplate, templateAiErrorMessage, isAiNotConfigured, isNotATemplateDocument,
} from './exportTemplateAiApi';

// ── Reports ── /export-docs/reports; the audit trail is the REAL API's /export-docs/audit,
//    the server's lines merged with the ones this browser still writes for invoices and stickers
export const packingStatusReport = withDocuments(withShipments((...a) => reports.packingStatusReport(...a)));
export const shipmentRegisterReport = withDocuments(withShipments((...a) => reports.shipmentRegisterReport(...a)));
export const invoiceRegisterReport = withDocuments(withShipments((...a) => reports.invoiceRegisterReport(...a)));
export const varianceReport = withDocuments(withShipments((...a) => reports.varianceReport(...a)));
export const cartonMasterReport = withDocuments(withShipments((...a) => reports.cartonMasterReport(...a)));
export const templateCoverageReport = withDocuments(async (params = {}) => reports.templateCoverageReport({
  ...params, apiTemplates: await templateStore.apiTemplateSummaries(),
}));
export const productivityReport = withDocuments(withShipments((...a) => reports.productivityReport(...a)));
export const searchAudit = (params = {}) => plApi.searchApiExportAudit(params);

// ── Dashboard (§11.1 "Receives back") ── GET /export-docs/dashboard
export const getExpDocDashboard = withDocuments(withShipments(withPacking(
  (...a) => dashboard.getExpDocDashboard(...a), () => mockShipments.openShipmentOrderIds(),
)));

// ── Document set (§18) ── GET /export-docs/shipments/{id}/documents
export const getShipmentDocumentSet = withDocuments(withShipments(
  (...a) => mockShipments.getShipmentDocumentSet(...a), (shipmentId) => [shipmentId],
));

/*
 * Notifications (§23) — GET/PATCH/DELETE /notifications, filtered by module.
 *
 * The ERP already has a real notification API; these exist because it has no
 * Export Documentation topics yet. `NotificationCenter` merges what this returns
 * with the API's rows, so the cutover is deleting this block, not rewriting a screen.
 * Listing them raises the ETD reminders, which read the shipments.
 */
export const listExpDocNotifications = withDocuments(withShipments((...a) => notifications.listNotifications(...a)));
export const expDocUnreadCount = withDocuments(withShipments((...a) => notifications.unreadCount(...a)));
export const markExpDocNotificationRead = (...a) => notifications.markRead(...a);
export const markExpDocNotificationUnread = (...a) => notifications.markUnread(...a);
export const markAllExpDocNotificationsRead = (...a) => notifications.markAllRead(...a);
export const deleteExpDocNotification = (...a) => notifications.removeNotification(...a);
export const deleteReadExpDocNotifications = (...a) => notifications.removeReadNotifications(...a);
export { EXPDOC_NOTIFICATION } from './expDocMockNotifications';
