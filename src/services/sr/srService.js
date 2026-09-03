/**
 * Sample Request module API surface — the ONLY file screens import.
 *
 * Mid-cutover: each stage repoints a block of these exports from the srMock*
 * modules to srApi.js, so a screen never learns which side it is talking to.
 * Everything still marked mock keeps the signature its real endpoint will take.
 * The mock modules stay on disk until the last block flips — srMockApi.decorate
 * is imported by four of them.
 */
import { USE_MOCK_SR_DATA } from './srEnv';
import * as srApi from './srApi';
import * as mockApi from './srMockApi';
import * as mockTransitions from './srMockTransitions';
import * as mockInvoices from './srMockInvoices';
import * as mockMasters from './srMockMasters';
import * as mockImport from './srMockImport';
import * as mockDashboard from './srMockDashboard';
import * as mockDispatches from './srMockDispatches';
import * as mockIssues from './srMockIssues';

const notReady = () => { throw new Error('Sample Request backend not implemented yet — mock phase'); };
const guard = (impl) => (USE_MOCK_SR_DATA ? impl : new Proxy({}, { get: () => notReady }));

const api = guard(mockApi);
const transitions = guard(mockTransitions);
const invoices = guard(mockInvoices);
const masters = guard(mockMasters);
const importer = guard(mockImport);
const dashboard = guard(mockDashboard);
const dispatches = guard(mockDispatches);
const issues = guard(mockIssues);

// ── SR CRUD + list ── GET/POST /sample-requests, GET/PUT/DELETE /{id}
export const searchSampleRequests = (...a) => api.searchSampleRequests(...a);
export const getSampleRequest = (...a) => api.getSampleRequest(...a);
export const createSampleRequest = (...a) => api.createSampleRequest(...a);
export const updateSampleRequest = (...a) => api.updateSampleRequest(...a); // (id, payload{version})
export const updateInstructions = (...a) => api.updateInstructions(...a);   // In Production only (PRD §8.3); payload carries version
export const deleteSampleRequest = (...a) => api.deleteSampleRequest(...a);
export const listByOrderNo = (...a) => api.listByOrderNo(...a);          // GET /by-order/{orderNo}
export const getActivity = (...a) => api.getActivity(...a);              // GET /{id}/activity
export const listSrBuyers = (...a) => api.listSrBuyers(...a);            // GET /buyers facet

// ── Workflow ── POST /{id}/status · /{id}/feedback (dispatch = own entity below)
export const changeStatus = (...a) => transitions.changeStatus(...a);        // (id, target, version)
export const saveFeedbackDraft = (...a) => transitions.saveFeedbackDraft(...a); // (id, dto{version})
export const recordFeedback = (...a) => transitions.recordFeedback(...a);    // (id, dto{version}) → SR
export const isOverseas = (...a) => transitions.isOverseas(...a);

// ── Dispatches (R2) ── /sample-dispatches CRUD + /{id}/mark-dispatched
export const searchDispatches = (...a) => dispatches.searchDispatches(...a);
export const getDispatch = (...a) => dispatches.getDispatch(...a);
export const listDispatchableSrs = (...a) => dispatches.listDispatchableSrs(...a);
export const listDispatchableCustomers = (...a) => dispatches.listDispatchableCustomers(...a);
export const createDispatch = (...a) => dispatches.createDispatch(...a);
export const updateDispatch = (...a) => dispatches.updateDispatch(...a);    // (id, dto{version})
export const deleteDispatch = (...a) => dispatches.deleteDispatch(...a);
export const markDispatched = (...a) => dispatches.markDispatched(...a);    // (id, version)

// ── Sample Request Issue (R2) ── material issue gates Submitted → In Production
export const listIssuableSrs = (...a) => issues.listIssuableSrs(...a);
export const createSampleIssue = (...a) => issues.createSampleIssue(...a);
export const listSampleIssues = (...a) => issues.listSampleIssues(...a);
export const getSampleIssue = (...a) => issues.getSampleIssue(...a);

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

// Still mock. getStockStatus is replaced by the server-computed
// materials[].stockStatus in Stage 2; listBuyingOffices survives only until the
// dispatch screen moves to the buyer's shipping locations in Stage 5.
export const getStockStatus = (...a) => masters.getStockStatus(...a);
export const listBuyingOffices = (...a) => masters.listBuyingOffices(...a);

// ── Comment-sheet import ── POST /{id}/comment-sheet:parse
export const parseCommentSheet = (...a) => importer.parseCommentSheet(...a);

// ── Dashboard ── GET /sample-requests/dashboard
export const getSampleDashboard = (...a) => dashboard.getSampleDashboard(...a);
