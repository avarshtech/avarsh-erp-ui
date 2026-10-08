/**
 * Export Documentation API surface — the ONLY file screens import.
 *
 * Buyer templates for packing lists, invoices and carton stickers are on the real API
 * (/api/v1/export-docs/templates, via expDocTemplateStore); everything else is still
 * the mock, and every mock function keeps the signature the future real endpoints
 * will take, so integration swaps the delegate without touching a screen. The
 * section comments record the endpoint each group maps to.
 *
 * Flipping USE_MOCK_EXPDOC_DATA to false before a backend exists throws a loud,
 * named error rather than silently returning undefined.
 */
import { USE_MOCK_EXPDOC_DATA } from './expDocEnv';
import * as mockMasters from './expDocMockMasters';
import * as mockShipments from './expDocMockShipments';
import * as mockPacking from './expDocMockPacking';
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

const notReady = () => {
  throw new Error('Export Documentation backend not implemented yet — mock phase');
};
const guard = (impl) => (USE_MOCK_EXPDOC_DATA ? impl : new Proxy({}, { get: () => notReady }));

const masters = guard(mockMasters);
const shipments = guard(mockShipments);
const packing = guard(mockPacking);
const packingLists = guard(mockPackingLists);
const stickers = guard(mockStickers);
const invoices = guard(mockInvoices);
const reports = guard(mockReports);
const notifications = guard(mockNotifications);
const dashboard = guard(mockDashboard);

// ── Masters ── GET /export-docs/masters/*
export const listPorts = (...a) => masters.listPorts(...a);
export const listIncoterms = (...a) => masters.listIncoterms(...a);
export const listHsCodes = (...a) => masters.listHsCodes(...a);
export const getHsDefault = (...a) => masters.getHsDefault(...a);
export const getBuyerCommercial = (...a) => masters.getBuyerCommercial(...a);
export const getTolerancePercent = (...a) => masters.getTolerancePercent(...a);
export const getExporterProfileExtra = (...a) => masters.getExporterProfileExtra(...a);
export const getTenantConfig = (...a) => masters.getTenantConfig(...a);
export const getFxRate = (...a) => masters.getFxRate(...a);

// ── Shipments ── GET/POST /shipments, GET/PUT/DELETE /shipments/{id}
// A minimal entity this module invents; a real Shipment module replaces it later.
export const searchShipments = (...a) => shipments.searchShipments(...a);
export const getShipment = (...a) => shipments.getShipment(...a);
export const listShipmentOptions = (...a) => shipments.listShipmentOptions(...a);
export const createShipment = (...a) => shipments.createShipment(...a);
export const updateShipment = (...a) => shipments.updateShipment(...a);
export const deleteShipment = (...a) => shipments.deleteShipment(...a);

// ── Carton packing entry ── the Packing screens use the real API
//    (services/production/packingService.js). Packing lists still bind the mock's
//    seeded entries until the export-docs backend exists.
export const listBindablePackingEntries = (...a) => packing.listBindablePackingEntries(...a);

// ── Packing lists ── GET/POST /packing-lists, GET/PUT/DELETE /{id},
//    POST /{id}/status · /{id}/refresh · /{id}/acknowledge · /{id}/revise
export const searchPackingLists = (...a) => packingLists.searchPackingLists(...a);
export const getPackingList = (...a) => packingLists.getPackingList(...a);
/** `templateId` is the template the user chose; the document keeps a snapshot of it. */
export const createPackingList = async (payload) => packingLists.createPackingList({
  ...payload, templateSnapshot: await loadTemplateSnapshot(payload.templateId),
});
export const updatePackingList = (...a) => packingLists.updatePackingList(...a);
export const refreshFromPacking = (...a) => packingLists.refreshFromPacking(...a);
export const acknowledgeWarning = (...a) => packingLists.acknowledgeWarning(...a);
export const changePlStatus = (...a) => packingLists.changeStatus(...a);
export const revisePackingList = (...a) => packingLists.revisePackingList(...a);
export const markPackingListExported = (...a) => packingLists.markPackingListExported(...a);
/** Move a draft to a newer revision of its template, or (with a reason) to another template. */
export const changePlTemplate = async (id, templateId, reason) =>
  packingLists.changePlTemplate(id, await loadTemplateSnapshot(templateId), { reason });
export const comparePackingLists = (...a) => packingLists.comparePackingLists(...a);
export const deletePackingList = (...a) => packingLists.deletePackingList(...a);
export const listBindableForShipment = (...a) => packingLists.listBindableForShipment(...a);

