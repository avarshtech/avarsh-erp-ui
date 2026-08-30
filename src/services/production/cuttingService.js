/**
 * Cutting module API surface. Screens import only from here, so a feature moves
 * off the mock by re-pointing its exports at cuttingApi — no screen changes.
 *
 * Migration state: Fabric In and Marker Plan run on the real backend;
 * everything below is still mock-backed until its stage lands.
 */
import { USE_MOCK_CUTTING_DATA } from './cuttingEnv';
import * as mockApi from './cuttingMockApi';
import * as api from './cuttingApi';

const notReady = () => { throw new Error('Cutting backend not implemented yet — mock phase'); };
const impl = USE_MOCK_CUTTING_DATA ? mockApi : new Proxy({}, { get: () => notReady });

/* ── Live on the backend ─────────────────────────────────────────────────── */
export const getCutPos = (...a) => api.getCutPos(...a);
export const getRolls = (...a) => api.getRolls(...a);
export const getPendingRolls = (...a) => api.getPendingRolls(...a);
export const relaxedCutPos = (...a) => api.relaxedCutPos(...a);

export const listReceipts = (...a) => api.listReceipts(...a);
export const createReceipt = (...a) => api.createReceipt(...a);
export const updateReceipt = (...a) => api.updateReceipt(...a);

export const listRelaxations = (...a) => api.listRelaxations(...a);
export const saveRelaxation = (...a) => api.saveRelaxation(...a);
export const generateRelaxationReport = (...a) => api.generateRelaxationReport(...a);

// CR-CUT-2026-001 — Marker Plan is the single planning screen (COP removed).
export const listMarkerPlans = (...a) => api.listMarkerPlans(...a);
export const getMarkerPlan = (...a) => api.getMarkerPlan(...a);
export const saveMarkerPlan = (...a) => api.saveMarkerPlan(...a);
export const deleteMarkerPlan = (...a) => api.deleteMarkerPlan(...a);
export const listMarkersForPo = (...a) => api.listMarkersForPo(...a);
export const setSizeSetStatus = (...a) => api.setSizeSetStatus(...a);

export const nextLayNo = (...a) => api.nextLayNo(...a);

export const listLayAudits = (...a) => api.listLayAudits(...a);
export const getLayAudit = (...a) => api.getLayAudit(...a);
export const saveLayAudit = (...a) => api.saveLayAudit(...a);

export const listTmbChecks = (...a) => api.listTmbChecks(...a);
export const getTmbCheck = (...a) => api.getTmbCheck(...a);
export const saveTmbCheck = (...a) => api.saveTmbCheck(...a);

export const getCuttingReport = (...a) => api.getCuttingReport(...a);
export const addReportLay = (...a) => api.addReportLay(...a);
export const deleteReportLay = (...a) => api.deleteReportLay(...a);

export const listBundlings = (...a) => api.listBundlings(...a);
export const listBundles = (...a) => api.listBundles(...a);
export const previewBundling = (...a) => api.previewBundling(...a);
export const generateBundles = (...a) => api.generateBundles(...a);
export const listBundleIssues = (...a) => api.listBundleIssues(...a);
export const issueBundles = (...a) => api.issueBundles(...a);

/* ── Still mock-backed ───────────────────────────────────────────────────── */

export const listPanelIssues = (...a) => impl.listPanelIssues(...a);
export const savePanelIssue = (...a) => impl.savePanelIssue(...a);
export const listPanelChecks = (...a) => impl.listPanelChecks(...a);
export const savePanelCheck = (...a) => impl.savePanelCheck(...a);
export const listProcessReturns = (...a) => impl.listProcessReturns(...a);
export const saveProcessReturn = (...a) => impl.saveProcessReturn(...a);

export const listReCutEntries = (...a) => impl.listReCutEntries(...a);
export const addReCutEntry = (...a) => impl.addReCutEntry(...a);

export const getReconciliation = (...a) => impl.getReconciliation(...a);
export const saveEndBit = (...a) => impl.saveEndBit(...a);
export const returnToInventory = (...a) => impl.returnToInventory(...a);

export const getDashboard = (...a) => impl.getDashboard(...a);
