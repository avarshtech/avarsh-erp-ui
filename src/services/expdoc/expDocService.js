/**
 * Export Documentation API surface — the ONLY file screens import.
 *
 * Mock-only during this phase; every function keeps the signature the future real
 * endpoints (/api/v1/export-docs/...) will take, so integration swaps the delegate
 * without touching a single screen. The section comments record the endpoint each
 * group maps to.
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
import * as mockTemplates from './expDocMockTemplates';
import * as mockReports from './expDocMockReports';
import * as mockNotifications from './expDocMockNotifications';
import * as mockDashboard from './expDocMockDashboard';

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
const templates = guard(mockTemplates);
const reports = guard(mockReports);
const notifications = guard(mockNotifications);
const dashboard = guard(mockDashboard);

// ── Masters ── GET /export-docs/masters/*
export const listPorts = (...a) => masters.listPorts(...a);
export const listIncoterms = (...a) => masters.listIncoterms(...a);
export const listHsCodes = (...a) => masters.listHsCodes(...a);
export const getHsDefault = (...a) => masters.getHsDefault(...a);
export const getBuyerCommercial = (...a) => masters.getBuyerCommercial(...a);
export const listSubClients = (...a) => masters.listSubClients(...a);
export const getTolerancePercent = (...a) => masters.getTolerancePercent(...a);
export const listConsigneeProfiles = (...a) => masters.listConsigneeProfiles(...a);
export const listNotifyProfiles = (...a) => masters.listNotifyProfiles(...a);
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

// ── Carton packing entry ── GET/POST /packing-entries, GET/PUT/DELETE /{id},
//    POST /{id}/status. Supplies the PRD §7.3 carton dataset.
export const searchPackingEntries = (...a) => packing.searchPackingEntries(...a);
export const getPackingEntry = (...a) => packing.getPackingEntry(...a);
export const listBindablePackingEntries = (...a) => packing.listBindablePackingEntries(...a);
export const createPackingEntry = (...a) => packing.createPackingEntry(...a);
export const updatePackingEntry = (...a) => packing.updatePackingEntry(...a);
export const setPackingEntryStatus = (...a) => packing.setPackingEntryStatus(...a);
export const deletePackingEntry = (...a) => packing.deletePackingEntry(...a);

// ── Packing lists ── GET/POST /packing-lists, GET/PUT/DELETE /{id},
//    POST /{id}/status · /{id}/refresh · /{id}/acknowledge · /{id}/revise
export const searchPackingLists = (...a) => packingLists.searchPackingLists(...a);
export const getPackingList = (...a) => packingLists.getPackingList(...a);
export const createPackingList = (...a) => packingLists.createPackingList(...a);
export const updatePackingList = (...a) => packingLists.updatePackingList(...a);
export const refreshFromPacking = (...a) => packingLists.refreshFromPacking(...a);
export const acknowledgeWarning = (...a) => packingLists.acknowledgeWarning(...a);
export const changePlStatus = (...a) => packingLists.changeStatus(...a);
export const revisePackingList = (...a) => packingLists.revisePackingList(...a);
export const markPackingListExported = (...a) => packingLists.markPackingListExported(...a);
export const overridePlTemplate = (...a) => packingLists.overridePlTemplate(...a);
export const clearPlTemplateOverride = (...a) => packingLists.clearPlTemplateOverride(...a);
export const comparePackingLists = (...a) => packingLists.comparePackingLists(...a);
export const recallPackingList = (...a) => packingLists.recallPackingList(...a);
export const deletePackingList = (...a) => packingLists.deletePackingList(...a);
export const listBindableForShipment = (...a) => packingLists.listBindableForShipment(...a);

// ── Carton stickers ── GET /packing-lists/{id}/stickers/context · /preview ·
//    /check · POST /sticker-runs · GET /sticker-runs · /cartons/{no}/history
export const getStickerContext = (...a) => stickers.getStickerContext(...a);
export const previewCartons = (...a) => stickers.previewCartons(...a);
export const checkStickerGeneration = (...a) => stickers.checkStickerGeneration(...a);
export const generateStickerRun = (...a) => stickers.generateStickerRun(...a);
export const searchStickerRuns = (...a) => stickers.searchStickerRuns(...a);
export const cartonPrintHistory = (...a) => stickers.cartonPrintHistory(...a);

// ── Export invoices ── /export-docs/invoices
export const searchInvoices = (...a) => invoices.searchInvoices(...a);
export const getInvoice = (...a) => invoices.getInvoice(...a);
export const listInvoiceablePls = (...a) => invoices.listInvoiceablePls(...a);
export const createInvoice = (...a) => invoices.createInvoice(...a);
export const updateInvoice = (...a) => invoices.updateInvoice(...a);
export const regenerateInvoiceLines = (...a) => invoices.regenerateLines(...a);
export const acknowledgeInvoiceWarning = (...a) => invoices.acknowledgeInvoiceWarning(...a);
export const changeInvoiceStatus = (...a) => invoices.changeInvoiceStatus(...a);
export const reviseInvoice = (...a) => invoices.reviseInvoice(...a);
export const markInvoiceExported = (...a) => invoices.markInvoiceExported(...a);
export const signOffInvoiceFinancials = (...a) => invoices.signOffInvoiceFinancials(...a);
export const withdrawFinanceSignOff = (...a) => invoices.withdrawFinanceSignOff(...a);
export const recallInvoice = (...a) => invoices.recallInvoice(...a);
export const deleteInvoice = (...a) => invoices.deleteInvoice(...a);

// ── Buyer document templates ── /export-docs/templates
export const searchTemplates = (...a) => templates.searchTemplates(...a);
export const getTemplate = (...a) => templates.getTemplate(...a);
export const getTemplateHealth = (...a) => templates.getTemplateHealth(...a);
export const listTemplateBuyers = (...a) => templates.listTemplateBuyers(...a);
export const createTemplate = (...a) => templates.createTemplate(...a);
export const cloneTemplate = (...a) => templates.cloneTemplate(...a);
export const newTemplateVersion = (...a) => templates.newTemplateVersion(...a);
export const updateTemplate = (...a) => templates.updateTemplate(...a);
export const publishTemplate = (...a) => templates.publishTemplate(...a);
export const retireTemplate = (...a) => templates.retireTemplate(...a);
export const deleteTemplate = (...a) => templates.deleteTemplate(...a);
export const exportTemplateJson = (...a) => templates.exportTemplateJson(...a);
export const importTemplateJson = (...a) => templates.importTemplateJson(...a);
export const compareTemplates = (...a) => templates.compareTemplates(...a);
export const getTemplateSample = (...a) => templates.getTemplateSample(...a);
export const resolveTemplateFor = (...a) => templates.resolveTemplateFor(...a);

// ── Reports and audit ── /export-docs/reports, /export-docs/audit
export const packingStatusReport = (...a) => reports.packingStatusReport(...a);
export const shipmentRegisterReport = (...a) => reports.shipmentRegisterReport(...a);
export const invoiceRegisterReport = (...a) => reports.invoiceRegisterReport(...a);
export const varianceReport = (...a) => reports.varianceReport(...a);
export const cartonMasterReport = (...a) => reports.cartonMasterReport(...a);
export const templateCoverageReport = (...a) => reports.templateCoverageReport(...a);
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
