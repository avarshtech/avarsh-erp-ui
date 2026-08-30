/**
 * Sample Request module API surface — the ONLY file screens import.
 * Mock-only during this phase; every function keeps the signature the future
 * real endpoints (/api/v1/sample-requests/…) will take, so integration swaps
 * the delegate without touching screens. (Endpoint map: see the plan/PRD v3.)
 */
import { USE_MOCK_SR_DATA } from './srEnv';
import * as mockApi from './srMockApi';
import * as mockTransitions from './srMockTransitions';
import * as mockPos from './srMockPos';
import * as mockInvoices from './srMockInvoices';
import * as mockMasters from './srMockMasters';
import * as mockImport from './srMockImport';
import * as mockDashboard from './srMockDashboard';

const notReady = () => { throw new Error('Sample Request backend not implemented yet — mock phase'); };
const guard = (impl) => (USE_MOCK_SR_DATA ? impl : new Proxy({}, { get: () => notReady }));

const api = guard(mockApi);
const transitions = guard(mockTransitions);
const pos = guard(mockPos);
const invoices = guard(mockInvoices);
const masters = guard(mockMasters);
const importer = guard(mockImport);
const dashboard = guard(mockDashboard);

// ── SR CRUD + list ── GET/POST /sample-requests, GET/PUT/DELETE /{id}
export const searchSampleRequests = (...a) => api.searchSampleRequests(...a);
export const getSampleRequest = (...a) => api.getSampleRequest(...a);
export const createSampleRequest = (...a) => api.createSampleRequest(...a);
export const updateSampleRequest = (...a) => api.updateSampleRequest(...a);
export const updateInstructions = (...a) => api.updateInstructions(...a);   // In Production only (PRD §8.3)
export const deleteSampleRequest = (...a) => api.deleteSampleRequest(...a);
export const getNextRound = (...a) => api.getNextRound(...a);
export const listByOrderNo = (...a) => api.listByOrderNo(...a);          // GET /by-order/{orderNo}
export const getActivity = (...a) => api.getActivity(...a);              // GET /{id}/activity
export const listSrBuyers = (...a) => api.listSrBuyers(...a);            // GET /buyers facet

// ── Workflow ── POST /{id}/status · /{id}/dispatch · /{id}/feedback
export const changeStatus = (...a) => transitions.changeStatus(...a);
export const saveDispatchDraft = (...a) => transitions.saveDispatchDraft(...a);
export const recordDispatch = (...a) => transitions.recordDispatch(...a);
export const saveFeedbackDraft = (...a) => transitions.saveFeedbackDraft(...a);
export const recordFeedback = (...a) => transitions.recordFeedback(...a);
export const isOverseas = (...a) => transitions.isOverseas(...a);

// ── Sample POs (mock this phase; real = PO module w/ po_type=SAMPLE) ──
export const createSamplePo = (...a) => pos.createSamplePo(...a);
export const listSamplePos = (...a) => pos.listSamplePos(...a);
export const canRaisePo = (...a) => pos.canRaisePo(...a);
export const markSamplePoReceived = (...a) => pos.markSamplePoReceived(...a);

// ── Commercial invoices ── /sample-invoices + /{id}/issue|cancel|duplicate
export const listInvoices = (...a) => invoices.listInvoices(...a);
export const getInvoice = (...a) => invoices.getInvoice(...a);
export const listEligibleSrs = (...a) => invoices.listEligibleSrs(...a);
export const createInvoice = (...a) => invoices.createInvoice(...a);
export const updateInvoice = (...a) => invoices.updateInvoice(...a);
export const issueInvoice = (...a) => invoices.issueInvoice(...a);
export const cancelInvoice = (...a) => invoices.cancelInvoice(...a);
export const duplicateInvoice = (...a) => invoices.duplicateInvoice(...a);

// ── Masters ── /sample-requests/masters/*
export const listSampleTypes = (...a) => masters.listSampleTypes(...a);
export const createSampleType = (...a) => masters.createSampleType(...a);
export const listCouriers = (...a) => masters.listCouriers(...a);
export const listBuyingOffices = (...a) => masters.listBuyingOffices(...a);
export const listRejectionReasons = (...a) => masters.listRejectionReasons(...a);
export const getFeedbackCategoryLabels = (...a) => masters.getFeedbackCategoryLabels(...a);
export const listHsnCodes = (...a) => masters.listHsnCodes(...a);
export const getHsnDefault = (...a) => masters.getHsnDefault(...a);
export const getCompanyProfileExtra = (...a) => masters.getCompanyProfileExtra(...a);
export const getStockStatus = (...a) => masters.getStockStatus(...a);

// ── Comment-sheet import ── POST /{id}/comment-sheet:parse
export const parseCommentSheet = (...a) => importer.parseCommentSheet(...a);

// ── Dashboard ── GET /sample-requests/dashboard
export const getSampleDashboard = (...a) => dashboard.getSampleDashboard(...a);
