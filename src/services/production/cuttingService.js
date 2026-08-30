/**
 * Cutting module API surface. Screens import only from here, so a feature moves
 * off the mock by re-pointing its exports at cuttingApi — no screen changes.
 *
 * Migration state: Fabric In (receipts, relaxation, Cut PO / roll lookups) runs
 * on the real backend; everything below is still mock-backed until its stage
 * lands.
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

/* ── Still mock-backed ───────────────────────────────────────────────────── */

// CR-CUT-2026-001 — Marker Plan is the single planning screen (COP removed).
export const listMarkerPlans = (...a) => impl.listMarkerPlans(...a);
export const getMarkerPlan = (...a) => impl.getMarkerPlan(...a);
export const saveMarkerPlan = (...a) => impl.saveMarkerPlan(...a);
export const listMarkersForPo = (...a) => impl.listMarkersForPo(...a);
export const nextLayNo = (...a) => impl.nextLayNo(...a);
export const setSizeSetStatus = (...a) => impl.setSizeSetStatus(...a);
export const allowanceQty = mockApi.allowanceQty;
export const sizeJumps = mockApi.sizeJumps;

export const listLayAudits = (...a) => impl.listLayAudits(...a);
export const getLayAudit = (...a) => impl.getLayAudit(...a);
export const saveLayAudit = (...a) => impl.saveLayAudit(...a);

export const listTmbChecks = (...a) => impl.listTmbChecks(...a);
export const getTmbCheck = (...a) => impl.getTmbCheck(...a);
export const saveTmbCheck = (...a) => impl.saveTmbCheck(...a);

export const getCuttingReport = (...a) => impl.getCuttingReport(...a);
export const addReportLay = (...a) => impl.addReportLay(...a);

export const listBundlings = (...a) => impl.listBundlings(...a);
export const listBundles = (...a) => impl.listBundles(...a);
export const generateBundles = (...a) => impl.generateBundles(...a);
export const listBundleIssues = (...a) => impl.listBundleIssues(...a);
export const issueBundles = (...a) => impl.issueBundles(...a);

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
