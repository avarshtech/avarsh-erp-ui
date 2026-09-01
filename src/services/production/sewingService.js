/**
 * Sewing module API surface. Screens import only from here, so a feature moves
 * off the mock by re-pointing its exports at sewingApi — no screen changes.
 *
 * Migration state: operators and the SAM library run on the real backend;
 * everything below is still mock-backed until its stage lands.
 */
import * as mockApi from './sewingMockApi';
import * as api from './sewingApi';

/* ── Live on the backend ─────────────────────────────────────────────────── */
export const getOperators = (...a) => api.getOperators(...a);
export const saveOperator = (...a) => api.saveOperator(...a);
export const getSamValues = (...a) => api.getSamValues(...a);
export const getStyleSam = (...a) => api.getStyleSam(...a);
export const saveStyleSam = (...a) => api.saveStyleSam(...a);

export const getOrders = (...a) => api.getOrders(...a);

export const listPlans = (...a) => api.listPlans(...a);
export const getPlan = (...a) => api.getPlan(...a);
export const savePlan = (...a) => api.savePlan(...a);
export const setPlanStatus = (...a) => api.setPlanStatus(...a);
export const getSuggestedOperations = (...a) => api.getSuggestedOperations(...a);

export const listCutReceipts = (...a) => api.listCutReceipts(...a);
export const listPendingBundleIssues = (...a) => api.listPendingBundleIssues(...a);
export const saveCutReceipt = (...a) => api.saveCutReceipt(...a);

export const listGarmentIssues = (...a) => api.listGarmentIssues(...a);
export const issuedBySize = (...a) => api.issuedBySize(...a);
export const getIssueOpeningLines = (...a) => api.getIssueOpeningLines(...a);
export const saveGarmentIssue = (...a) => api.saveGarmentIssue(...a);

/* ── Still mock-backed ───────────────────────────────────────────────────── */

export const listHourly = (...a) => mockApi.listHourly(...a);
export const getHourlySheet = (...a) => mockApi.getHourlySheet(...a);
export const saveHourlySheet = (...a) => mockApi.saveHourlySheet(...a);
export const findHourConflicts = (...a) => mockApi.findHourConflicts(...a);
export const rowTotal = mockApi.rowTotal;
export const efficiencyPct = mockApi.efficiencyPct;
export const targetPerHour = mockApi.targetPerHour;

export const getBomItems = (...a) => mockApi.getBomItems(...a);
export const listTrimCards = (...a) => mockApi.listTrimCards(...a);
export const saveTrimCard = (...a) => mockApi.saveTrimCard(...a);
export const fullMeasurementChart = mockApi.fullMeasurementChart;

export const listMeasurements = (...a) => mockApi.listMeasurements(...a);
export const getMeasurement = (...a) => mockApi.getMeasurement(...a);
export const saveMeasurement = (...a) => mockApi.saveMeasurement(...a);
export const specPoints = mockApi.specPoints;

export const listTopse = (...a) => mockApi.listTopse(...a);
export const getTopse = (...a) => mockApi.getTopse(...a);
export const saveTopse = (...a) => mockApi.saveTopse(...a);

export const listReplacements = (...a) => mockApi.listReplacements(...a);
export const saveReplacement = (...a) => mockApi.saveReplacement(...a);

export const getIncentives = (...a) => mockApi.getIncentives(...a);
export const getFloorDashboard = (...a) => mockApi.getFloorDashboard(...a);
