/**
 * Sample Request module API surface — the ONLY file screens import.
 *
 * Each stage of the cutover repointed a block of these exports from the srMock*
 * modules to sampleRequestApi.js, so a screen never learned which side it was talking to.
 *
 * Every export is real and the mock modules are gone. The file survives the
 * demolition on purpose: it is the one import path the screens know, so a later
 * endpoint move is a one-line change here rather than a sweep of the pages.
 */
import * as sampleRequestApi from './sampleRequestApi';

// ── SR CRUD + list ── REAL: GET/POST /sample-requests, GET/PUT/DELETE /{id}
// bomPreview is what a new request starts from: the server materialises the BOM
// into material lines, so no screen assembles a draft from BOM + Order + Buyer.
// getActivity is gone — the SR DTO already carries `activity`.
export const searchSampleRequests = (...a) => sampleRequestApi.searchSampleRequests(...a);
export const getSampleRequest = (...a) => sampleRequestApi.getSampleRequest(...a);
export const createSampleRequest = (...a) => sampleRequestApi.createSampleRequest(...a);
export const createSampleRequestBatch = (...a) => sampleRequestApi.createSampleRequestBatch(...a);
export const updateSampleRequest = (...a) => sampleRequestApi.updateSampleRequest(...a); // (id, payload{version})
export const updateInstructions = (...a) => sampleRequestApi.updateInstructions(...a);   // In Production only (PRD §8.3); payload carries version
export const reviseDeadline = (...a) => sampleRequestApi.reviseDeadline(...a);           // Submitted / In Production; payload{revisedDispatchDeadline, revisedBuyerApprovalDeadline?, reason, version}
export const deleteSampleRequest = (...a) => sampleRequestApi.deleteSampleRequest(...a);
export const raiseSrRevision = (...a) => sampleRequestApi.raiseSrRevision(...a);         // POST /{id}/revisions → the new Draft (Rev N+1)
export const listByOrderNo = (...a) => sampleRequestApi.listByOrderNo(...a);        // GET /by-order?orderNo= (order nos carry "/")
export const listSrBuyers = (...a) => sampleRequestApi.listSrBuyers(...a);          // GET /buyers facet
export const bomPreview = (...a) => sampleRequestApi.bomPreview(...a);              // GET /bom-preview?bomId= | ?orderNo=

// ── Workflow ── REAL: PUT /{id}/status · /{id}/feedback[/draft]
// isOverseas is gone — the SR DTO carries `overseas`, decided against the
// company country the server holds rather than a constant in the browser.
export const changeStatus = (...a) => sampleRequestApi.changeStatus(...a);              // (id, target, version)
export const saveFeedbackDraft = (...a) => sampleRequestApi.saveFeedbackDraft(...a);    // (id, dto{version})
export const recordFeedback = (...a) => sampleRequestApi.recordFeedback(...a);          // (id, dto{version}) → SR

// ── Dispatches ── REAL: /sample-dispatches CRUD + /{id}/mark-dispatched
// Only ids are sent: buyer name/country, courier name and the buying-office
// label are resolved server-side. listDispatchableSrs takes the draft's own id
// so its requests stay listed — the form no longer merges them back in itself.
export const searchDispatches = (...a) => sampleRequestApi.searchDispatches(...a);
export const getDispatch = (...a) => sampleRequestApi.getDispatch(...a);
export const listDispatchableSrs = (...a) => sampleRequestApi.listDispatchableSrs(...a);          // (buyerId, dispatchId)
export const listDispatchableCustomers = (...a) => sampleRequestApi.listDispatchableCustomers(...a);
export const createDispatch = (...a) => sampleRequestApi.createDispatch(...a);
export const updateDispatch = (...a) => sampleRequestApi.updateDispatch(...a);    // (id, dto{version})
export const deleteDispatch = (...a) => sampleRequestApi.deleteDispatch(...a);
export const markDispatched = (...a) => sampleRequestApi.markDispatched(...a);    // (id, version) — 409 INVOICE_REQUIRED

