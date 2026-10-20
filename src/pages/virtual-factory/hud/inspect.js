import { ZONES } from '../engine/layout';
import { formatQty, round } from '../engine/util';
import { MACHINE_STATUS } from './tokens';

const pct = (v) => (v == null ? '—' : `${round(v, 1)}%`);
const SOURCE_STATE = { ok: 'Live from the ERP', demo: 'Demo data (module not live yet)', locked: 'No access', error: 'Not updated (last good data)' };
const qty = (v, unit = 'pcs') => (v == null ? '—' : `${formatQty(v)} ${unit}`.trim());

const station = (id, snapshot, model) => {
  const [lineId, index] = String(id).split(':');
  const line = model.sewingLines.find((l) => String(l.id) === lineId);
  const st = line?.stations[Number(index)];
  if (!st) return null;
  return {
    kind: 'Sewing machine', title: `${line.name}, station ${st.seq || Number(index) + 1}`, subtitle: st.operation,
    tags: [{ ...MACHINE_STATUS[st.status] }, ...(st.bottleneck ? [{ color: 'error', label: 'Bottleneck operation' }] : [])],
    rows: [
      ['Machine', st.machine || '—'],
      ['Operator', st.operator ? `${st.operator.name}${st.operator.code ? ` (${st.operator.code})` : ''}${st.operator.more ? ` +${st.operator.more}` : ''}` : 'No operator recorded'],
      ['Output today', qty(st.output)], ['Last hour', qty(st.lastHourOutput)],
      ['Efficiency', pct(st.efficiencyPct)], ['Target an hour', qty(st.targetPerHour || null)], ['SAM', st.sam ? `${st.sam} min` : '—'],
      ['Style', line.style || '—'],
    ],
    note: st.output == null
      ? 'This line has no hourly sheet today, so the lamp follows the line’s own output and the station has no figures.'
      : 'Status follows the line’s hourly production sheet. The ERP has no breakdown or maintenance log yet.',
    order: line.orderNo || null,
  };
};

const line = (id, snapshot, model, insights) => {
  const l = model.sewingLines.find((x) => String(x.id) === String(id));
  if (!l) return null;
  const b = insights?.bottlenecks.get(l.id);
  return {
    kind: 'Sewing line', title: l.name, subtitle: l.active ? `${l.style} for ${l.buyer || l.orderNo}` : 'No plan running',
    tags: [...(b ? [{ color: 'error', label: 'Bottleneck' }] : []), ...(l.traffic ? [{ color: { GREEN: 'success', YELLOW: 'warning', RED: 'error' }[l.traffic], label: `Board ${l.traffic.toLowerCase()}` }] : [])],
    rows: [
      ['Order', l.orderNo || '—'], ['Operators', l.active ? `${l.operatorsPresent} of ${l.operatorsPlanned} present` : '—'],
      ['Target today', qty(l.targetPerDay || null)], ['Sewn today', qty(l.output)], ['Efficiency', pct(l.efficiencyPct)],
      ['DHU', pct(l.qc?.dhuPct ?? l.dhuPct)], ['Waiting', qty(l.wip || null)], ['Next orders', l.queuedOrders?.join(', ') || '—'],
      ...(b ? [['Why', b.reasons.join(', ')], ['Expected delay', b.delayDays == null ? '—' : `${b.delayDays} days`], ['Orders affected', String(b.ordersAffected)]] : []),
    ],
    order: l.orderNo || null,
  };
};

const table = (id, snapshot, model) => {
  const t = model.cuttingTables.find((x) => String(x.id) === String(id));
  if (!t) return null;
  return {
    kind: 'Cutting table', title: t.name, subtitle: t.style ? `${t.style}${t.colour ? `, ${t.colour}` : ''}` : 'Free',
    tags: [{ color: t.stage === 'idle' ? 'default' : 'processing', label: t.stage[0].toUpperCase() + t.stage.slice(1) }],
    rows: [['Cutting PO', t.cutPoNo || '—'], ['Order', t.orderNo || '—'], ['Marker', t.markerNo || '—'], ['Plies', t.realPlies ? String(t.realPlies) : '—'], ['Lay length', t.realLength ? `${t.realLength} m` : '—'], ['Cut today (room)', qty(snapshot.cutting.output)]],
    note: t.illustrative ? `${t.reason?.note || 'No cutting tables are set up'}, so a typical table is shown.` : null,
    order: t.orderNo || null,
  };
};

