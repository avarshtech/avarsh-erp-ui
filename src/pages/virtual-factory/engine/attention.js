import { actualDailyRate, behindPct } from './pace.js';
import { dayDiff, formatQty, groupBy, round } from './util.js';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** A sewing line is a bottleneck when it falls behind pace, runs below the efficiency floor, or piles up WIP. */
export const findBottlenecks = (snapshot, rules, clock) => {
  const a = rules.alerts;
  const map = new Map();
  snapshot.sewing.lines.filter((l) => l.active).forEach((line) => {
    const behind = behindPct(line, clock.elapsedHours);
    const lowEff = line.efficiencyPct != null && clock.elapsedHours >= 1 && line.efficiencyPct < a.bottleneckEfficiencyPct;
    const red = line.traffic === 'RED';
    const piled = line.wip > a.bottleneckWipPcs;
    const farBehind = behind > a.bottleneckBehindPct;
    if (!(farBehind || lowEff || red || piled)) return;
    const order = snapshot.orders.find((o) => o.no === line.orderNo);
    const remaining = Math.max(0, (line.planQty || order?.qty || 0) - line.completed);
    const actual = actualDailyRate(line, clock.elapsedHours, rules);
    const delayDays = actual > 0 && line.targetPerDay > 0 ? Math.max(0, remaining / actual - remaining / line.targetPerDay) : null;
    map.set(line.id, {
      lineId: line.id,
      line: line.name,
      behindPct: round(behind),
      efficiencyPct: line.efficiencyPct,
      wip: line.wip,
      delayDays: delayDays == null ? null : round(delayDays, 1),
      ordersAffected: 1 + line.queuedOrders.length,
      operation: line.stations.find((s) => s.bottleneck)?.operation || null,
      severity: red || lowEff || farBehind ? 'high' : 'medium',
      reasons: [
        behind > a.behindPlanPct && `${round(behind)}% behind target pace`,
        lowEff && `efficiency ${round(line.efficiencyPct)}%`,
        piled && `${formatQty(line.wip)} pieces waiting`,
        red && 'line board red',
      ].filter(Boolean),
    });
  });
  return map;
};

const lineItems = (snapshot, bottlenecks) => [...bottlenecks.values()].map((b) => ({
  id: `bottleneck-${b.lineId}`,
  kind: 'bottleneck',
  severity: b.severity,
  title: `Bottleneck on ${b.line}`,
  detail: `${b.reasons.join(', ')}${b.delayDays ? ` · about ${b.delayDays} days of delay` : ''} · ${b.ordersAffected} order${b.ordersAffected === 1 ? '' : 's'} affected`,
  zone: 'sewing',
  target: { type: 'line', id: b.lineId },
}));

/** Lines behind their target pace but not (yet) a bottleneck: worth a look, no beacon. */
const behindItems = (snapshot, rules, clock, bottlenecks) => snapshot.sewing.lines
  .filter((l) => l.active && !bottlenecks.has(l.id) && behindPct(l, clock.elapsedHours) > rules.alerts.behindPlanPct)
  .map((l) => ({
    id: `behind-${l.id}`,
    kind: 'behind',
    severity: 'medium',
    title: `Behind plan · ${l.name}`,
    detail: `${round(behindPct(l, clock.elapsedHours))}% behind target pace on ${l.style || l.orderNo}`,
    zone: 'sewing',
    target: { type: 'line', id: l.id },
  }));

const shortageItems = (snapshot, rules) => [...groupBy(snapshot.shortages, (s) => s.orderNo).entries()].map(([orderNo, rows]) => {
  const daysToDue = dayDiff(snapshot.today, rows[0].due);
  const worst = [...rows].sort((x, y) => y.short - x.short)[0];
  return {
    id: `shortage-${orderNo}`,
    kind: 'shortage',
    severity: daysToDue != null && daysToDue <= rules.targets.dueSoonDays ? 'high' : 'medium',
    title: `Material shortage · ${worst.style || orderNo}`,
    detail: `${worst.item}: required ${formatQty(worst.required)} ${worst.uom}, available ${formatQty(worst.available)}, short ${formatQty(worst.short)}${rows.length > 1 ? ` (+${rows.length - 1} more)` : ''}`,
    zone: 'store',
    target: { type: 'order', id: orderNo },
  };
});

