import { adaptOrders } from './adapters/orders.js';
import { adaptGrns, adaptPurchaseOrders, adaptQcList } from './adapters/purchase.js';
import { adaptFabricStock, adaptIssues, adaptShortages, adaptTrimStock } from './adapters/stock.js';
import { adaptCutPos, adaptCutting } from './adapters/cutting.js';
import { adaptSewing, sewingQcTotals } from './adapters/sewing.js';
import { adaptFinishing, adaptGarmentIssues, adaptProcessIssues } from './adapters/finishing.js';
import { adaptPacking, finishedGoods } from './adapters/packing.js';
import { adaptShipments } from './adapters/shipping.js';
import { adaptProductionOrders } from './adapters/productionOrders.js';
import { buildOrderProgress } from './orderProgress.js';
import { dayOf, num, text } from './util.js';

const bundlesInTransit = (list) => (list || []).map((issue) => ({
  id: issue.id,
  no: text(issue.issueNo),
  orderNo: text(issue.orderNo),
  style: text(issue.styleNo),
  workOrderNo: text(issue.workOrderNo),
  date: dayOf(issue.issueDate),
  bundles: num(issue.totalBundles),
  pcs: num(issue.totalPcs),
}));

/**
 * The factory as one plain object: every source normalised, plus each order's progress. `raw` holds
 * whatever the sources returned (a missing key means the source was locked, failed or skipped);
 * `clock` is { at, today, hourIndex }.
 */
export const buildSnapshot = (raw, clock, rules, meta = {}) => {
  const orders = adaptOrders(raw.orders);
  const cutPos = adaptCutPos(raw.cutPos);
  const packing = adaptPacking({ entries: raw.packingEntries?.content, dailySummary: raw.packingDaily }, clock.today);
  const garmentIssues = adaptGarmentIssues(raw.garmentIssues);
  const processIssues = adaptProcessIssues(raw.processIssues);
  const sewing = adaptSewing({
    lines: raw.productionLines,
    dashboard: raw.sewingDashboard,
    plans: raw.sewingPlans,
    sheets: raw.hourlySheets,
    topse: raw.topse,
  }, clock);

  const snapshot = {
    at: clock.at,
    today: clock.today,
    hourIndex: clock.hourIndex,
    sources: meta.sources || {},
    orders,
    purchaseOrders: adaptPurchaseOrders(raw.purchaseOrders),
    grns: adaptGrns(raw.grns),
    fabricQc: adaptQcList(raw.fabricQc),
    fabricStock: adaptFabricStock(raw.fabricStock),
    trimStock: adaptTrimStock(raw.trimStock),
    shortages: (raw.shortages || []).flatMap(({ order, kind, rows }) => adaptShortages(order, kind, rows)),
    shortageChecked: new Set((raw.shortages || []).map(({ order }) => order.orderNo)).size,
    issues: adaptIssues(raw.issues),
    cutPos,
    cutting: adaptCutting({
      dashboard: raw.cuttingDashboard,
      cutPos,
      markerPlans: raw.markerPlans,
      layAudits: raw.layAudits,
      tables: raw.cuttingTables,
    }, clock.today),
    bundlesInTransit: bundlesInTransit(raw.pendingBundleIssues),
    sewing,
    qc: sewingQcTotals(sewing),
    garmentIssues,
    processIssues,
    finishing: adaptFinishing({
      dashboard: raw.finishingDashboard,
      garmentIssues,
      processIssues,
      demo: meta.demo?.finishing,
    }),
    packing,
    fg: finishedGoods(packing, orders),
    shipping: adaptShipments(raw.shipments, clock.today, meta.demo?.shipping),
    productionOrders: adaptProductionOrders({
      cuttingPos: raw.cuttingPoList,
      workOrders: raw.workOrders,
      finishingPos: raw.finishingPos,
    }),
  };
  snapshot.progress = buildOrderProgress(snapshot, rules);
  return snapshot;
};
