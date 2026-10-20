/**
 * Sewing module API surface. Screens import only from here, so the module has a
 * single seam against the backend.
 *
 * The whole module now runs on the real API — the in-memory mock it was
 * designed against is gone.
 */
export {
  getOperators,
  saveOperator,
  getSamValues,
  getStyleSam,
  saveStyleSam,

  getOrders,

  listPlans,
  getPlan,
  savePlan,
  setPlanStatus,
  getSuggestedOperations,

  listCutReceipts,
  listPendingBundleIssues,
  saveCutReceipt,

  listGarmentIssues,
  issuedBySize,
  getIssueOpeningLines,
  saveGarmentIssue,
  recordGarmentIssueReceipt,

  listHourly,
  getHourlySheet,
  saveHourlySheet,
  findHourConflicts,
  setHourlyStatus,

  getBomItems,
  getBomLabelItems,
  listTrimCards,
  saveTrimCard,

  listMeasurements,
  getMeasurement,
  saveMeasurement,
  getMeasurementOpeningPoints,
  getMeasurementChart,
  parseMeasurementChart,
  saveMeasurementChart,

  listTopse,
  getTopse,
  saveTopse,

  listReplacements,
  saveReplacement,
  setReplacementPartStatus,

  getIncentives,
  getFloorDashboard,
} from './sewingApi';
