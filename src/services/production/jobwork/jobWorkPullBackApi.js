/**
 * Pull-backs: request, manager approval (the approval engine in the real system), returns,
 * settle, cancel and the in-house PO pre-fill. Mirrors /api/v1/job-work/pull-backs* (mock-only).
 */
import * as mock from './trackerMockPullBacks';
import * as returns from './trackerMockPullBackReturns';

export const listPullBacks = async (filters) => mock.listPullBacks(filters);
export const getPullBackForm = async (jobId) => mock.getPullBackForm(jobId);
export const getPullBack = async (id) => mock.getPullBack(id);
export const createPullBack = async (jobId, payload) => mock.createPullBack(jobId, payload);
export const updatePullBack = async (id, payload) => mock.updatePullBack(id, payload);
export const submitPullBack = async (id) => mock.submitPullBack(id);
export const decidePullBack = async (id, body) => mock.decidePullBack(id, body);
export const settlePullBack = async (id, body) => mock.settlePullBack(id, body);
export const cancelPullBack = async (id, body) => mock.cancelPullBack(id, body);
export const saveReturn = async (pullBackId, payload) => returns.saveReturn(pullBackId, payload);
export const cancelReturn = async (returnId, body) => returns.cancelReturn(returnId, body);
export const getPoPrefill = async (pullBackId) => returns.getPoPrefill(pullBackId);
export const createDraftPo = async (pullBackId, body) => returns.createDraftPo(pullBackId, body);
export const removeDraftPo = async (draftId) => returns.removeDraftPo(draftId);
