import { makeEvent } from './eventCatalog.js';
import { formatQty, round } from './util.js';

/** Each row of the next list with its previous version (undefined when the row is new). */
const changes = (prevList, nextList, key = 'id') => {
  const prev = new Map((prevList || []).map((x) => [x[key], x]));
  return (nextList || []).map((row) => ({ row, before: prev.get(row[key]) }));
};

const added = (prevList, nextList, key = 'id') => changes(prevList, nextList, key).filter((c) => !c.before).map((c) => c.row);

const orders = (prev, next) => changes(prev.orders, next.orders).flatMap(({ row: o, before }) => {
  const ref = { type: 'order', id: o.no };
  if (!before) return [makeEvent('ORDER_NEW', { key: o.no, title: o.no, detail: `${o.buyer} · ${formatQty(o.qty)} pcs · delivery ${o.due || 'not set'}`, ref, qty: o.qty })];
  if (before.status === o.status) return [];
  if (o.status === 'IN_PRODUCTION') return [makeEvent('ORDER_PRODUCTION', { key: o.no, title: o.no, detail: `${o.style} for ${o.buyer}`, ref })];
  if (o.status === 'COMPLETED') return [makeEvent('ORDER_COMPLETED', { key: o.no, title: o.no, detail: o.destination, ref, destination: o.destination })];
  return [];
});

const purchaseOrders = (prev, next) => changes(prev.purchaseOrders, next.purchaseOrders).flatMap(({ row: po, before }) => {
  const ref = { type: 'po', id: po.no };
  const detail = `${po.supplier} · ${po.material}${po.qty ? ` · ${formatQty(po.qty)} ${po.uom}` : ''}`;
  if (!before) return [makeEvent('PO_RAISED', { key: po.no, title: po.no, detail, ref })];
  if (before.status === po.status) return [];
  if (po.status === 'Sent_To_Supplier') return [makeEvent('PO_APPROVED', { key: po.no, title: po.no, detail, ref })];
  if (po.status === 'Rejected') return [makeEvent('PO_REJECTED', { key: po.no, title: po.no, detail, ref })];
  if (po.status === 'Partially_Received' || po.status === 'Completed') {
    return [makeEvent('MATERIAL_RECEIVED', { key: `${po.no}:${po.status}`, title: po.no, detail, ref })];
  }
  return [];
});

const grns = (prev, next) => added(prev.grns, next.grns).map((g) => makeEvent('GRN_CREATED', {
  key: g.no, title: g.no, detail: `${g.supplier} · ${g.type}${g.vehicle ? ` · truck ${g.vehicle}` : ''}`, ref: { type: 'grn', id: g.no },
}));

const fabricQc = (prev, next) => changes(prev.fabricQc, next.fabricQc)
  .filter((c) => !c.before || c.before.status !== c.row.status)
  .flatMap(({ row: q }) => {
    const ref = { type: 'zone', id: 'receiving' };
    if (/reject/i.test(q.status)) return [makeEvent('FABRIC_QC_FAILED', { key: q.no, title: q.grnNo, detail: `${q.rollsFailed} of ${q.rolls} rolls failed`, ref })];
    if (/approved|pass/i.test(q.status)) return [makeEvent('FABRIC_QC_PASSED', { key: q.no, title: q.grnNo, detail: q.fabric, ref })];
    return [];
  });

const issues = (prev, next) => added(prev.issues, next.issues).map((i) => makeEvent(i.type === 'FABRIC' ? 'MATERIAL_ISSUED' : 'TRIMS_ISSUED', {
  key: i.no, title: i.no, detail: `${i.orderNo || i.style}${i.fabric ? ` · ${i.fabric}` : ''}${i.rolls ? ` · ${i.rolls} rolls` : ''}`,
  ref: { type: 'order', id: i.orderNo }, colour: i.colour,
}));

const shortages = (prev, next) => added(prev.shortages, next.shortages, 'key').map((s) => makeEvent('MATERIAL_SHORTAGE', {
  key: s.key, title: s.style || s.orderNo, detail: `${s.item}: short ${formatQty(s.short)} ${s.uom}`, ref: { type: 'order', id: s.orderNo },
}));

const cutting = (prev, next) => {
  const events = [];
  const cut = next.cutting.output - prev.cutting.output;
  if (cut > 0) events.push(makeEvent('CUTTING_PROGRESS', { key: `${next.today}:${next.cutting.output}`, title: `${formatQty(cut)} pieces`, detail: `${formatQty(next.cutting.output)} cut today`, qty: cut }));
  const bundles = next.cutting.bundled - prev.cutting.bundled;
  if (bundles > 0) events.push(makeEvent('BUNDLES_CREATED', { key: `${next.today}:${next.cutting.bundled}`, title: `${formatQty(bundles)} bundles`, detail: 'Ready in the cut-part supermarket', qty: bundles }));
  return events;
};

const bundleIssues = (prev, next) => added(prev.bundlesInTransit, next.bundlesInTransit).map((b) => makeEvent('BUNDLES_ISSUED', {
  key: b.no, title: b.no, detail: `${b.bundles} bundles · ${formatQty(b.pcs)} pcs for ${b.orderNo || b.style}`, ref: { type: 'order', id: b.orderNo }, qty: b.bundles,
}));

