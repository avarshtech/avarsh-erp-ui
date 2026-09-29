/** Garment Process PO data access — screens import only from here (mock until the API exists). */
import { USE_MOCK_GARMENT_PROCESS_PO } from '../jobWork/jobWorkEnv';
import * as api from './garmentProcessPoMockApi';
import * as flow from './garmentProcessPoWorkflowMock';
import * as lookups from './garmentProcessPoLookupsMock';
import * as shared from '../jobWork/jobWorkLookupsMock';

const unavailable = () => Promise.reject(new Error('The Garment Process PO API is not available yet.'));
const all = { ...api, ...flow, ...lookups, ...shared };
const pick = (name) => (USE_MOCK_GARMENT_PROCESS_PO ? all[name] : unavailable);

export const [listGpos, getGpo, saveGpo, amendGpoDates, getGpoAudit] =
  ['listGpos', 'getGpo', 'saveGpo', 'amendGpoDates', 'getGpoAudit'].map(pick);
export const [submitGpo, recallGpo, approveGpo, rejectGpo, sendGpoToVendor, cancelGpo, shortCloseGpo] =
  ['submitGpo', 'recallGpo', 'approveGpo', 'rejectGpo', 'sendGpoToVendor', 'cancelGpo', 'shortCloseGpo'].map(pick);
export const [requestGpoExcess, approveGpoExcess, gpoContext] = ['requestGpoExcess', 'approveGpoExcess', 'gpoContext'].map(pick);
export const [gpoRequirementRows, gpoRequirementCells, gpoFetchLines, lastRates] =
  ['gpoRequirementRows', 'gpoRequirementCells', 'gpoFetchLines', 'lastRates'].map(pick);
