import { makeEvent, STORY_ORDER } from './eventCatalog.js';
import { addDays, dayOf, formatQty, round } from './util.js';

/**
 * Today's story: every transaction the ERP recorded today, told in the order a garment order
 * moves through the factory, so "Replay today" plays it from the first new order to the last truck.
 */
export const buildTodayStory = (snapshot, rules) => {
  const t = snapshot.today;
  const events = [];
  const add = (kind, fields) => events.push(makeEvent(kind, fields));

  snapshot.orders.filter((o) => o.orderDate === t).forEach((o) => add('ORDER_NEW', {
    key: o.no, title: o.no, detail: `${o.buyer} · ${formatQty(o.qty)} pcs · delivery ${o.due || 'not set'}`, ref: { type: 'order', id: o.no }, qty: o.qty,
  }));
  snapshot.purchaseOrders.forEach((po) => {
    const detail = `${po.supplier} · ${po.material}${po.qty ? ` · ${formatQty(po.qty)} ${po.uom}` : ''}`;
    if (po.poDate === t) add('PO_RAISED', { key: po.no, title: po.no, detail, ref: { type: 'po', id: po.no } });
    if (dayOf(po.approvedAt) === t) add('PO_APPROVED', { key: po.no, title: po.no, detail, ref: { type: 'po', id: po.no } });
  });
  snapshot.grns.filter((g) => g.date === t).forEach((g) => add('GRN_CREATED', {
    key: g.no, title: g.no, detail: `${g.supplier} · ${g.type}${g.vehicle ? ` · truck ${g.vehicle}` : ''}`, ref: { type: 'grn', id: g.no },
  }));
  snapshot.fabricQc.filter((q) => q.date === t).forEach((q) => add(/reject/i.test(q.status) ? 'FABRIC_QC_FAILED' : 'FABRIC_QC_PASSED', {
    key: q.no, title: q.grnNo, detail: q.fabric, ref: { type: 'zone', id: 'receiving' },
  }));
  snapshot.issues.filter((i) => i.date === t).forEach((i) => add(i.type === 'FABRIC' ? 'MATERIAL_ISSUED' : 'TRIMS_ISSUED', {
    key: i.no, title: i.no, detail: `${i.orderNo || i.style}${i.rolls ? ` · ${i.rolls} rolls` : ''}`, ref: { type: 'order', id: i.orderNo }, colour: i.colour,
  }));
  if (snapshot.cutting.output > 0) add('CUTTING_PROGRESS', { key: `${t}:story`, title: `${formatQty(snapshot.cutting.output)} pieces`, detail: 'Cut today', qty: snapshot.cutting.output });
  snapshot.bundlesInTransit.filter((b) => b.date === t).forEach((b) => add('BUNDLES_ISSUED', {
    key: b.no, title: b.no, detail: `${b.bundles} bundles · ${formatQty(b.pcs)} pcs`, ref: { type: 'order', id: b.orderNo }, qty: b.bundles,
  }));
  snapshot.sewing.lines.filter((l) => l.active && l.output > 0).forEach((l) => add('SEWING_OUTPUT', {
    key: `${l.id}:${t}:story`, title: `${l.name} · ${formatQty(l.output)}`, detail: `${l.style} sewn today`, qty: l.output, lineId: l.id, ref: { type: 'line', id: l.id },
  }));
  snapshot.qc.byLine.forEach((q) => add(q.dhuPct > rules.alerts.highRejectionDhuPct ? 'QC_HIGH_REJECTION' : 'QC_INSPECTED', {
    key: `${q.lineId}:${t}:story`, title: q.style || q.line, detail: `${q.line}: ${formatQty(q.inspected)} inspected, DHU ${round(q.dhuPct, 1)}%`, lineId: q.lineId, ref: { type: 'line', id: q.lineId },
  }));
  snapshot.garmentIssues.filter((g) => g.date === t).forEach((g) => add('TO_FINISHING', {
    key: g.no, title: g.no, detail: `${formatQty(g.qty)} pcs of ${g.orderNo || g.style}`, ref: { type: 'order', id: g.orderNo }, qty: g.qty,
  }));
  snapshot.processIssues.filter((p) => p.date === t).forEach((p) => add('TO_PROCESS', {
    key: p.no, title: p.no, detail: `${formatQty(p.issued)} pcs to ${p.vendor} for ${p.process}`, destination: p.vendor, ref: { type: 'order', id: p.orderNo },
  }));
  [...snapshot.packing.open, ...snapshot.packing.completed].filter((e) => e.date === t).forEach((e) => add(e.status === 'COMPLETED' ? 'PACKING_COMPLETED' : 'PACKING_STARTED', {
    key: e.no, title: e.no, detail: `${e.orderNo} · ${formatQty(e.cartons)} cartons${e.destination ? ` → ${e.destination}` : ''}`,
    ref: { type: 'order', id: e.orderNo }, qty: e.cartons, destination: e.destination, colour: e.colours[0],
  }));
  const demo = snapshot.shipping.demo;
  snapshot.shipping.shipments.forEach((s) => {
    if (s.phase === 'loading') add('DISPATCH_LOADING', { key: s.no, title: s.no, detail: `${s.buyer} → ${s.destination}`, destination: s.destination, ref: { type: 'shipment', id: s.no }, demo });
    if (s.phase === 'departed' && s.etd >= addDays(t, -1)) add('DISPATCH_DEPARTED', { key: s.no, title: `→ ${s.destination}`, detail: s.no, destination: s.destination, ref: { type: 'shipment', id: s.no }, demo });
  });
  snapshot.shortages.slice(0, 3).forEach((s) => add('MATERIAL_SHORTAGE', {
    key: `${s.key}:story`, title: s.style || s.orderNo, detail: `${s.item}: short ${formatQty(s.short)} ${s.uom}`, ref: { type: 'order', id: s.orderNo },
  }));
  if (snapshot.cutting.bundled > 0) {
    add('BUNDLES_CREATED', { key: `${t}:story`, title: `${formatQty(snapshot.cutting.bundled)} bundles`, detail: 'Ready in the cut-part supermarket', qty: snapshot.cutting.bundled });
  }
  [...new Set(snapshot.sewing.lines.filter((l) => l.active && l.orderNo).map((l) => l.orderNo))].slice(0, 3).forEach((no) => add('ORDER_PRODUCTION', {
    key: `${no}:story`, title: no, detail: 'On the sewing lines today', ref: { type: 'order', id: no },
  }));
  snapshot.sewing.lines.filter((l) => l.traffic === 'RED').forEach((l) => add('LINE_DELAY', {
    key: `${l.id}:story`, title: l.name, detail: `${l.style} · efficiency ${round(l.efficiencyPct ?? 0)}%`, lineId: l.id, ref: { type: 'line', id: l.id },
  }));

  const rank = (e) => STORY_ORDER.indexOf(e.kind);
  return events.sort((a, b) => rank(a) - rank(b));
};