const lot = (id, snapshot) => {
  const l = snapshot.fabricStock.find((x) => x.key === id);
  return l && {
    kind: 'Fabric in store', title: l.item, subtitle: l.colour,
    rows: [['Quantity', qty(l.qty, l.uom)], ['Rolls', String(l.rolls)], ['Shade lots', l.shadeLots.join(', ') || '—'], ['Supplier', l.supplier || '—'], ['GRN', `${l.grnNo || '—'}${l.grnDate ? ` (${l.grnDate})` : ''}`], ['For order', l.orderRef || 'Free stock']],
  };
};

const documents = {
  grn: (id, s) => { const g = s.grns.find((x) => x.no === id); return g && { kind: 'Goods received', title: g.no, subtitle: g.supplier, rows: [['PO', g.poNo || '—'], ['Type', g.type], ['Date', g.date || '—'], ['Truck', g.vehicle || '—'], ['Transporter', g.transporter || '—'], ['Status', g.status.replaceAll('_', ' ')]] }; },
  po: (id, s) => { const p = s.purchaseOrders.find((x) => x.no === id); return p && { kind: 'Purchase order', title: p.no, subtitle: p.supplier, rows: [['Material', p.material || '—'], ['Quantity', p.qty ? qty(p.qty, p.uom) : '—'], ['Status', p.status.replaceAll('_', ' ')], ['PO date', p.poDate || '—'], ['Delivery due', p.due || '—'], ['For orders', p.orderRefs.map((r) => r.orderNo).join(', ') || 'General stock']] }; },
  shipment: (id, s) => { const x = s.shipping.shipments.find((y) => y.no === id); return x && { kind: 'Export shipment', title: x.no, subtitle: x.buyer, tags: s.shipping.demo ? [{ color: 'warning', label: 'Demo data' }] : [], rows: [['Mode', x.mode || '—'], ['To', x.destination || '—'], ['ETD', x.etd || '—'], ['ETA', x.eta || '—'], ['Containers', String(x.containers)]] }; },
  production: (id, s) => { const x = s.productionOrders.find((y) => y.no === id); return x && { kind: 'Production order', title: x.no, subtitle: `${x.orderNo}${x.style ? `, ${x.style}` : ''}`, rows: [['Buyer', x.buyer || '—'], ['Planned', qty(x.plannedQty || x.orderQty)], ['Status', x.status.replaceAll('_', ' ').toLowerCase()], ['Made at', x.inHouse ? x.unit || 'In-house' : x.vendor || 'Outside vendor'], ['Dates', `${x.start || '—'} to ${x.end || '—'}`]], order: x.orderNo }; },
};

const zone = (id, snapshot, model) => {
  const z = ZONES[id];
  const st = model.zones[id];
  return z && {
    kind: 'Area', title: z.label, subtitle: st?.metric,
    tags: [st?.demo && { color: 'warning', label: 'Demo data' }, st?.tone === 'locked' && { label: 'No access' }, st?.stale && { color: 'error', label: 'Not updated' }, st?.tone === 'alert' && { color: 'error', label: 'Needs attention' }].filter(Boolean),
    rows: [['Now', st?.metric || '—'], ['Data', SOURCE_STATE[st?.tone === 'locked' ? 'locked' : st?.demo ? 'demo' : st?.stale ? 'error' : 'ok']]],
    note: 'People are drawn where work is happening. Head-counts are recorded only on sewing lines (operators present).',
  };
};

/** What the inspector says about a clicked thing: a heading, tags, rows and a note. */
export const describe = (select, snapshot, model, insights) => {
  if (!select || !snapshot || !model) return null;
  const { type, id } = select;
  if (type === 'station') return station(id, snapshot, model);
  if (type === 'line') return line(id, snapshot, model, insights);
  if (type === 'cuttingTable') return table(id, snapshot, model);
  if (type === 'lot') return lot(id, snapshot);
  if (type === 'zone') return zone(id, snapshot, model);
  return documents[type]?.(id, snapshot) || null;
};
