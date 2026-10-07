import { getFinishingDashboard, USE_MOCK_FINISHING_DATA } from '../../../services/production/finishingService';
import { searchShipments } from '../../../services/expdoc/expDocService';
import { USE_MOCK_EXPDOC_DATA } from '../../../services/expdoc/expDocEnv';
import { fetchOrders, fetchPurchaseOrders } from '../../../services/virtual-factory/twinOrdersApi';
import { fetchFabricQc, fetchFabricStock, fetchGrns, fetchIssues, fetchTrimStock } from '../../../services/virtual-factory/twinInventoryApi';
import { fetchCuttingTables } from '../../../services/virtual-factory/twinCuttingApi';
import {
  fetchGarmentIssues, fetchPendingBundleIssues, fetchProductionLines, fetchSewingPlans, fetchTopse,
} from '../../../services/virtual-factory/twinSewingApi';
import { fetchProcessIssues } from '../../../services/virtual-factory/twinOutputApi';
import { loadCutting, loadPacking, loadProductionOrders, loadSewingFloor, loadShortages } from './composedLoaders';

export const TIER_MS = { fast: 45_000, slow: 300_000 };

const one = (key, fetcher) => async (ctx) => ({ [key]: await fetcher(ctx) });

/**
 * Every ERP source the factory reads: the screen permission it needs, how often it refreshes, the
 * raw keys it fills, and whether it is a demo store (a module still running on mock data).
 */
export const SOURCES = [
  { id: 'orders', label: 'Customer orders', perm: 'orders', tier: 'fast', keys: ['orders'], load: one('orders', fetchOrders) },
  { id: 'purchaseOrders', label: 'Supplier POs', perm: 'purchase-orders', tier: 'fast', keys: ['purchaseOrders'], load: one('purchaseOrders', fetchPurchaseOrders) },
  { id: 'grns', label: 'Receiving (GRN)', perm: 'inventory', tier: 'fast', keys: ['grns'], load: one('grns', (c) => fetchGrns(c.since14)) },
  { id: 'fabricQc', label: 'Fabric inspection', perm: 'inventory-qc', tier: 'slow', keys: ['fabricQc'], load: one('fabricQc', (c) => fetchFabricQc(c.since14)) },
  { id: 'fabricStock', label: 'Fabric stock', perm: 'inventory-stock', tier: 'slow', keys: ['fabricStock'], load: one('fabricStock', fetchFabricStock) },
  { id: 'trimStock', label: 'Trims stock', perm: 'inventory-stock', tier: 'slow', keys: ['trimStock'], load: one('trimStock', fetchTrimStock) },
  { id: 'shortages', label: 'Material coverage', perm: ['cutting-po', 'work-order', 'finishing-po'], tier: 'slow', keys: ['shortages'], load: loadShortages },
  { id: 'issues', label: 'Material issues', perm: 'inventory-issue', tier: 'fast', keys: ['issues'], load: one('issues', (c) => fetchIssues(c.since7)) },
  { id: 'cutting', label: 'Cutting room', perm: 'production-cutting', tier: 'fast', keys: ['cuttingDashboard', 'cutPos', 'markerPlans', 'layAudits'], load: loadCutting },
  { id: 'cuttingTables', label: 'Cutting tables', perm: 'production-masters', tier: 'slow', keys: ['cuttingTables'], load: one('cuttingTables', fetchCuttingTables) },
  { id: 'productionLines', label: 'Production lines', perm: 'production-masters', tier: 'slow', keys: ['productionLines'], load: one('productionLines', fetchProductionLines) },
  { id: 'sewing', label: 'Sewing floor', perm: 'production-sewing', tier: 'fast', keys: ['sewingDashboard', 'hourlySheets'], load: loadSewingFloor },
  { id: 'sewingPlans', label: 'Sewing plans', perm: 'production-sewing', tier: 'slow', keys: ['sewingPlans'], load: one('sewingPlans', fetchSewingPlans) },
  { id: 'topse', label: 'End-line QC', perm: 'production-sewing', tier: 'slow', keys: ['topse'], load: one('topse', fetchTopse) },
  { id: 'bundleIssues', label: 'Bundles in transit', perm: 'production-sewing', tier: 'fast', keys: ['pendingBundleIssues'], load: one('pendingBundleIssues', fetchPendingBundleIssues) },
  { id: 'garmentIssues', label: 'Sewing to finishing', perm: 'production-sewing', tier: 'slow', keys: ['garmentIssues'], load: one('garmentIssues', fetchGarmentIssues) },
  { id: 'processIssues', label: 'External processes', perm: 'production-finishing', tier: 'slow', keys: ['processIssues'], load: one('processIssues', fetchProcessIssues) },
  { id: 'finishing', label: 'Finishing stations', perm: 'production-finishing', tier: 'slow', keys: ['finishingDashboard'], demo: USE_MOCK_FINISHING_DATA, load: one('finishingDashboard', () => getFinishingDashboard()) },
  { id: 'packing', label: 'Packing', perm: 'production-packing', tier: 'fast', keys: ['packingEntries', 'packingDaily'], load: loadPacking },
  { id: 'shipments', label: 'Shipments', perm: 'export-shipments', tier: 'slow', keys: ['shipments'], demo: USE_MOCK_EXPDOC_DATA, load: one('shipments', () => searchShipments({ page: 0, size: 50 })) },
  { id: 'productionOrders', label: 'Production orders', perm: ['cutting-po', 'work-order', 'finishing-po'], tier: 'slow', keys: ['cuttingPoList', 'workOrders', 'finishingPos'], load: loadProductionOrders },
];

export const DEMO = { finishing: USE_MOCK_FINISHING_DATA, shipping: USE_MOCK_EXPDOC_DATA };

// When Finishing or Export Docs move off their mocks, read them through silent clients in
// services/virtual-factory (like the others), or a failure there would raise the global error toast.
// /sewing/garment-issues and /sewing/topse return every row ever written (no date or page filter),
// so they stay on the slow tier; a dated or paged variant of each is a backend follow-up.
