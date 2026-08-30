/**
 * Sewing module API surface. Mock-only during the design phase; signatures
 * mirror the future real endpoints (/api/v1/sewing/… per PRD 8.2) so
 * integration swaps the delegate without touching screens.
 */
import * as mockApi from './sewingMockApi';

export const USE_MOCK_SEWING_DATA = true;

export const getOrders = (...a) => mockApi.getOrders(...a);
export const getOperators = (...a) => mockApi.getOperators(...a);
export const saveOperator = (...a) => mockApi.saveOperator(...a);
export const getSamValues = (...a) => mockApi.getSamValues(...a);

export const listPlans = (...a) => mockApi.listPlans(...a);
export const getPlan = (...a) => mockApi.getPlan(...a);
export const savePlan = (...a) => mockApi.savePlan(...a);
export const setPlanStatus = (...a) => mockApi.setPlanStatus(...a);

export const listCutReceipts = (...a) => mockApi.listCutReceipts(...a);
export const saveCutReceipt = (...a) => mockApi.saveCutReceipt(...a);

export const listGarmentIssues = (...a) => mockApi.listGarmentIssues(...a);
export const issuedBySize = (...a) => mockApi.issuedBySize(...a);
export const saveGarmentIssue = (...a) => mockApi.saveGarmentIssue(...a);

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

// Cross-module: the cut-parts receipt traces back to a real bundle issue from
// Cutting, which now runs on the backend even though Sewing itself does not.
export { listBundleIssues as listCuttingBundleIssues, listBundles as listCuttingBundles } from './cuttingApi';
