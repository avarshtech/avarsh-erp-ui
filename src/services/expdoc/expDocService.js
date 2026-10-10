/**
 * Export Documentation API surface — the ONLY file screens import.
 *
 * On the real API: shipments (/api/v1/export-docs/shipments) and the buyer templates
 * for packing lists, invoices and carton stickers (/api/v1/export-docs/templates, via
 * expDocTemplateStore). Everything else is still the mock, and every mock function
 * keeps the signature the future real endpoints will take, so integration swaps the
 * delegate without touching a screen. The section comments record the endpoint each
 * group maps to.
 *
 * The mock documents read the API's shipments from an in-memory mirror, synced before
 * each call that reads one (withShipments), and close or reopen a shipment as they
 * are released, cancelled or revised (thenSyncShipment).
 *
 * Flipping USE_MOCK_EXPDOC_DATA to false before a backend exists throws a loud,
 * named error rather than silently returning undefined.
 */
import { USE_MOCK_EXPDOC_DATA } from './expDocEnv';
import * as mockMasters from './expDocMockMasters';
import * as mockShipments from './expDocMockShipments';
import * as shipmentApi from './shipmentApi';
import { optionOf } from './shipmentAdapter';
import { syncShipmentMirror, mirrorPut, mirrorRemove } from './expDocShipmentMirror';
import { syncShipmentStatus, assertShipmentDeletable } from './expDocShipmentBridge';
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
  throw new Error('Export Documentation backend not implemented yet — mock phase');
};
const guard = (impl) => (USE_MOCK_EXPDOC_DATA ? impl : new Proxy({}, { get: () => notReady }));

const masters = guard(mockMasters);
const packingLists = guard(mockPackingLists);
const stickers = guard(mockStickers);
const invoices = guard(mockInvoices);
const reports = guard(mockReports);
const notifications = guard(mockNotifications);
const dashboard = guard(mockDashboard);

/**
 * A mock call that reads shipments reads the API's: the mirror is synced first, fresh
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
 * documents. `before` names the shipment when the result cannot (a delete).
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
export const listHsCodes = (...a) => masters.listHsCodes(...a);
export const getHsDefault = (...a) => masters.getHsDefault(...a);
export const getBuyerCommercial = (...a) => masters.getBuyerCommercial(...a);
export const getTolerancePercent = (...a) => masters.getTolerancePercent(...a);
export const getExporterProfileExtra = (...a) => masters.getExporterProfileExtra(...a);
export const getTenantConfig = (...a) => masters.getTenantConfig(...a);
export const getFxRate = (...a) => masters.getFxRate(...a);

// ── Shipments ── REAL API /export-docs/shipments
// Every record carries this browser's document counts, and every write lands in the
// mirror at once, so the next document raised sees it.
export const searchShipments = async (params = {}) => {
  const page = await shipmentApi.searchApiShipments(params);
  return { ...page, content: mockShipments.withLocalDocumentsAll(page.content) };
};
/** `silent` for a document's printed header, which shows a dash for a shipment it cannot read. */
export const getShipment = async (id, { silent = false } = {}) =>
  mockShipments.withLocalDocuments(await shipmentApi.getApiShipment(id, { silent }));
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
/** Takes the record (id, version, shipmentNo). Refused while this browser holds documents for it. */
export const deleteShipment = async (shipment) => {
  assertShipmentDeletable(shipment);
  await shipmentApi.deleteApiShipment(shipment.id, shipment.version);
  mirrorRemove(shipment.id);
};
/** The consignee's orders for the Orders picker: every status but cancelled, at the working branch. */
export const listConsigneeOrders = (buyerId, search) => shipmentApi.listApiOrderOptions(buyerId, search);

// ── Carton packing entry ── the Packing screens use the real API
//    (services/production/packingService.js). Packing lists bind those real entries
//    through expDocPackingMirror; these let the Carton Packing screens see the lists.
/** Whether this user can read Carton Packing, without which a packing list shows no cartons. */
export const canReadPacking = () => packingReadable();
/** entry id -> the live packing lists in this browser holding it. */
export const packingListsOfEntries = (entryIds) => packingLists.listsOfEntries(entryIds);
/** A Carton Packing save, seen at once by the packing lists in this browser. */
export const afterPackingEntrySaved = (entry) => putPackingEntry(entry);
export const afterPackingEntryDeleted = (entry) => forgetPackingEntry(entry);

// ── Packing lists ── GET/POST /packing-lists, GET/PUT/DELETE /{id},
//    POST /{id}/status · /{id}/refresh · /{id}/acknowledge · /{id}/revise
const plShipment = (id) => mockShipments.shipmentOfDocument('packingLists', id);
const listOrders = (id) => packingLists.ordersOfList(id);
export const searchPackingLists = withShipments(
  withPacking((...a) => packingLists.searchPackingLists(...a), () => packingLists.ordersOfAllLists()),
);
export const getPackingList = withShipments(withPacking((...a) => packingLists.getPackingList(...a), listOrders));
/**
 * `templateId` is the template the user chose; the document keeps a snapshot of it. The
 * shipment's orders are read from the orders API (sizes, garment, quantities per PO).
 */
