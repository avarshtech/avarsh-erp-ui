/**
 * Jobs, KPIs, the job drawer, short-close, finishing scope and stage shares.
 * Mirrors the planned GET/POST /api/v1/job-work/jobs* endpoints (mock-only for now).
 */
import * as mock from './trackerMockJobs';

export const searchJobs = async (filters) => mock.searchJobs(filters);
export const getJobKpis = async (filters) => mock.getJobKpis(filters);
export const getJob = async (id) => mock.getJob(id);
export const closeJob = async (id, body) => mock.closeJob(id, body);
export const getJobVendors = async () => mock.getJobVendors();
export const listFilterOptions = async () => mock.listFilterOptions();
export const updateJobScope = async (id, body) => mock.updateJobScope(id, body);
export const updateStageShares = async (id, body) => mock.updateStageShares(id, body);
export const resetDemoData = async () => mock.resetDemoData();
