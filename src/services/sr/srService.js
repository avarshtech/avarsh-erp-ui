/**
 * Sample Request module API surface — the ONLY file screens import.
 *
 * Mid-cutover: each stage repoints a block of these exports from the srMock*
 * modules to srApi.js, so a screen never learns which side it is talking to.
 * Everything still marked mock keeps the signature its real endpoint will take.
 *
 * Real as of Stage 3: masters, SR CRUD + list, the BOM preview, status changes,
 * feedback, the dashboard and the sample issues. Still mock: dispatches,
 * invoices, buying offices and the comment-sheet import.
 *
 * The mock modules stay on disk until the last block flips. srMockApi,
 * srMockTransitions and srMockIssues are no longer imported HERE, but
 * srMockDispatches and srMockInvoices each pull `decorate`/`stampStatus` out of
 * srMockApi — deleting it would break every screen still on the mock.
 */
import { USE_MOCK_SR_DATA } from './srEnv';
import * as srApi from './srApi';
import * as mockInvoices from './srMockInvoices';
import * as mockMasters from './srMockMasters';
import * as mockImport from './srMockImport';
import * as mockDispatches from './srMockDispatches';

const notReady = () => { throw new Error('Sample Request backend not implemented yet — mock phase'); };
const guard = (impl) => (USE_MOCK_SR_DATA ? impl : new Proxy({}, { get: () => notReady }));

const invoices = guard(mockInvoices);
const masters = guard(mockMasters);
const importer = guard(mockImport);
const dispatches = guard(mockDispatches);

// ── SR CRUD + list ── REAL: GET/POST /sample-requests, GET/PUT/DELETE /{id}
// bomPreview is what a new request starts from: the server materialises the BOM
// into material lines, so no screen assembles a draft from BOM + Order + Buyer.
// getActivity is gone — the SR DTO already carries `activity`.
export const searchSampleRequests = (...a) => srApi.searchSampleRequests(...a);
export const getSampleRequest = (...a) => srApi.getSampleRequest(...a);
export const createSampleRequest = (...a) => srApi.createSampleRequest(...a);
export const updateSampleRequest = (...a) => srApi.updateSampleRequest(...a); // (id, payload{version})
export const updateInstructions = (...a) => srApi.updateInstructions(...a);   // In Production only (PRD §8.3); payload carries version
export const deleteSampleRequest = (...a) => srApi.deleteSampleRequest(...a);
export const listByOrderNo = (...a) => srApi.listByOrderNo(...a);        // GET /by-order?orderNo= (order nos carry "/")
export const listSrBuyers = (...a) => srApi.listSrBuyers(...a);          // GET /buyers facet
export const bomPreview = (...a) => srApi.bomPreview(...a);              // GET /bom-preview?bomId= | ?orderNo=

// ── Workflow ── REAL: PUT /{id}/status · /{id}/feedback[/draft]
// isOverseas is gone — the SR DTO carries `overseas`, decided against the
// company country the server holds rather than a constant in the browser.
export const changeStatus = (...a) => srApi.changeStatus(...a);              // (id, target, version)
export const saveFeedbackDraft = (...a) => srApi.saveFeedbackDraft(...a);    // (id, dto{version})
export const recordFeedback = (...a) => srApi.recordFeedback(...a);          // (id, dto{version}) → SR

// ── Dispatches (R2) ── /sample-dispatches CRUD + /{id}/mark-dispatched
export const searchDispatches = (...a) => dispatches.searchDispatches(...a);
export const getDispatch = (...a) => dispatches.getDispatch(...a);
export const listDispatchableSrs = (...a) => dispatches.listDispatchableSrs(...a);
export const listDispatchableCustomers = (...a) => dispatches.listDispatchableCustomers(...a);
export const createDispatch = (...a) => dispatches.createDispatch(...a);
export const updateDispatch = (...a) => dispatches.updateDispatch(...a);    // (id, dto{version})
export const deleteDispatch = (...a) => dispatches.deleteDispatch(...a);
export const markDispatched = (...a) => dispatches.markDispatched(...a);    // (id, version)

// ── Sample Request Issue ── REAL: /sample-issues (+ /fabric, /trims, /{id}/cancel)
// Material issue gates Submitted → In Production, and cancelling the last one
// gates it back. Fabric and trims are SEPARATE documents against one request,
// so the single createSampleIssue the mock had is replaced by two creators —
// the fabric one picks rolls, the trims one takes quantities. Rows come back as
// MaterialIssueResponse, which is why the shared IssueViewDrawer reads them.
export const listIssuableSrs = (...a) => srApi.listIssuableSrs(...a);
export const listSampleIssues = (...a) => srApi.listSampleIssues(...a);              // ({search,dateFrom,dateTo,type,page,size})
export const getSampleIssue = (...a) => srApi.getSampleIssue(...a);
export const getSampleIssuableRolls = (...a) => srApi.getSampleIssuableRolls(...a);  // (srId, lineNo)
export const createSampleFabricIssue = (...a) => srApi.createSampleFabricIssue(...a);
export const createSampleTrimsIssue = (...a) => srApi.createSampleTrimsIssue(...a);
export const cancelSampleIssue = (...a) => srApi.cancelSampleIssue(...a);            // (id, reason)

// ── Commercial invoices ── /sample-invoices + /{id}/issue|cancel|duplicate
export const listInvoices = (...a) => invoices.listInvoices(...a);
export const getInvoice = (...a) => invoices.getInvoice(...a);
export const listEligibleSrs = (...a) => invoices.listEligibleSrs(...a);
export const createInvoice = (...a) => invoices.createInvoice(...a);
export const updateInvoice = (...a) => invoices.updateInvoice(...a);
export const issueInvoice = (...a) => invoices.issueInvoice(...a);          // (id, version)
export const cancelInvoice = (...a) => invoices.cancelInvoice(...a);        // (id, reason, version)
export const duplicateInvoice = (...a) => invoices.duplicateInvoice(...a);

// ── Masters ── REAL: /sample-requests/masters/* (sample types are a FIXED list of 8)
// Couriers are maintained on their own Master Data tab now. getCompanyProfileExtra
// is gone: those fields live on the organisation record, and useCompanyProfile
// derives them from its DTO.
export const listSampleTypes = (...a) => srApi.listSampleTypes(...a);
export const listCouriers = (...a) => srApi.listCouriers(...a);
export const listRejectionReasons = (...a) => srApi.listRejectionReasons(...a);
export const getFeedbackCategoryLabels = (...a) => srApi.getFeedbackCategoryLabels(...a);
export const listHsnCodes = (...a) => srApi.listHsnCodes(...a);
export const getHsnDefault = (...a) => srApi.getHsnDefault(...a);

// Still mock. getStockStatus is gone: the SR DTO carries materials[].stockStatus
// and materials[].stockAvailable, read live off the stock tables on every fetch.
// listBuyingOffices survives only until the dispatch screen moves to the buyer's
// shipping locations in Stage 5.
export const listBuyingOffices = (...a) => masters.listBuyingOffices(...a);

// ── Comment-sheet import ── POST /{id}/comment-sheet:parse
export const parseCommentSheet = (...a) => importer.parseCommentSheet(...a);

// ── Dashboard ── REAL: GET /sample-requests/dashboard
export const getSampleDashboard = (...a) => srApi.getSampleDashboard(...a);