export const createPackingList = withShipments(withPacking(thenSyncShipment(async (payload) => packingLists.createPackingList({
  ...payload,
  templateSnapshot: await loadTemplateSnapshot(payload.templateId),
  orderMeta: await orderMetaFor(shipmentOrderIds(payload.shipmentId)),
})), (payload) => shipmentOrderIds(payload?.shipmentId)), (payload) => [payload?.shipmentId]);
export const updatePackingList = withShipments(withPacking((...a) => packingLists.updatePackingList(...a), listOrders));
/** Reads the cartons again now, and the orders, so new packing and corrections arrive. */
export const refreshFromPacking = withShipments(async (id) => {
  const orders = listOrders(id);
  await syncPackingMirror(orders, { force: true });
  return packingLists.refreshFromPacking(id, { orderMeta: await orderMetaFor(orders) });
});
export const acknowledgeWarning = withShipments(withPacking((...a) => packingLists.acknowledgeWarning(...a), listOrders));
export const changePlStatus = withShipments(
  withPacking(thenSyncShipment((...a) => packingLists.changeStatus(...a)), listOrders),
);
/** Block actions on a draft: take units (entry x PO) on, take one off, move a block, drop an orphan. */
export const bindPackingEntries = withShipments(withPacking((...a) => packingLists.bindPackingEntries(...a), listOrders));
export const removePackingEntry = withShipments(withPacking((...a) => packingLists.removePackingEntry(...a), listOrders));
export const moveBlock = withShipments(withPacking((...a) => packingLists.moveBlock(...a), listOrders));
export const dropBlock = withShipments(withPacking((...a) => packingLists.dropBlock(...a), listOrders));
/** The buyer's plan of one order on a draft, and a planned range marked (or no longer) Not shipping. */
export const savePlPlan = withShipments(withPacking((...a) => packingLists.savePlPlan(...a), listOrders));
export const markPlanNotShipping = withShipments(withPacking((...a) => packingLists.markPlanNotShipping(...a), listOrders));
/** For Carton Packing: the draft lists in this browser that plan cartons of this order still to pack. */
export const listOpenPlansForOrder = withShipments(withPacking(
  (...a) => packingLists.openPlansForOrder(...a), (orderId) => [orderId],
));
export const revisePackingList = withShipments(thenSyncShipment((...a) => packingLists.revisePackingList(...a)));
export const markPackingListExported = withShipments(
  thenSyncShipment((...a) => packingLists.markPackingListExported(...a)),
);
/** Move a draft to a newer revision of its template, or (with a reason) to another template. */
export const changePlTemplate = withShipments(async (id, templateId, reason) =>
  packingLists.changePlTemplate(id, await loadTemplateSnapshot(templateId), { reason }));
export const comparePackingLists = withShipments((...a) => packingLists.comparePackingLists(...a));
export const deletePackingList = withShipments(
  thenSyncShipment((...a) => packingLists.deletePackingList(...a), plShipment),
);
/** What a new packing list of a shipment could take, order by order and PO by PO. */
export const listBindableForShipment = withShipments(withPacking(async (shipmentId) => packingLists.listBindableForShipment(
  shipmentId, await orderMetaFor(shipmentOrderIds(shipmentId)),
), shipmentOrderIds), (shipmentId) => [shipmentId]);

// ── Carton stickers ── GET /packing-lists/{id}/stickers/context · /preview ·
//    /check · POST /sticker-runs · GET /sticker-runs · /cartons/{no}/history
//    The sticker template is an API template: it is chosen here for the run's
//    `templateId` and handed to the mock as `layout` with the choices (`layoutOptions`).
const withStickerTemplate = async (plId, options = {}) => ({
  ...options,
  ...(await resolveStickerTemplate(stickers.stickerTemplateRequest(plId), options.templateId)),
});
export const getStickerContext = withShipments(async (plId, options) =>
  stickers.getStickerContext(plId, await withStickerTemplate(plId, options)));
export const previewCartons = withShipments((...a) => stickers.previewCartons(...a));
export const checkStickerGeneration = withShipments(async (plId, options) =>
  stickers.checkStickerGeneration(plId, await withStickerTemplate(plId, options)));
export const generateStickerRun = withShipments(async (plId, options) =>
  stickers.generateStickerRun(plId, await withStickerTemplate(plId, options)));
export const searchStickerRuns = withShipments((...a) => stickers.searchStickerRuns(...a));
export const cartonPrintHistory = withShipments((...a) => stickers.cartonPrintHistory(...a));

