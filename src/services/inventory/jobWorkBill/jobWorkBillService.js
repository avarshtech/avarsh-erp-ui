/**
 * Job-work bill passing (Cut Panel PO / Garment Process PO vendor bills) — the facade the screens import.
 *
 * STAGE 1 MOCK: every call runs against the browser demo store (jwb*.js beside this file) and never reaches the
 * API. Names, arguments and response shapes are the Stage 2 API's, so the cutover replaces only this file's
 * bodies with axios calls and deletes the jwb* demo files. Like axiosInstance, a refusal is toasted here and
 * rethrown in axios' shape (`e.response.data.error`), so the screens' own error handling is the real one.
 */
import { emitMessage } from '../../../components/GlobalMessageEmitter';
import { BILL_SOURCE } from '../../../utils/jobWorkBillConstants';
import { resetJwbDb } from './jwbDemoStore';
import { mockBillableVendors, mockBillablePos, mockBillFilterOptions } from './jwbMockSources';
import { mockListBills, mockGetBill, mockCreateBill, mockUpdateBill, mockDeleteBill } from './jwbMockBills';
import { transition } from './jwbMockWorkflow';
import { mockProposeDeductions, mockSaveDeduction, mockSetDeductionStatus, mockDeleteDeduction } from './jwbMockDeductions';

/** True while the job-work bills run on demo data; the screens show the demo markers off it. */
export const JOB_WORK_BILL_DEMO = true;

const JOB_WORK_SOURCES = [BILL_SOURCE.CUT_PANEL_PO, BILL_SOURCE.GARMENT_PROCESS_PO];

const call = (fn) => new Promise((resolve, reject) => {
  setTimeout(() => {
    try {
      resolve(fn());
    } catch (e) {
      if (e.response) emitMessage('error', e.response.data?.message || e.message);
      reject(e);
    }
  }, 300);
});

// ── Sources ──
export const listJobWorkBillableVendors = (source) => call(() => mockBillableVendors(source));
export const listJobWorkBillablePos = ({ source, vendorId }) => call(() => mockBillablePos({ source, vendorId }));
export const getJobWorkBillFilterOptions = (sources = JOB_WORK_SOURCES) => call(() => mockBillFilterOptions(sources));

// ── Bills ──
export const listJobWorkBills = ({ sources = JOB_WORK_SOURCES, ...params } = {}) => call(() => mockListBills({ sources, ...params }));
export const getJobWorkBill = (id) => call(() => mockGetBill(id));
export const createJobWorkBill = (body) => call(() => mockCreateBill(body));
export const updateJobWorkBill = (id, payload) => call(() => mockUpdateBill(id, payload));
export const deleteJobWorkBill = (id) => call(() => mockDeleteBill(id));

// ── Workflow — the same arguments as the supplier bill's verbs (id, …, version) ──
const verb = (name) => (id, reason) => call(() => transition(id, name, { reason }));
export const submitJobWorkBill = (id) => call(() => transition(id, 'submit'));
export const sendJobWorkForApproval = (id, { overrideReason } = {}) => call(() => transition(id, 'sendForApproval', { overrideReason }));

/** For the shared action table (billWorkflowActions.js). */
export const JOB_WORK_VERBS = {
  startVerification: (id) => call(() => transition(id, 'startVerification')),
  referBack: verb('referBack'),
  raiseQuery: verb('query'),
  hold: verb('hold'),
  sendForApproval: sendJobWorkForApproval,
  releaseHold: verb('release'),
  approve: (id) => call(() => transition(id, 'approve')),
  reject: verb('reject'),
  sendToAccounts: (id) => call(() => transition(id, 'sendToAccounts')),
  reopen: verb('reopen'),
  recordTallyReference: verb('tallyReference'),
};

// ── Deductions (the Vendor Debit Note's lines) ──
export const proposeJobWorkDeductions = (id) => call(() => mockProposeDeductions(id));
export const saveJobWorkDeduction = (id, deduction) => call(() => mockSaveDeduction(id, deduction));
export const setJobWorkDeductionStatus = (id, deductionId, status, reason) => call(() => mockSetDeductionStatus(id, deductionId, status, reason));
export const deleteJobWorkDeduction = (id, deductionId) => call(() => mockDeleteDeduction(id, deductionId));

/** "Reset demo data": back to the seed, relative to today. */
export const resetJobWorkBillDemo = () => call(() => { resetJwbDb(); return true; });
