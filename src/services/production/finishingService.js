/**
 * Finishing module API surface. Every register is on the real API (/api/v1/finishing/…); this
 * module keeps the one import path the screens use.
 */
export const USE_MOCK_FINISHING_DATA = false;

export { rowTotal, aqlSample, dhuPct } from './finishingCalc';

export {
  getEmployees,
  listReceivings, saveReceiving,
  getHourlySheet, saveHourlySheet,
  listSpotWash, saveSpotWash,
  listAlterations, saveAlterationBatch, saveAlteration,
  listMetalDetection, saveMetalDetection, listNeedleLog,
  listShadeGroups, saveShadeGroup,
  getFinishingDashboard,
} from './finishingFloorApi';

// Checking sheets. A sheet with pieces to alter raises its alteration job on the server.
export { listCheckings, getChecking, saveChecking } from './finishingCheckingApi';

// Finishing carries its own measurement chart; the real chart lives in mst_measurement_specs
// and is not wired to Finishing yet.
export { specPoints, fullMeasurementChart } from './finishingMockData';

// Cross-module and real. Orders come from the API rather than the finishing
// seed so a receipt lands on the sewing issue it actually belongs to, and so
// the order picked in Sewing is the same one Finishing opens on.
export {
  getOrders,
  listGarmentIssues,
  recordGarmentIssueReceipt,
  getBomLabelItems,
} from './sewingApi';

// External Process (garments to washing / printing / embroidery and back) is on the real API
export {
  listProcessIssues, createProcessIssue, cancelProcessIssue,
  listProcessReturns, createProcessReturn, getProcessWorkOrders, getProcessVendors, getProcessJobWorkPos,
  listGarmentChecks, getGarmentCheck, saveGarmentCheck,
} from './finishingProcessApi';