// ── Export invoices ── /export-docs/invoices
const invoiceShipment = (id) => mockShipments.shipmentOfDocument('invoices', id);
export const searchInvoices = withShipments((...a) => invoices.searchInvoices(...a));
export const getInvoice = withShipments((...a) => invoices.getInvoice(...a));
export const listInvoiceablePls = withShipments((...a) => invoices.listInvoiceablePls(...a));
export const createInvoice = withShipments(thenSyncShipment(async (payload) => invoices.createInvoice({
  ...payload, templateSnapshot: await loadTemplateSnapshot(payload.templateId),
})));
export const changeInvoiceTemplate = withShipments(async (id, templateId, reason) =>
  invoices.changeInvoiceTemplate(id, await loadTemplateSnapshot(templateId), { reason }));
export const updateInvoice = withShipments((...a) => invoices.updateInvoice(...a));
export const regenerateInvoiceLines = withShipments((...a) => invoices.regenerateLines(...a));
export const acknowledgeInvoiceWarning = withShipments((...a) => invoices.acknowledgeInvoiceWarning(...a));
export const changeInvoiceStatus = withShipments(thenSyncShipment((...a) => invoices.changeInvoiceStatus(...a)));
export const reviseInvoice = withShipments(thenSyncShipment((...a) => invoices.reviseInvoice(...a)));
export const markInvoiceExported = withShipments(thenSyncShipment((...a) => invoices.markInvoiceExported(...a)));
export const deleteInvoice = withShipments(thenSyncShipment((...a) => invoices.deleteInvoice(...a), invoiceShipment));

// ── Buyer document templates ── REAL API /export-docs/templates (packing list,
//    invoice and carton sticker). Writes take the template object.
export const listAllTemplates = (...a) => templateStore.listAllTemplates(...a);
export const getTemplate = (...a) => templateStore.getTemplate(...a);
export const createTemplate = (...a) => templateStore.createTemplate(...a);
export const saveUploadedTemplates = (...a) => templateStore.saveUploadedTemplates(...a);
export const cloneTemplate = (...a) => templateStore.cloneTemplate(...a);
export const newTemplateVersion = (...a) => templateStore.newTemplateVersion(...a);
export const updateTemplate = (...a) => templateStore.updateTemplate(...a);
export const publishTemplate = (...a) => templateStore.publishTemplate(...a);
export const retireTemplate = (...a) => templateStore.retireTemplate(...a);
export const deleteTemplate = (...a) => templateStore.deleteTemplate(...a);
export const compareTemplates = (...a) => templateStore.compareTemplates(...a);
export const getTemplateSample = withShipments((...a) => templateStore.getTemplateSample(...a));
export const listTemplateCandidates = (...a) => candidatesFor(...a);
export const findNewerTemplateRevision = (...a) => newerRevision(...a);
export {
  extractTemplate, templateAiErrorMessage, isAiNotConfigured, isNotATemplateDocument,
} from './exportTemplateAiApi';

// ── Reports and audit ── /export-docs/reports, /export-docs/audit
export const packingStatusReport = withShipments((...a) => reports.packingStatusReport(...a));
export const shipmentRegisterReport = withShipments((...a) => reports.shipmentRegisterReport(...a));
export const invoiceRegisterReport = withShipments((...a) => reports.invoiceRegisterReport(...a));
export const varianceReport = withShipments((...a) => reports.varianceReport(...a));
export const cartonMasterReport = withShipments((...a) => reports.cartonMasterReport(...a));
export const templateCoverageReport = async (params = {}) => reports.templateCoverageReport({
  ...params, apiTemplates: await templateStore.apiTemplateSummaries(),
});
export const productivityReport = withShipments((...a) => reports.productivityReport(...a));
export const searchAudit = (...a) => reports.searchAudit(...a);

// ── Dashboard (§11.1 "Receives back") ── GET /export-docs/dashboard
export const getExpDocDashboard = withShipments(withPacking(
  (...a) => dashboard.getExpDocDashboard(...a), () => mockShipments.openShipmentOrderIds(),
));

// ── Document set (§18) ── GET /export-docs/shipments/{id}/documents
export const getShipmentDocumentSet = withShipments(
  (...a) => mockShipments.getShipmentDocumentSet(...a), (shipmentId) => [shipmentId],
);

/*
 * Notifications (§23) — GET/PATCH/DELETE /notifications, filtered by module.
 *
 * The ERP already has a real notification API; these exist because it has no
 * Export Documentation topics yet. `NotificationCenter` merges what this returns
 * with the API's rows, so the cutover is deleting this block, not rewriting a screen.
 * Listing them raises the ETD reminders, which read the shipments.
 */
export const listExpDocNotifications = withShipments((...a) => notifications.listNotifications(...a));
export const expDocUnreadCount = withShipments((...a) => notifications.unreadCount(...a));
export const markExpDocNotificationRead = (...a) => notifications.markRead(...a);
export const markExpDocNotificationUnread = (...a) => notifications.markUnread(...a);
export const markAllExpDocNotificationsRead = (...a) => notifications.markAllRead(...a);
export const deleteExpDocNotification = (...a) => notifications.removeNotification(...a);
export const deleteReadExpDocNotifications = (...a) => notifications.removeReadNotifications(...a);
export { EXPDOC_NOTIFICATION } from './expDocMockNotifications';