// ── Sample Request Issue ── REAL: /sample-issues (+ /fabric, /trims, /{id}/cancel)
// Material issue gates Submitted → In Production, and cancelling the last one
// gates it back. Fabric and trims are SEPARATE documents against one request,
// so the single createSampleIssue the mock had is replaced by two creators —
// the fabric one picks rolls, the trims one takes quantities. Rows come back as
// MaterialIssueResponse, which is why the shared IssueViewDrawer reads them.
export const listIssuableSrs = (...a) => sampleRequestApi.listIssuableSrs(...a);
export const listSampleIssues = (...a) => sampleRequestApi.listSampleIssues(...a);              // ({search,dateFrom,dateTo,type,page,size})
export const getSampleIssue = (...a) => sampleRequestApi.getSampleIssue(...a);
export const getSampleIssuableRolls = (...a) => sampleRequestApi.getSampleIssuableRolls(...a);  // (srId, lineNo)
export const createSampleFabricIssue = (...a) => sampleRequestApi.createSampleFabricIssue(...a);
export const createSampleTrimsIssue = (...a) => sampleRequestApi.createSampleTrimsIssue(...a);
export const cancelSampleIssue = (...a) => sampleRequestApi.cancelSampleIssue(...a);            // (id, reason)

// ── Invoices ── REAL: /sample-invoices + /{id}/issue|cancel|duplicate
// listInvoices answers {content, totalElements, stats} rather than a page: the
// screen filters client-side and the four cards count every invoice. The series
// and the number come from the organisation profile, never from the payload.
export const listInvoices = (...a) => sampleRequestApi.listInvoices(...a);
export const getInvoice = (...a) => sampleRequestApi.getInvoice(...a);
export const listEligibleSrs = (...a) => sampleRequestApi.listEligibleSrs(...a);      // ({type, consigneeBuyerId, dispatchId})
export const createInvoice = (...a) => sampleRequestApi.createInvoice(...a);
export const updateInvoice = (...a) => sampleRequestApi.updateInvoice(...a);          // (id, payload{version})
export const issueInvoice = (...a) => sampleRequestApi.issueInvoice(...a);            // (id, version)
export const cancelInvoice = (...a) => sampleRequestApi.cancelInvoice(...a);          // (id, reason, version)
export const duplicateInvoice = (...a) => sampleRequestApi.duplicateInvoice(...a);

// ── Masters ── REAL: /sample-requests/masters/* (sample types are a FIXED list of 8)
// Couriers are maintained on their own Master Data tab now. getCompanyProfileExtra
// is gone: those fields live on the organisation record, and useCompanyProfile
// derives them from its DTO.
export const listSampleTypes = (...a) => sampleRequestApi.listSampleTypes(...a);
export const listCouriers = (...a) => sampleRequestApi.listCouriers(...a);
export const listRejectionReasons = (...a) => sampleRequestApi.listRejectionReasons(...a);
export const getFeedbackCategoryLabels = (...a) => sampleRequestApi.getFeedbackCategoryLabels(...a);
export const listHsnCodes = (...a) => sampleRequestApi.listHsnCodes(...a);
export const getHsnDefault = (...a) => sampleRequestApi.getHsnDefault(...a);

// getStockStatus is gone: the SR DTO carries materials[].stockStatus and
// materials[].stockAvailable, read live off the stock tables on every fetch.
// listBuyingOffices is gone too — a hand delivery now picks one of the buyer's
// own shipping locations, so there is no separate buying-office list to keep.

// ── Comment-sheet import ── REAL: POST /{id}/comment-sheet/parse
// Advisory only: it returns candidate rows and writes nothing, so the save
// endpoints above stay the only things that touch the record.
export const parseCommentSheet = (...a) => sampleRequestApi.parseCommentSheet(...a);

// ── Dashboard ── REAL: GET /sample-requests/dashboard
export const getSampleDashboard = (...a) => sampleRequestApi.getSampleDashboard(...a);
