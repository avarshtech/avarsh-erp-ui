import { isOpenOrder } from './adapters/orders.js';
import { clamp, dayDiff, groupBy, num, sum } from './util.js';

/** The physical journey of an order, in floor order. */
export const STAGES = ['material', 'cutting', 'sewing', 'finishing', 'packing', 'shipping'];

export const STAGE_META = {
  planning: { label: 'Planning', zone: 'office' },
  material: { label: 'Material', zone: 'store' },
  cutting: { label: 'Cutting', zone: 'cutting' },
  sewing: { label: 'Sewing', zone: 'sewing' },
  finishing: { label: 'Finishing', zone: 'finishing' },
  packing: { label: 'Packing', zone: 'packing' },
  shipping: { label: 'Shipping', zone: 'shipping' },
};

/** Share of an order's overall progress each stage stands for. */
const WEIGHTS = { material: 10, cutting: 20, sewing: 35, finishing: 10, packing: 15, shipping: 10 };

/** Days finishing and packing take after the last piece is sewn, in the projection. */
const AFTER_SEWING_DAYS = 2;

const materialState = (pos, shortages, issued) => {
  if (shortages.length) return { state: 'short', pct: 50 };
  if (issued) return { state: 'issued', pct: 100 };
  if (!pos.length) return { state: 'none', pct: 0 };
  const received = pos.filter((p) => p.status === 'Completed').length;
  const partial = pos.filter((p) => p.status === 'Partially_Received').length;
  const pct = ((received + partial * 0.5) / pos.length) * 100;
  if (received === pos.length) return { state: 'received', pct: 100 };
  if (received || partial) return { state: 'partial', pct };
  return { state: pos.some((p) => p.status === 'Sent_To_Supplier') ? 'ordered' : 'raised', pct: 0 };
};

const riskOf = (order, sewn, lines, daysToDue, rules) => {
  const grace = rules.targets.deliveryGraceDays;
  if (order.status === 'COMPLETED') return { risk: 'done', projectedDays: 0 };
  // A draft, referred-back or cancelled order is not in work, so it is neither on track nor late.
  if (!isOpenOrder(order)) return { risk: 'inactive', projectedDays: null };
  if (daysToDue == null) return { risk: 'unknown', projectedDays: null };
  if (daysToDue < -grace) return { risk: 'late', projectedDays: null };
  const rate = sum(lines, (l) => l.targetPerDay || l.output);
  const remaining = Math.max(0, order.qty - sewn);
  const projectedDays = rate > 0 ? remaining / rate + AFTER_SEWING_DAYS : null;
  if (order.delayDays > grace) return { risk: 'at-risk', projectedDays };
  if (projectedDays != null && projectedDays > daysToDue + grace) return { risk: 'at-risk', projectedDays };
  if (projectedDays == null && remaining > 0 && daysToDue <= 7) return { risk: 'at-risk', projectedDays };
  return { risk: 'on-track', projectedDays };
};

/** Every open or recent order's stage quantities, current stage, overall progress and risk. */
export const buildOrderProgress = (snapshot, rules) => {
  const posByOrder = groupBy(snapshot.purchaseOrders.flatMap((po) => po.orderRefs.map((ref) => ({ ref, po }))), (x) => x.ref.orderNo);
  const shortByOrder = groupBy(snapshot.shortages, (s) => s.orderNo);
  const issuedOrders = new Set(snapshot.issues.filter((i) => i.type === 'FABRIC').map((i) => i.orderNo));
  const cutByOrder = groupBy(snapshot.cutting.progress, (p) => p.orderNo);
  const giByOrder = groupBy(snapshot.garmentIssues, (g) => g.orderNo);
  const linesByOrder = groupBy(snapshot.sewing.lines.filter((l) => l.active), (l) => l.orderNo);

  const map = new Map();
  snapshot.orders.forEach((order) => {
    const pos = (posByOrder.get(order.no) || []).map((x) => x.po);
    const shortages = shortByOrder.get(order.no) || [];
    const lines = linesByOrder.get(order.no) || [];
    const gi = giByOrder.get(order.no) || [];
    const material = materialState(pos, shortages, issuedOrders.has(order.no));
    const qty = {
      cutting: sum(cutByOrder.get(order.no), (p) => p.cut),
      sewing: Math.max(sum(gi, (g) => g.qty), sum(lines, (l) => l.completed)),
      finishing: sum(gi, (g) => g.received),
      packing: num(snapshot.packing.byOrder.get(order.no)),
      shipping: order.status === 'COMPLETED' ? order.qty : 0,
    };
    const stagePct = (key) => (key === 'material' ? material.pct : clamp((qty[key] / Math.max(1, order.qty)) * 100, 0, 100));
    const stages = STAGES.map((key) => ({ key, qty: key === 'material' ? null : qty[key], pct: stagePct(key) }));
    const reached = [...stages].reverse().find((s) => (s.key === 'material' ? material.state !== 'none' : s.qty > 0));
    const current = reached ? reached.key : 'planning';
    const daysToDue = dayDiff(snapshot.today, order.due);
    map.set(order.no, {
      orderNo: order.no,
      stages,
      material: material.state,
      current,
      currentQty: current === 'planning' || current === 'material' ? 0 : qty[current],
      currentPct: current === 'planning' ? 0 : stagePct(current),
      overallPct: sum(stages, (s) => (WEIGHTS[s.key] * s.pct) / 100),
      daysToDue,
      lines: lines.map((l) => l.name),
      pos: pos.map((p) => p.no),
      shortages,
      ...riskOf(order, qty.sewing, lines, daysToDue, rules),
    });
  });
  return map;
};
