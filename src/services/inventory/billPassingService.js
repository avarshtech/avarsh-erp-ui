/**
 * Bill Passing module API surface — the ONLY file screens import.
 *
 * Mock-only during this phase; every function keeps the signature the future
 * real endpoints (/api/v1/inventory/bill-passing/…) will take, so integration
 * swaps the delegate without touching a single screen. Section comments name
 * the endpoint each group will map to.
 */
import { USE_MOCK_BILL_PASSING_DATA } from './billPassingEnv';
import * as mockApi from './billPassingMockApi';
import * as mockSource from './billPassingMockSource';
import * as mockMasters from './billPassingMockMasters';

const notReady = () => { throw new Error('Bill Passing backend not implemented yet — mock phase'); };
const guard = (impl) => (USE_MOCK_BILL_PASSING_DATA ? impl : new Proxy({}, { get: () => notReady }));

const api = guard(mockApi);
const source = guard(mockSource);
const masters = guard(mockMasters);

// ── Bill CRUD + list ── GET/POST /bill-passing, GET/PUT/DELETE /{id}
export const searchBills = (...a) => api.searchBills(...a);
export const getBill = (...a) => api.getBill(...a);
export const createBill = (...a) => api.createBill(...a);
export const updateBill = (...a) => api.updateBill(...a);
export const deleteBill = (...a) => api.deleteBill(...a);
export const refreshSourceData = (...a) => api.refreshSourceData(...a);   // POST /{id}/refresh

// ── Auto-pull sources ── GET /bill-passing/sources/*
export const listBpSuppliers = (...a) => source.listBpSuppliers(...a);
export const listBillablePos = (...a) => source.listBillablePos(...a);
export const getPoBillingSource = (...a) => source.getPoBillingSource(...a);

// ── PO-line register (replaces the Excel sheet) ── GET /bill-passing/lines
export const searchBillLines = (...a) => source.searchBillLines(...a);

// ── Workflow ── POST /{id}/{submit|verify|query|hold|release|approve|reject|…}
export const submitBill = (...a) => api.submitBill(...a);
export const startVerification = (...a) => api.startVerification(...a);
export const raiseQuery = (...a) => api.raiseQuery(...a);
export const holdBill = (...a) => api.holdBill(...a);
export const releaseHold = (...a) => api.releaseHold(...a);
export const sendForApproval = (...a) => api.sendForApproval(...a);
export const approveBill = (...a) => api.approveBill(...a);
export const rejectBill = (...a) => api.rejectBill(...a);
export const reopenBill = (...a) => api.reopenBill(...a);
export const sendToAccounts = (...a) => api.sendToAccounts(...a);
export const recordTallyReference = (...a) => api.recordTallyReference(...a);

// ── Debits ── POST/PUT/DELETE /{id}/debits
export const refreshProposedDebits = (...a) => api.refreshProposedDebits(...a);
export const saveDebit = (...a) => api.saveDebit(...a);
export const setDebitStatus = (...a) => api.setDebitStatus(...a);
export const deleteDebit = (...a) => api.deleteDebit(...a);

// ── Issue log ── POST/PATCH /{id}/issues
export const addIssue = (...a) => api.addIssue(...a);
export const setIssueStatus = (...a) => api.setIssueStatus(...a);
export const withdrawIssue = (...a) => api.withdrawIssue(...a);

// ── Attachments ── POST/DELETE /{id}/attachments
export const addAttachment = (...a) => api.addAttachment(...a);
export const removeAttachment = (...a) => api.removeAttachment(...a);

// ── Dashboard ── GET /bill-passing/dashboard
export const getBillPassingDashboard = (...a) => api.getBillPassingDashboard(...a);

// ── Configuration masters ── /bill-passing/masters/*
export const listDebitTypes = (...a) => masters.listDebitTypes(...a);
export const saveDebitType = (...a) => masters.saveDebitType(...a);
export const deleteDebitType = (...a) => masters.deleteDebitType(...a);
export const listChargeTypes = (...a) => masters.listChargeTypes(...a);
export const saveChargeType = (...a) => masters.saveChargeType(...a);
export const deleteChargeType = (...a) => masters.deleteChargeType(...a);
export const listIssueTypes = (...a) => masters.listIssueTypes(...a);
export const saveIssueType = (...a) => masters.saveIssueType(...a);
export const deleteIssueType = (...a) => masters.deleteIssueType(...a);
export const getTolerance = (...a) => masters.getTolerance(...a);
export const saveTolerance = (...a) => masters.saveTolerance(...a);
