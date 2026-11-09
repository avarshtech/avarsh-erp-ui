/**
 * Export Documentation API surface — the ONLY file screens import.
 *
 * Everything is the API's: shipments (/api/v1/export-docs/shipments), the buyer templates
 * for packing lists, invoices and carton stickers (/api/v1/export-docs/templates, via
 * expDocTemplateStore), and the packing lists, invoices, sticker runs, audit trail and
 * masters (/api/v1/export-docs/documents, via expDocStore). The documents' rules still run
 * here, in the expDocMock*.js modules, against the documents the store loaded; the section
 * comments record the endpoint each group would map to if those rules move to the server.
 *
 * - A call that reads documents syncs the store first (withDocuments, fresh within 30 s).
 * - A call that changes them is a document action (docWrite): the store reloads, the rules
 *   run, and every change is saved in one batch, or none is.
 * - The documents read the API's shipments from an in-memory mirror, synced before each
 *   call that reads one (withShipments), and close or reopen a shipment once their change
 *   is saved (thenSyncShipment).
 */
import { USE_MOCK_EXPDOC_DATA } from './expDocEnv';
import * as mockMasters from './expDocMockMasters';
import * as mockShipments from './expDocMockShipments';
import * as shipmentApi from './shipmentApi';
import { optionOf } from './shipmentAdapter';
import { syncShipmentMirror, mirrorPut, mirrorRemove } from './expDocShipmentMirror';
import { syncShipmentStatus, assertShipmentDeletable } from './expDocShipmentBridge';
import { syncDocuments, runWrite } from './expDocStore';
import { buyerCodeOf } from './expDocMockData';
import {
  syncPackingMirror, putPackingEntry, removePackingEntry as forgetPackingEntry, canReadPacking as packingReadable,
} from './expDocPackingMirror';
import { orderMetaFor } from './expDocOrderMeta';
import * as mockPackingLists from './expDocMockPackingLists';
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

const notReady = () => {
  throw new Error('Export Documentation documents are switched off (USE_MOCK_EXPDOC_DATA)');
};
const guard = (impl) => (USE_MOCK_EXPDOC_DATA ? impl : new Proxy({}, { get: () => notReady }));

const masters = guard(mockMasters);
const packingLists = guard(mockPackingLists);
const stickers = guard(mockStickers);
const invoices = guard(mockInvoices);
const reports = guard(mockReports);
const notifications = guard(mockNotifications);
const dashboard = guard(mockDashboard);

/** A call that reads documents reads the API's: the store is synced first, fresh within 30 s. */
const withDocuments = (fn) => async (...a) => {
  await syncDocuments();
  return fn(...a);
};

/**
 * A document action: the documents are reloaded (so numbers and versions are the latest),
 * `fn` runs, and everything it changed is saved as one batch. Outermost but for
 * thenSyncShipment, which must see the change saved.
 */
const docWrite = (fn) => (...a) => runWrite(() => fn(...a));

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
 * A packing-list call that reads cartons reads the REAL Carton Packing entries: the
 * mirror is synced first for the orders `ordersOf` names (fresh within 30 s). After the
 * shipments, which tell a list its orders. It never writes: opening a list never changes it.
 */
const withPacking = (fn, ordersOf = () => [], options = {}) => async (...a) => {
  await syncPackingMirror(ordersOf(...a), options);
  return fn(...a);
};

/** The orders of a shipment, from the mirror the shipment sync just filled. */
const shipmentOrderIds = (shipmentId) => (mockShipments.shipmentOrders(shipmentId) || []).map((o) => o.orderId);

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

// ── Masters ── GET /export-docs/masters/*
// Incoterms are a fixed list (utils/expDocConstants.js); ports come from the port catalogue
// (services/master/portService.js).
export const listIncoterms = async () => INCOTERMS;
export const listHsCodes = withDocuments((...a) => masters.listHsCodes(...a));
export const getHsDefault = (...a) => masters.getHsDefault(...a);
export const getBuyerCommercial = (...a) => masters.getBuyerCommercial(...a);
export const getTolerancePercent = (...a) => masters.getTolerancePercent(...a);
export const getExporterProfileExtra = (...a) => masters.getExporterProfileExtra(...a);
export const getTenantConfig = (...a) => masters.getTenantConfig(...a);
export const getFxRate = withDocuments((...a) => masters.getFxRate(...a));

