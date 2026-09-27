/** Cut Panel PO data access — screens import only from here (mock until the API exists). */
import { USE_MOCK_CUT_PANEL_PO } from '../jobWork/jobWorkEnv';
import * as api from './cutPanelPoMockApi';
import * as flow from './cutPanelPoWorkflowMock';
import * as revision from './cutPanelPoRevisionMock';
import * as lookups from './cutPanelPoLookupsMock';
import * as shared from '../jobWork/jobWorkLookupsMock';

const unavailable = () => Promise.reject(new Error('The Cut Panel PO API is not available yet.'));
const all = { ...api, ...flow, ...revision, ...lookups, ...shared };
const pick = (name) => (USE_MOCK_CUT_PANEL_PO ? all[name] : unavailable);

export const [listCpps, getCpp, saveCpp, deleteCpp, updateCppDetails, getCppAudit] =
  ['listCpps', 'getCpp', 'saveCpp', 'deleteCpp', 'updateCppDetails', 'getCppAudit'].map(pick);
export const [submitCpp, recallCpp, approveCpp, sendBackCpp, rejectCpp, sendCppToVendor, cancelCpp, shortCloseCpp] =
  ['submitCpp', 'recallCpp', 'approveCpp', 'sendBackCpp', 'rejectCpp', 'sendCppToVendor', 'cancelCpp', 'shortCloseCpp'].map(pick);
export const [requestCppOverride, authoriseCppOverride, cppContext] = ['requestCppOverride', 'authoriseCppOverride', 'cppContext'].map(pick);
export const [amendCpp, saveCppRevision, submitCppRevision, approveCppRevision, sendBackCppRevision, dropCppRevision] =
  ['amendCpp', 'saveCppRevision', 'submitCppRevision', 'approveCppRevision', 'sendBackCppRevision', 'dropCppRevision'].map(pick);
export const [cppProcessOptions, cppEligibleCprs, cppFetchLines, lastRates, duplicatePos] =
  ['cppProcessOptions', 'cppEligibleCprs', 'cppFetchLines', 'lastRates', 'duplicatePos'].map(pick);
