/**
 * Time & Action plans, revisions and exceptions — /api/v1/tna (CR-TNA-001 Round 2). Every date on a plan
 * comes from the source modules; the only writes here are the three manual milestones, a data-issue
 * report, resolving one, acknowledging an infeasible commitment and a re-sync from sources.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/tna';
const get = async (url, params) => (await axiosInstance.get(`${BASE}${url}`, { params })).data;
const post = async (url, body) => (await axiosInstance.post(`${BASE}${url}`, body)).data;

export const getMeta = () => get('/meta');
// Plans
export const listPlans = () => get('/plans');
export const listPlanOptions = () => get('/plans/options');
export const getPlan = (planId) => get(`/plans/${planId}`);
export const getActivityDetail = (planId, code) => get(`/plans/${planId}/activities/${encodeURIComponent(code)}`);
export const recordMilestone = (planId, code, { date, remarks }) => post(
  `/plans/${planId}/activities/${encodeURIComponent(code)}/completion`, { date, remarks },
);
export const syncPlan = (planId) => post(`/plans/${planId}/sync`);
// Revisions & audit
export const listVersions = (planId) => get(`/plans/${planId}/versions`);
export const compareVersions = (planId, a, b) => get(`/plans/${planId}/versions/compare`, { a, b });
export const getCommitments = (planId) => get(`/plans/${planId}/commitments`);
export const getBaselineComparison = (planId) => get(`/plans/${planId}/baseline-comparison`);
export const getAuditTrail = (planId) => get(`/plans/${planId}/audit`);
// Activities, exceptions, data quality
export const listMyActivities = ({ module } = {}) => get('/my-activities', { module: module || undefined });
export const listExceptions = () => get('/exceptions');
export const getSyncStatus = () => get('/sync-status');
export const getReconciliation = () => get('/reconciliation');
export const reportDataIssue = ({ planId, activityCode, text }) => post('/data-issues', { planId, activityCode, text });
export const resolveException = (id, { note } = {}) => post(`/exceptions/${id}/resolve`, { note });
export const acknowledgeInfeasible = (planId, { reason } = {}) => post(`/plans/${planId}/acknowledge-infeasible`, { reason });
// Analytics
export const getAnalytics = ({ months = 6, buyer = null } = {}) => get('/analytics', { months, buyer: buyer || undefined });