const sewing = (prev, next, rules) => changes(prev.sewing.lines, next.sewing.lines).flatMap(({ row: l, before }) => {
  if (!before) return [];
  const events = [];
  const ref = { type: 'line', id: l.id };
  const sewn = l.output - before.output;
  if (sewn > 0) events.push(makeEvent('SEWING_OUTPUT', { key: `${l.id}:${next.today}:${l.output}`, title: `${l.name} +${formatQty(sewn)}`, detail: `${l.style} · ${formatQty(l.output)} today`, qty: sewn, lineId: l.id, ref }));
  if (l.traffic === 'RED' && before.traffic !== 'RED') events.push(makeEvent('LINE_DELAY', { key: `${l.id}:${next.today}`, title: l.name, detail: `${l.style} · efficiency ${round(l.efficiencyPct ?? 0)}%`, lineId: l.id, ref }));
  const limit = rules.alerts.highRejectionDhuPct;
  if (l.qc && l.qc.dhuPct > limit && !(before.qc && before.qc.dhuPct > limit)) {
    events.push(makeEvent('QC_HIGH_REJECTION', { key: `${l.id}:${next.today}`, title: l.qc.styles[0] || l.style, detail: `${l.name}: DHU ${round(l.qc.dhuPct, 1)}%`, lineId: l.id, ref }));
  }
  if (l.qc && before.qc && l.qc.inspected > before.qc.inspected) {
    events.push(makeEvent('QC_INSPECTED', { key: `${l.id}:${next.today}:${l.qc.inspected}`, title: l.name, detail: `${formatQty(l.qc.inspected - before.qc.inspected)} more inspected`, lineId: l.id, ref }));
  }
  return events;
});

const garmentIssues = (prev, next) => added(prev.garmentIssues, next.garmentIssues).map((g) => makeEvent('TO_FINISHING', {
  key: g.no, title: g.no, detail: `${formatQty(g.qty)} pcs of ${g.orderNo || g.style}`, ref: { type: 'order', id: g.orderNo }, qty: g.qty,
}));

const processIssues = (prev, next) => added(prev.processIssues, next.processIssues).map((p) => makeEvent('TO_PROCESS', {
  key: p.no, title: p.no, detail: `${formatQty(p.issued)} pcs to ${p.vendor} for ${p.process}`, ref: { type: 'order', id: p.orderNo }, destination: p.vendor,
}));

const packing = (prev, next) => changes([...prev.packing.open, ...prev.packing.completed], [...next.packing.open, ...next.packing.completed])
  .flatMap(({ row: e, before }) => {
    const detail = `${e.orderNo} · ${formatQty(e.cartons)} cartons · ${formatQty(e.pieces)} pcs${e.destination ? ` → ${e.destination}` : ''}`;
    const ref = { type: 'order', id: e.orderNo };
    if (e.status === 'COMPLETED' && before?.status !== 'COMPLETED') {
      return [makeEvent('PACKING_COMPLETED', { key: e.no, title: e.no, detail, ref, qty: e.cartons, destination: e.destination, colour: e.colours[0] })];
    }
    return before ? [] : [makeEvent('PACKING_STARTED', { key: e.no, title: e.no, detail, ref })];
  });

const shipments = (prev, next) => changes(prev.shipping.shipments, next.shipping.shipments)
  .filter((c) => c.before && c.before.phase !== c.row.phase)
  .flatMap(({ row: s }) => {
    const ref = { type: 'shipment', id: s.no };
    const demo = next.shipping.demo;
    if (s.phase === 'loading') return [makeEvent('DISPATCH_LOADING', { key: s.no, title: s.no, detail: `${s.buyer} → ${s.destination}`, destination: s.destination, ref, demo })];
    if (s.phase === 'departed') return [makeEvent('DISPATCH_DEPARTED', { key: s.no, title: `→ ${s.destination}`, detail: `${s.no} · ${s.buyer}`, destination: s.destination, ref, demo })];
    return [];
  });

const RISKY = new Set(['at-risk', 'late']);

/** An open order whose risk turned to at-risk or late since the last look. */
const slipping = (prev, next) => next.orders.flatMap((o) => {
  const before = prev.progress.get(o.no)?.risk;
  const now = next.progress.get(o.no)?.risk;
  if (!before || !RISKY.has(now) || RISKY.has(before)) return [];
  return [makeEvent('ORDER_LATE', {
    key: `${o.no}:${now}`, title: o.no, detail: `${o.buyer} · now ${now === 'late' ? 'late' : 'at risk'} for ${o.due || 'its due date'}`,
    ref: { type: 'order', id: o.no },
  })];
});

/** A sewing plan that reached COMPLETED: that line has sewn its share of the order. */
const plansDone = (prev, next) => changes(prev.sewing.plans, next.sewing.plans)
  .filter((c) => c.before && c.before.status !== 'COMPLETED' && c.row.status === 'COMPLETED')
  .map(({ row: p }) => makeEvent('PRODUCTION_COMPLETED', {
    key: p.planNo || p.id, title: p.orderNo || p.planNo, detail: `${p.style} finished on ${p.line}`, ref: { type: 'order', id: p.orderNo },
  }));

/** Each comparison runs only when its own source was read successfully in both snapshots. */
const COMPARISONS = [
  ['orders', orders], ['purchaseOrders', purchaseOrders], ['grns', grns], ['fabricQc', fabricQc],
  ['issues', issues], ['shortages', shortages], ['cutting', cutting], ['bundleIssues', bundleIssues],
  ['sewing', sewing], ['garmentIssues', garmentIssues], ['processIssues', processIssues],
  ['packing', packing], ['shipments', shipments], ['orders', slipping], ['sewingPlans', plansDone],
];

/** Business events between two snapshots of the factory (none on the first load). */
export const diffSnapshots = (prev, next, rules) => {
  if (!prev || !next) return [];
  const readable = (state) => state === 'ok' || state === 'demo';
  const ok = (id) => readable(prev.sources[id]?.state) && prev.sources[id]?.state === next.sources[id]?.state;
  return COMPARISONS.flatMap(([source, compare]) => (ok(source) ? compare(prev, next, rules) : []));
};
