/**
 * Sample Request module API surface — the ONLY file screens import.
 *
 * Each stage of the cutover repointed a block of these exports from the srMock*
 * modules to srApi.js, so a screen never learned which side it was talking to.
 *
 * Every export is real and the mock modules are gone. The file survives the
 * demolition on purpose: it is the one import path the screens know, so a later
 * endpoint move is a one-line change here rather than a sweep of the pages.
 */
import * as srApi from './srApi';

// ── SR CRUD + list ── REAL: GET/POST /sample-requests, GET/PUT/DELETE /{id}
// bomPreview is what a new request starts from: the server materialises the BOM
// into material lines, so no screen assembles a draft from BOM + Order + Buyer.
// getActivity is gone — the SR DTO already carries `activity`.
export const searchSampleRequests = (...a) => srApi.searchSampleRequests(...a);
export const getSampleRequest = (...a) => srApi.getSampleRequest(...a);
export const createSampleRequest = (...a) => srApi.createSampleRequest(...a);
export const updateSampleRequest = (...a) => srApi.updateSampleRequest(...a); // (id, payload{version})
export const updateInstructions = (...a) => srApi.updateInstructions(...a);   // In Production only (PRD §8.3); payload carries version
export const reviseDeadline = (...a) => srApi.reviseDeadline(...a);           // Submitted / In Production; payload{revisedDispatchDeadline, revisedBuyerApprovalDeadline?, reason, version}
export const deleteSampleRequest = (...a) => srApi.deleteSampleRequest(...a);
export const raiseSrRevision = (...a) => srApi.raiseSrRevision(...a);         // POST /{id}/revisions → the new Draft (Rev N+1)
export const listByOrderNo = (...a) => srApi.listByOrderNo(...a);        // GET /by-order?orderNo= (order nos carry "/")
export const listSrBuyers = (...a) => srApi.listSrBuyers(...a);          // GET /buyers facet
export const bomPreview = (...a) => srApi.bomPreview(...a);              // GET /bom-preview?bomId= | ?orderNo=

// ── Workflow ── REAL: PUT /{id}/status · /{id}/feedback[/draft]
// isOverseas is gone — the SR DTO carries `overseas`, decided against the
// company country the server holds rather than a constant in the browser.
export const changeStatus = (...a) => srApi.changeStatus(...a);              // (id, target, version)
export const saveFeedbackDraft = (...a) => srApi.saveFeedbackDraft(...a);    // (id, dto{version})
export const recordFeedback = (...a) => srApi.recordFeedback(...a);          // (id, dto{version}) → SR

// ── Dispatches ── REAL: /sample-dispatches CRUD + /{id}/mark-dispatched
// Only ids are sent: buyer name/country, courier name and the buying-office
// label are resolved server-side. listDispatchableSrs takes the draft's own id
// so its requests stay listed — the form no longer merges them back in itself.
export const searchDispatches = (...a) => srApi.searchDispatches(...a);
export const getDispatch = (...a) => srApi.getDispatch(...a);
export const listDispatchableSrs = (...a) => srApi.listDispatchableSrs(...a);          // (buyerId, dispatchId)
export const listDispatchableCustomers = (...a) => srApi.listDispatchableCustomers(...a);
export const createDispatch = (...a) => srApi.createDispatch(...a);
export const updateDispatch = (...a) => srApi.updateDispatch(...a);    // (id, dto{version})
export const deleteDispatch = (...a) => srApi.deleteDispatch(...a);
export const markDispatched = (...a) => srApi.markDispatched(...a);    // (id, version) — 409 INVOICE_REQUIRED

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

// ── Invoices ── REAL: /sample-invoices + /{id}/issue|cancel|duplicate
// listInvoices answers {content, totalElements, stats} rather than a page: the
// screen filters client-side and the four cards count every invoice. The series
// and the number come from the organisation profile, never from the payload.
export const listInvoices = (...a) => srApi.listInvoices(...a);
export const getInvoice = (...a) => srApi.getInvoice(...a);
export const listEligibleSrs = (...a) => srApi.listEligibleSrs(...a);      // ({type, consigneeBuyerId, dispatchId})
export const createInvoice = (...a) => srApi.createInvoice(...a);
export const updateInvoice = (...a) => srApi.updateInvoice(...a);          // (id, payload{version})
export const issueInvoice = (...a) => srApi.issueInvoice(...a);            // (id, version)
export const cancelInvoice = (...a) => srApi.cancelInvoice(...a);          // (id, reason, version)
export const duplicateInvoice = (...a) => srApi.duplicateInvoice(...a);

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

// getStockStatus is gone: the SR DTO carries materials[].stockStatus and
// materials[].stockAvailable, read live off the stock tables on every fetch.
// listBuyingOffices is gone too — a hand delivery now picks one of the buyer's
// own shipping locations, so there is no separate buying-office list to keep.

// ── Comment-sheet import ── REAL: POST /{id}/comment-sheet/parse
// Advisory only: it returns candidate rows and writes nothing, so the save
// endpoints above stay the only things that touch the record.
export const parseCommentSheet = (...a) => srApi.parseCommentSheet(...a);

// ── Dashboard ── REAL: GET /sample-requests/dashboard
export const getSampleDashboard = (...a) => srApi.getSampleDashboard(...a);
