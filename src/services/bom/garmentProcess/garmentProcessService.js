/**
 * Garment Process Requirement data access — screens import only from here.
 * The real endpoints (/gpr, PRD §18.1) come after the design review; until then
 * USE_MOCK_GARMENT_PROCESS_DATA keeps every call on the mock.
 */
import { USE_MOCK_GARMENT_PROCESS_DATA } from '../requirementEnv';
import * as mockApi from './garmentProcessMockApi';

const unavailable = () => Promise.reject(new Error('The Garment Process Requirement API is not available yet.'));
const pick = (name) => (USE_MOCK_GARMENT_PROCESS_DATA ? mockApi[name] : unavailable);

export const listGprs = pick('listGprs');
export const getGpr = pick('getGpr');
export const getGprsForOrder = pick('getGprsForOrder');
export const getGprEligibleOrders = pick('getGprEligibleOrders');
export const getGprOrderContext = pick('getGprOrderContext');
export const saveGpr = pick('saveGpr');
export const submitGpr = pick('submitGpr');
export const reopenGpr = pick('reopenGpr');
export const closeGpr = pick('closeGpr');
export const getGprAudit = pick('getGprAudit');
