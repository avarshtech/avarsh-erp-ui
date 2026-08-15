/**
 * Cutting module API surface. Mock-only during the design phase; each function
 * keeps the signature the future real endpoints (/api/v1/cutting/…) will take,
 * so integration swaps the delegate without touching screens.
 */
import { USE_MOCK_CUTTING_DATA } from './cuttingEnv';
import * as mockApi from './cuttingMockApi';

const notReady = () => { throw new Error('Cutting backend not implemented yet — mock phase'); };
const impl = USE_MOCK_CUTTING_DATA ? mockApi : new Proxy({}, { get: () => notReady });

export const getCutPos = (...a) => impl.getCutPos(...a);
export const getRolls = (...a) => impl.getRolls(...a);

export const listReceipts = (...a) => impl.listReceipts(...a);
export const createReceipt = (...a) => impl.createReceipt(...a);

export const listRelaxations = (...a) => impl.listRelaxations(...a);
export const saveRelaxation = (...a) => impl.saveRelaxation(...a);
export const generateRelaxationReport = (...a) => impl.generateRelaxationReport(...a);
export const minRelaxHours = (...a) => mockApi.minRelaxHours(...a);

export const listMarkers = (...a) => impl.listMarkers(...a);
export const saveMarker = (...a) => impl.saveMarker(...a);
export const listCops = (...a) => impl.listCops(...a);
export const getCop = (...a) => impl.getCop(...a);
export const saveCop = (...a) => impl.saveCop(...a);
export const setCopStatus = (...a) => impl.setCopStatus(...a);

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

export const getDashboard = (...a) => impl.getDashboard(...a);