const orderItems = (snapshot) => snapshot.orders.flatMap((order) => {
  const p = snapshot.progress.get(order.no);
  if (!p || (p.risk !== 'late' && p.risk !== 'at-risk')) return [];
  const why = p.risk === 'late' ? `due ${order.due}, now ${-p.daysToDue} days past`
    : order.delayDays > 0 ? `the ERP has moved its dispatch by ${order.delayDays} days (${order.delaySource || 'upstream delay'})`
      : `at the current pace it needs about ${round(p.projectedDays ?? 0, 1)} days; ${p.daysToDue} left`;
  return [{
    id: `order-${order.no}`,
    kind: 'delay',
    severity: p.risk === 'late' ? 'high' : 'medium',
    title: `${p.risk === 'late' ? 'Late' : 'At risk'} · ${order.no}`,
    detail: `${order.buyer} · ${formatQty(order.qty)} pcs · ${why}`,
    zone: 'office',
    target: { type: 'order', id: order.no },
  }];
});

const rejectionItems = (snapshot, rules) => snapshot.qc.byLine
  .filter((q) => q.inspected > 0 && q.dhuPct > rules.alerts.highRejectionDhuPct)
  .map((q) => ({
    id: `rejection-${q.lineId}`,
    kind: 'rejection',
    severity: 'high',
    title: `High rejection · ${q.style || q.line}`,
    detail: `${q.line}: DHU ${round(q.dhuPct, 1)}% on ${formatQty(q.inspected)} inspected (limit ${rules.alerts.highRejectionDhuPct}%)`,
    zone: 'qc',
    target: { type: 'line', id: q.lineId },
  }));

const supplierItems = (snapshot, rules) => snapshot.purchaseOrders
  .filter((po) => (po.status === 'Sent_To_Supplier' || po.status === 'Partially_Received') && po.due && dayDiff(snapshot.today, po.due) < 0)
  .map((po) => ({
    id: `po-${po.no}`,
    kind: 'supplier',
    severity: po.orderRefs.some((r) => {
      const o = snapshot.orders.find((x) => x.no === r.orderNo);
      return o?.due && dayDiff(snapshot.today, o.due) <= rules.targets.dueSoonDays;
    }) ? 'high' : 'medium',
    title: `Supplier late · ${po.no}`,
    detail: `${po.supplier}: ${po.material || 'material'} was due ${po.due} (${-dayDiff(snapshot.today, po.due)} days ago)`,
    zone: 'receiving',
    target: { type: 'po', id: po.no },
  }));

const fabricItems = (snapshot, rules) => [
  ...snapshot.cutting.relaxing.filter((r) => r.remainingHours > rules.alerts.relaxationWarnHours).map((r) => ({
    id: `relax-${r.no}`, kind: 'relaxation', severity: 'low',
    title: `Fabric relaxing · ${r.cutPoNo}`,
    detail: `${r.fabricType || 'Fabric'} ready in ${round(r.remainingHours, 1)} h (needs ${r.minHours} h)`,
    zone: 'cutting', target: { type: 'zone', id: 'cutting' },
  })),
  ...snapshot.fabricQc.filter((q) => q.date === snapshot.today && /reject|fail/i.test(`${q.status} ${q.result}`)).map((q) => ({
    id: `fqc-${q.no}`, kind: 'fabric-qc', severity: 'high',
    title: `Fabric failed inspection · ${q.grnNo}`,
    detail: `${q.fabric || 'Fabric'}: ${q.rollsFailed} of ${q.rolls} rolls failed (${q.no})`,
    zone: 'receiving', target: { type: 'zone', id: 'receiving' },
  })),
];

/** Everything that needs a manager's attention, most severe first. */
export const buildAttention = (snapshot, rules, bottlenecks, clock) => [
  ...lineItems(snapshot, bottlenecks),
  ...(clock ? behindItems(snapshot, rules, clock, bottlenecks) : []),
  ...rejectionItems(snapshot, rules),
  ...shortageItems(snapshot, rules),
  ...orderItems(snapshot),
  ...supplierItems(snapshot, rules),
  ...fabricItems(snapshot, rules),
].sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);

/** How many items need action now (low ones are information). */
export const attentionCount = (items) => items.filter((i) => i.severity !== 'low').length;