// ── Shipments ── REAL API /export-docs/shipments
// Every record carries its document counts, and every write lands in the mirror at
// once, so the next document raised sees it.
export const searchShipments = async (params = {}) => {
  const [page] = await Promise.all([shipmentApi.searchApiShipments(params), syncDocuments()]);
  return { ...page, content: mockShipments.withLocalDocumentsAll(page.content) };
};
/** `silent` for a document's printed header, which shows a dash for a shipment it cannot read. */
export const getShipment = async (id, { silent = false } = {}) => {
  const [shipment] = await Promise.all([shipmentApi.getApiShipment(id, { silent }), syncDocuments()]);
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
  await syncDocuments({ force: true });
  assertShipmentDeletable(shipment);
  await shipmentApi.deleteApiShipment(shipment.id, shipment.version);
  mirrorRemove(shipment.id);
};
/** The consignee's orders for the Orders picker: every status but cancelled, at the working branch. */
export const listConsigneeOrders = (buyerId, search, shipmentId) => shipmentApi.listApiOrderOptions(buyerId, search, 50, shipmentId);

// ── Carton packing entry ── the Packing screens use the real API
//    (services/production/packingService.js). Packing lists bind those real entries
//    through expDocPackingMirror; these let the Carton Packing screens see the lists.
/** Whether this user can read Carton Packing, without which a packing list shows no cartons. */
export const canReadPacking = () => packingReadable();
/** Loads the export documents (fresh within 30 s), for a screen that then reads them synchronously. */
export const loadExportDocuments = () => syncDocuments();
/** entry id -> the live packing lists holding it, of the documents loaded (loadExportDocuments). */
export const packingListsOfEntries = (entryIds) => packingLists.listsOfEntries(entryIds);
/** A Carton Packing save, seen at once by the packing lists. */
export const afterPackingEntrySaved = (entry) => putPackingEntry(entry);
export const afterPackingEntryDeleted = (entry) => forgetPackingEntry(entry);

// ── Packing lists ── GET/POST /packing-lists, GET/PUT/DELETE /{id},
//    POST /{id}/status · /{id}/refresh · /{id}/acknowledge · /{id}/revise
const plShipment = (id) => mockShipments.shipmentOfDocument('packingLists', id);
const listOrders = (id) => packingLists.ordersOfList(id);
/** A packing-list read: the documents, then the shipments, then the cartons of `ordersOf`. */
const plRead = (fn, ordersOf = listOrders) => withDocuments(withShipments(withPacking(fn, ordersOf)));
/** A packing-list action: saved as one batch, then the shipment follows its documents. */
const plWrite = (fn) => thenSyncShipment(docWrite(withShipments(withPacking(fn, listOrders))));
export const searchPackingLists = plRead((...a) => packingLists.searchPackingLists(...a), () => packingLists.ordersOfAllLists());
export const getPackingList = plRead((...a) => packingLists.getPackingList(...a));
/**
 * `templateId` is the template the user chose; the document keeps a snapshot of it. The
 * shipment's orders are read from the orders API (sizes, garment, quantities per PO).
 * Numbered here (PKL/…), on the documents just reloaded.
 */
