/**
 * Time & Action API surface (CR-TNA-001). Mock-only in Round 1; every function keeps the
 * signature the /api/v1/tna endpoints will take, so Round 2 swaps the delegate without
 * touching a screen. There is deliberately no function that writes a date, duration,
 * progress or status into a plan (FR-1.4, FR-6.1).
 */
import { USE_MOCK_TNA_DATA } from './tnaEnv';
import * as mockApi from './tnaMockApi';

const notReady = () => { throw new Error('Time & Action backend not implemented yet — mock phase'); };
const impl = USE_MOCK_TNA_DATA ? mockApi : new Proxy({}, { get: () => notReady });

export const getMeta = (...a) => impl.getMeta(...a);
// Plans
export const listPlans = (...a) => impl.listPlans(...a);
export const listPlanOptions = (...a) => impl.listPlanOptions(...a);
export const getPlan = (...a) => impl.getPlan(...a);
export const getActivityDetail = (...a) => impl.getActivityDetail(...a);
// Revisions & audit
export const listVersions = (...a) => impl.listVersions(...a);
export const compareVersions = (...a) => impl.compareVersions(...a);
export const getCommitments = (...a) => impl.getCommitments(...a);
export const getBaselineComparison = (...a) => impl.getBaselineComparison(...a);
export const getAuditTrail = (...a) => impl.getAuditTrail(...a);
// Activities, exceptions, data quality
export const listMyActivities = (...a) => impl.listMyActivities(...a);
export const listExceptions = (...a) => impl.listExceptions(...a);
export const getSyncStatus = (...a) => impl.getSyncStatus(...a);
export const getReconciliation = (...a) => impl.getReconciliation(...a);
export const reportDataIssue = (...a) => impl.reportDataIssue(...a);
export const resolveException = (...a) => impl.resolveException(...a);
export const acknowledgeInfeasible = (...a) => impl.acknowledgeInfeasible(...a);
// Analytics
export const getAnalytics = (...a) => impl.getAnalytics(...a);
// Masters (versioned)
export const listMasterVersions = (...a) => impl.listMasterVersions(...a);
export const getMasterVersion = (...a) => impl.getMasterVersion(...a);
export const createDraftVersion = (...a) => impl.createDraftVersion(...a);
export const saveActivity = (...a) => impl.saveActivity(...a);
export const activateVersion = (...a) => impl.activateVersion(...a);
export const getCalendar = (...a) => impl.getCalendar(...a);
export const saveCalendar = (...a) => impl.saveCalendar(...a);
export const listDurationOverrides = (...a) => impl.listDurationOverrides(...a);
export const saveDurationOverride = (...a) => impl.saveDurationOverride(...a);
export const deleteDurationOverride = (...a) => impl.deleteDurationOverride(...a);
export const getSettings = (...a) => impl.getSettings(...a);
export const saveSettings = (...a) => impl.saveSettings(...a);
