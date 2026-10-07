import { formatQty, round, sum } from '../util.js';

/** The source each zone mainly depends on: a locked or demo source shows on the zone's sign. */
const ZONE_SOURCE = {
  office: 'orders', receiving: 'grns', store: 'fabricStock', cutting: 'cutting', staging: 'cutting', trims: 'trimStock',
  sewing: 'sewing', qc: 'topse', finishing: 'finishing', packing: 'packing', fg: 'packing', shipping: 'shipments',
};

const metric = (zone, s) => {
  const active = s.sewing.lines.filter((l) => l.active);
  switch (zone) {
    case 'office': return `${formatQty(s.orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION').length)} open orders`;
    case 'receiving': return `${s.grns.filter((g) => g.date === s.today).length} GRNs today`;
    case 'store': return `${formatQty(sum(s.fabricStock, (l) => l.rolls))} rolls · ${s.fabricStock.length} lots`;
    case 'cutting': return `${formatQty(s.cutting.output)} pcs cut today`;
    case 'staging': return `${formatQty(s.cutting.bundled)} bundles ready`;
    case 'trims': return `${s.trimStock.length} trim lots`;
    case 'sewing': return `${formatQty(sum(active, (l) => l.output))} pcs today · ${active.length} lines running`;
    case 'qc': return s.qc.dhuPct == null ? 'No inspection yet today' : `DHU ${round(s.qc.dhuPct, 1)}% · ${formatQty(s.qc.inspected)} checked`;
    case 'finishing': return `${formatQty(s.finishing.fromSewing.pending)} pcs waiting`;
    case 'packing': return `${formatQty(s.packing.today.pieces)} pcs packed today`;
    case 'fg': return `${formatQty(s.fg.cartons)} cartons waiting`;
    case 'shipping': return `${s.shipping.shipments.filter((x) => x.phase === 'loading').length} trucks loading`;
    default: return '';
  }
};

const busy = (zone, s) => ({
  receiving: s.grns.some((g) => g.date === s.today), cutting: s.cutting.output > 0 || s.cutting.tables.some((t) => t.stage !== 'idle'),
  staging: s.cutting.bundled > 0, sewing: s.sewing.lines.some((l) => l.active), qc: s.qc.inspected > 0,
  finishing: s.finishing.fromSewing.pending > 0, packing: s.packing.open.length > 0 || s.packing.today.pieces > 0,
  fg: s.fg.cartons > 0, shipping: s.shipping.shipments.some((x) => x.phase === 'loading'),
}[zone] ?? true);

/** Each zone's sign: its tone (alert, busy, idle, locked, demo) and one live figure. */
export const zoneStatuses = (snapshot, attention) => {
  const alerts = new Set(attention.filter((a) => a.severity === 'high').map((a) => a.zone));
  return Object.fromEntries(Object.keys(ZONE_SOURCE).map((zone) => {
    const state = snapshot.sources[ZONE_SOURCE[zone]]?.state;
    let tone = busy(zone, snapshot) ? 'busy' : 'idle';
    if (alerts.has(zone)) tone = 'alert';
    if (state === 'locked') tone = 'locked';
    return [zone, {
      tone,
      demo: state === 'demo',
      stale: state === 'error',
      metric: state === 'locked' ? 'No access' : metric(zone, snapshot),
    }];
  }));
};
