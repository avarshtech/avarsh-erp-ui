/**
 * Cut Panel Requirement data access — screens import only from here.
 * The real endpoints (/cut-panel-requirements, PRD §17) come after the design review;
 * until then USE_MOCK_CUT_PANEL_DATA keeps every call on the mock.
 */
import { USE_MOCK_CUT_PANEL_DATA } from '../requirementEnv';
import * as mockApi from './cutPanelMockApi';

const unavailable = () => Promise.reject(new Error('The Cut Panel Requirement API is not available yet.'));
const pick = (name) => (USE_MOCK_CUT_PANEL_DATA ? mockApi[name] : unavailable);

export const listCprs = pick('listCprs');
export const getCpr = pick('getCpr');
export const getCprsForOrder = pick('getCprsForOrder');
export const getCprEligibleOrders = pick('getCprEligibleOrders');
export const getCprOrderContext = pick('getCprOrderContext');
export const saveCpr = pick('saveCpr');
export const submitCpr = pick('submitCpr');
export const reopenCpr = pick('reopenCpr');
export const closeCpr = pick('closeCpr');
export const deleteCpr = pick('deleteCpr');
export const getCprAudit = pick('getCprAudit');
