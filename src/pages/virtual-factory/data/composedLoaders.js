import { hasModuleAccess } from '../../../utils/permissions';
import { fetchEligibleOrders, fetchStockByBom } from '../../../services/virtual-factory/twinOrdersApi';
import { fetchCutPos, fetchCuttingDashboard, fetchLayAudits, fetchMarkerPlans } from '../../../services/virtual-factory/twinCuttingApi';
import { fetchHourlySheet, fetchSewingDashboard, fetchShifts } from '../../../services/virtual-factory/twinSewingApi';
import {
  fetchCuttingPoList, fetchFinishingPos, fetchPackingDaily, fetchPackingEntries, fetchWorkOrders,
} from '../../../services/virtual-factory/twinOutputApi';

/** How many of the nearest-due orders get their material checked each slow refresh. */
const SHORTAGE_ORDERS = 4;

const settled = async (promise) => {
  try {
    return await promise;
  } catch {
    return undefined;
  }
};

/** Material coverage for the orders due soonest: fabric and trims against each order's BOM. */
export const loadShortages = async () => {
  const eligible = (await fetchEligibleOrders()) || [];
  const soonest = eligible.filter((o) => o.bomId)
    .sort((a, b) => String(a.deliveryDate || '9999').localeCompare(String(b.deliveryDate || '9999')))
    .slice(0, SHORTAGE_ORDERS);
  const checks = soonest.flatMap((order) => ['fabric', 'trim'].map((kind) => settled(fetchStockByBom(order, kind)
    .then((rows) => ({ order, kind, rows })))));
  return { shortages: (await Promise.all(checks)).filter(Boolean) };
};

/** The cutting dashboard (required) plus today's lays and the markers placed on tables. */
export const loadCutting = async (ctx) => {
  const [cuttingDashboard, cutPos, markerPlans, layAudits] = await Promise.all([
    fetchCuttingDashboard(), settled(fetchCutPos()), settled(fetchMarkerPlans()), settled(fetchLayAudits(ctx.today)),
  ]);
  return { cuttingDashboard, cutPos: cutPos || [], markerPlans: markerPlans || [], layAudits: layAudits || [] };
};

/** Today's floor dashboard and, for each running plan, its hourly sheet (operators and hourly output). */
export const loadSewingFloor = async (ctx) => {
  const sewingDashboard = await fetchSewingDashboard(ctx.today);
  const planIds = (sewingDashboard?.lines || []).map((l) => l.planId).filter((id) => id != null);
  const hourlySheets = new Map();
  const shiftId = planIds.length ? await ctx.shiftId() : null;
  if (shiftId != null) {
    const sheets = await Promise.all(planIds.map((id) => settled(fetchHourlySheet(id, ctx.today, shiftId))));
    sheets.forEach((sheet, i) => { if (sheet) hourlySheets.set(planIds[i], sheet); });
  }
  return { sewingDashboard, hourlySheets };
};

/** The first active shift, as the sewing hourly screen picks it; null when shifts cannot be read. */
export const firstShiftId = () => settled(fetchShifts()).then((list) => list?.[0]?.id ?? null);

export const loadPacking = async (ctx) => {
  const [packingEntries, packingDaily] = await Promise.all([fetchPackingEntries(ctx.since30), settled(fetchPackingDaily(ctx.today))]);
  return { packingEntries, packingDaily: packingDaily || [] };
};

/** Cutting POs, work orders and finishing POs — each only when the user may read it. */
export const loadProductionOrders = async () => {
  const read = (key, fetcher) => (hasModuleAccess(key) ? settled(fetcher()) : undefined);
  const [cuttingPoList, workOrders, finishingPos] = await Promise.all([
    read('cutting-po', fetchCuttingPoList), read('work-order', fetchWorkOrders), read('finishing-po', fetchFinishingPos),
  ]);
  return { cuttingPoList, workOrders, finishingPos };
};