// ── Carton stickers ── GET /packing-lists/{id}/stickers/context · /preview ·
//    /check · POST /sticker-runs · GET /sticker-runs · /cartons/{no}/history
//    The sticker template is an API template: it is chosen here for the run's
//    `templateId` and handed to the mock as `layout` with the choices (`layoutOptions`).
const withStickerTemplate = async (plId, options = {}) => ({
  ...options,
  ...(await resolveStickerTemplate(stickers.stickerTemplateRequest(plId), options.templateId)),
});
export const getStickerContext = async (plId, options) =>
  stickers.getStickerContext(plId, await withStickerTemplate(plId, options));
export const previewCartons = (...a) => stickers.previewCartons(...a);
export const checkStickerGeneration = async (plId, options) =>
  stickers.checkStickerGeneration(plId, await withStickerTemplate(plId, options));
export const generateStickerRun = async (plId, options) =>
  stickers.generateStickerRun(plId, await withStickerTemplate(plId, options));
export const searchStickerRuns = (...a) => stickers.searchStickerRuns(...a);
export const cartonPrintHistory = (...a) => stickers.cartonPrintHistory(...a);

// ── Export invoices ── /export-docs/invoices
export const searchInvoices = (...a) => invoices.searchInvoices(...a);
export const getInvoice = (...a) => invoices.getInvoice(...a);
export const listInvoiceablePls = (...a) => invoices.listInvoiceablePls(...a);
export const createInvoice = async (payload) => invoices.createInvoice({
  ...payload, templateSnapshot: await loadTemplateSnapshot(payload.templateId),
});
export const changeInvoiceTemplate = async (id, templateId, reason) =>
  invoices.changeInvoiceTemplate(id, await loadTemplateSnapshot(templateId), { reason });
export const updateInvoice = (...a) => invoices.updateInvoice(...a);
export const regenerateInvoiceLines = (...a) => invoices.regenerateLines(...a);
export const acknowledgeInvoiceWarning = (...a) => invoices.acknowledgeInvoiceWarning(...a);
export const changeInvoiceStatus = (...a) => invoices.changeInvoiceStatus(...a);
export const reviseInvoice = (...a) => invoices.reviseInvoice(...a);
export const markInvoiceExported = (...a) => invoices.markInvoiceExported(...a);
export const deleteInvoice = (...a) => invoices.deleteInvoice(...a);

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
export const getTemplateSample = (...a) => templateStore.getTemplateSample(...a);
export const listTemplateCandidates = (...a) => candidatesFor(...a);
export const findNewerTemplateRevision = (...a) => newerRevision(...a);
export {
  extractTemplate, templateAiErrorMessage, isAiNotConfigured, isNotATemplateDocument,
} from './exportTemplateAiApi';

// ── Reports and audit ── /export-docs/reports, /export-docs/audit
export const packingStatusReport = (...a) => reports.packingStatusReport(...a);
export const shipmentRegisterReport = (...a) => reports.shipmentRegisterReport(...a);
export const invoiceRegisterReport = (...a) => reports.invoiceRegisterReport(...a);
export const varianceReport = (...a) => reports.varianceReport(...a);
export const cartonMasterReport = (...a) => reports.cartonMasterReport(...a);
export const templateCoverageReport = async (params = {}) => reports.templateCoverageReport({
  ...params, apiTemplates: await templateStore.apiTemplateSummaries(),
});
export const productivityReport = (...a) => reports.productivityReport(...a);
export const searchAudit = (...a) => reports.searchAudit(...a);

// ── Dashboard (§11.1 "Receives back") ── GET /export-docs/dashboard
export const getExpDocDashboard = (...a) => dashboard.getExpDocDashboard(...a);

// ── Document set (§18) ── GET /export-docs/shipments/{id}/documents
export const getShipmentDocumentSet = (...a) => shipments.getShipmentDocumentSet(...a);

/*
 * Notifications (§23) — GET/PATCH/DELETE /notifications, filtered by module.
 *
 * The ERP already has a real notification API; these exist because it has no
 * Export Documentation topics yet. `NotificationCenter` merges what this returns
 * with the API's rows, so the cutover is deleting this block, not rewriting a screen.
 */
export const listExpDocNotifications = (...a) => notifications.listNotifications(...a);
export const expDocUnreadCount = (...a) => notifications.unreadCount(...a);
export const markExpDocNotificationRead = (...a) => notifications.markRead(...a);
export const markExpDocNotificationUnread = (...a) => notifications.markUnread(...a);
export const markAllExpDocNotificationsRead = (...a) => notifications.markAllRead(...a);
export const deleteExpDocNotification = (...a) => notifications.removeNotification(...a);
export const deleteReadExpDocNotifications = (...a) => notifications.removeReadNotifications(...a);
export { EXPDOC_NOTIFICATION } from './expDocMockNotifications';
