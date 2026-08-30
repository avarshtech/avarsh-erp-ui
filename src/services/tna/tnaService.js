/**
 * TNA module API surface. Mock-only during the design phase; each function
 * keeps the signature the future real endpoints (/api/v1/tna/…) will take,
 * so integration swaps the delegate without touching screens.
 */
import { USE_MOCK_TNA_DATA } from './tnaEnv';
import * as mockApi from './tnaMockApi';

const notReady = () => { throw new Error('TNA backend not implemented yet — mock phase'); };
const impl = USE_MOCK_TNA_DATA ? mockApi : new Proxy({}, { get: () => notReady });

export const listPlans = (...a) => impl.listPlans(...a);
export const getPlan = (...a) => impl.getPlan(...a);
export const getPlanVersions = (...a) => impl.getPlanVersions(...a);
export const getAuditTrail = (...a) => impl.getAuditTrail(...a);
export const recordActual = (...a) => impl.recordActual(...a);
export const proposeReplan = (...a) => impl.proposeReplan(...a);
export const listReplans = (...a) => impl.listReplans(...a);
export const actionReplan = (...a) => impl.actionReplan(...a);
export const listMyActivities = (...a) => impl.listMyActivities(...a);
export const listActivities = (...a) => impl.listActivities(...a);
export const saveActivity = (...a) => impl.saveActivity(...a);
export const listTemplates = (...a) => impl.listTemplates(...a);
export const saveTemplate = (...a) => impl.saveTemplate(...a);
export const getAnalytics = (...a) => impl.getAnalytics(...a);