export const createPackingList = thenSyncShipment(docWrite(withShipments(withPacking(async (payload) => packingLists.createPackingList({
  ...payload,
  templateSnapshot: await loadTemplateSnapshot(payload.templateId),
  orderMeta: await orderMetaFor(shipmentOrderIds(payload.shipmentId)),
}), (payload) => shipmentOrderIds(payload?.shipmentId)), (payload) => [payload?.shipmentId])));
export const updatePackingList = plWrite((...a) => packingLists.updatePackingList(...a));
/** Reads the cartons again now, and the orders, so new packing and corrections arrive. */
export const refreshFromPacking = docWrite(withShipments(async (id) => {
  const orders = listOrders(id);
  await syncPackingMirror(orders, { force: true });
  return packingLists.refreshFromPacking(id, { orderMeta: await orderMetaFor(orders) });
}));
export const acknowledgeWarning = plWrite((...a) => packingLists.acknowledgeWarning(...a));
export const changePlStatus = plWrite((...a) => packingLists.changeStatus(...a));
/** Block actions on a draft: take units (entry x PO) on, take one off, move a block, drop an orphan. */
export const bindPackingEntries = plWrite((...a) => packingLists.bindPackingEntries(...a));
export const removePackingEntry = plWrite((...a) => packingLists.removePackingEntry(...a));
export const moveBlock = plWrite((...a) => packingLists.moveBlock(...a));
export const dropBlock = plWrite((...a) => packingLists.dropBlock(...a));
/** The buyer's plan of one order on a draft, and a planned range marked (or no longer) Not shipping. */
export const savePlPlan = plWrite((...a) => packingLists.savePlPlan(...a));
export const markPlanNotShipping = plWrite((...a) => packingLists.markPlanNotShipping(...a));
/** For Carton Packing: the draft lists that plan cartons of this order still to pack. */
export const listOpenPlansForOrder = plRead((...a) => packingLists.openPlansForOrder(...a), (orderId) => [orderId]);
export const revisePackingList = thenSyncShipment(docWrite(withShipments((...a) => packingLists.revisePackingList(...a))));
export const markPackingListExported = thenSyncShipment(
  docWrite(withShipments((...a) => packingLists.markPackingListExported(...a))),
);
/** Move a draft to a newer revision of its template, or (with a reason) to another template. */
export const changePlTemplate = docWrite(withShipments(async (id, templateId, reason) =>
  packingLists.changePlTemplate(id, await loadTemplateSnapshot(templateId), { reason })));
export const comparePackingLists = withDocuments(withShipments((...a) => packingLists.comparePackingLists(...a)));
export const deletePackingList = thenSyncShipment(
  docWrite(withShipments((...a) => packingLists.deletePackingList(...a))), plShipment,
);
/** What a new packing list of a shipment could take, order by order and PO by PO. */
export const listBindableForShipment = withDocuments(withShipments(withPacking(async (shipmentId) => packingLists.listBindableForShipment(
  shipmentId, await orderMetaFor(shipmentOrderIds(shipmentId)),
), shipmentOrderIds), (shipmentId) => [shipmentId]));

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
export const createInvoice = invoiceWrite(async (payload) => invoices.createInvoice({
  ...payload, templateSnapshot: await loadTemplateSnapshot(payload.templateId),
}));
export const changeInvoiceTemplate = docWrite(withShipments(async (id, templateId, reason) =>
  invoices.changeInvoiceTemplate(id, await loadTemplateSnapshot(templateId), { reason })));
export const updateInvoice = docWrite(withShipments((...a) => invoices.updateInvoice(...a)));
export const regenerateInvoiceLines = docWrite(withShipments((...a) => invoices.regenerateLines(...a)));
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

// ── Reports and audit ── /export-docs/reports, /export-docs/audit
export const packingStatusReport = withDocuments(withShipments((...a) => reports.packingStatusReport(...a)));
export const shipmentRegisterReport = withDocuments(withShipments((...a) => reports.shipmentRegisterReport(...a)));
export const invoiceRegisterReport = withDocuments(withShipments((...a) => reports.invoiceRegisterReport(...a)));
export const varianceReport = withDocuments(withShipments((...a) => reports.varianceReport(...a)));
export const cartonMasterReport = withDocuments(withShipments((...a) => reports.cartonMasterReport(...a)));
export const templateCoverageReport = withDocuments(async (params = {}) => reports.templateCoverageReport({
  ...params, apiTemplates: await templateStore.apiTemplateSummaries(),
}));
export const productivityReport = withDocuments(withShipments((...a) => reports.productivityReport(...a)));
export const searchAudit = withDocuments((...a) => reports.searchAudit(...a));

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
