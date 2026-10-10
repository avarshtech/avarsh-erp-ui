/**
 * Read models computed from replayed plans (mock phase): exceptions console, sync status,
 * reconciliation (WF-08) and delay analytics (WF-07). Attribution is a share of net order
 * impact — the sum of each version's change in projected dispatch through the network —
 * never a sum of activity variances (FR-7.7, FR-11.6). "Reason unavailable" is its own
 * category (FR-7.9) and commitment movement is reported apart from delay (FR-7.6).
 */
import { cdDiff, wdDiff, maxDate } from './tnaCalendar';

const OWNER_BY_MODULE = {
  'Order Entry': 'Merchandising', Orders: 'Merchandising', BOM: 'Merchandising', Purchase: 'Purchase', Sampling: 'Sampling',
  Stores: 'Stores', QC: 'Quality', Cutting: 'Production — Cutting', 'Cut Panel': 'Production Planning', Sewing: 'Production — Sewing',
  'Garment Process': 'Production Planning', Finishing: 'Production — Finishing', Packing: 'Production — Packing', Production: 'Production Planning',
};
export const ownerOf = (module) => OWNER_BY_MODULE[module] || 'Merchandising';

export const SYNC_MODULES = ['Order Entry', 'BOM', 'Purchase', 'Sampling', 'Stores', 'QC', 'Cutting', 'Cut Panel', 'Sewing', 'Garment Process', 'Packing', 'Orders'];
const STALE_AFTER_DAYS = 7;

/** Exceptions console rows: per-order exceptions plus portfolio-wide source gaps. */
export const buildExceptions = (live, evaluated, extra) => {
  const rows = live.flatMap((st) => st.exceptions.map((x) => ({ ...x, buyer: st.src.buyer })));
  const missing = {};
  live.filter((st) => st.activities.length).forEach((st) => st.activities
    .filter((a) => a.sourceStatus === 'MISSING' && !a.actualDate)
    .forEach((a) => { (missing[a.code] = missing[a.code] || { act: a, orders: [] }).orders.push(st.src.orderNo); }));
  Object.values(missing).forEach(({ act, orders }) => rows.push({
    id: `SRC-${act.code}`, severity: 'WARN', type: 'AWAITING_SOURCE', orderNo: `${orders.length} live orders`, orderId: null,
    detail: `${act.code} ${act.name} has no source event: ${act.missingNote}`, sourceRecord: '—', status: 'OPEN',
    systemBehaviour: 'Shown as "Awaiting source enhancement"; excluded from on-time performance; manual entry not reinstated',
    ownerRole: 'IT / Programme', raisedOn: null, orders,
  }));
  live.filter((st) => st.src.reconciliation).forEach((st) => rows.push({
    id: `REC-${st.src.id}`, severity: 'WARN', type: 'RECONCILIATION_MISMATCH', orderId: st.src.id, orderNo: st.src.orderNo,
    detail: st.src.reconciliation.detail, sourceRecord: st.src.orderNo, status: 'OPEN', ownerRole: 'Data steward',
    systemBehaviour: 'Exception raised; value not auto-corrected — T&A is not the system of record', raisedOn: null,
  }));
  return [...rows, ...extra];
};

const lagLabel = (fromAt, toAt) => {
  const mins = Math.max(0, Math.round((Date.parse(toAt.replace(' ', 'T')) - Date.parse(fromAt.replace(' ', 'T'))) / 60000));
  if (mins < 60) return `${mins} m`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
};

/** Synchronisation status per source module (FR-12.4). */
export const buildSyncStatus = (states, now) => SYNC_MODULES.map((module) => {
  const log = states.flatMap((st) => st.eventLog).filter((e) => e.module === module && e.at <= now);
  if (!log.length) return { module, lastEvent: null, lag: '—', queued: 0, failed: 0, state: 'IDLE' };
  const last = log.reduce((m, e) => (e.at > m ? e.at : m), log[0].at);
  const days = cdDiff(last.slice(0, 10), now.slice(0, 10));
  return {
    module, lastEvent: last, lag: lagLabel(last, now), queued: log.filter((e) => e.status === 'HELD').length,
    failed: log.filter((e) => e.status === 'FAILED').length, state: days > STALE_AFTER_DAYS ? 'STALE' : 'HEALTHY',
  };
});

/** Scheduled reconciliation of T&A against each source of record (FR-9.6). */
export const buildReconciliation = (live) => {
  const planned = live.filter((st) => st.activities.length);
  const mismatch = (check) => live.filter((st) => st.src.reconciliation?.check === check).length;
  return [
    { check: 'Dispatch commitment', compared: planned.reduce((s, st) => s + st.lines.length, 0), mismatched: mismatch('DISPATCH_COMMITMENT') },
    { check: 'Actual completion dates', compared: planned.reduce((s, st) => s + st.activities.filter((a) => a.actualDate).length, 0), mismatched: 0 },
    { check: 'Activity set vs requirements', compared: planned.length, mismatched: mismatch('ACTIVITY_SET') },
    { check: 'Order-line linkage', compared: live.reduce((s, st) => s + st.lines.length, 0), mismatched: mismatch('ORDER_LINE_LINKAGE') },
  ];
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);

const EVIDENCE_SOURCE = {
  BUYER: 'Sample request approval dates', SUPPLIER: 'PO promise revisions / GRN dates', SUBCONTRACTOR: 'Accepted-receipt dates',
  INTERNAL_PRE_PRODUCTION: 'Sampling, pattern, marker, PP-meeting records', INTERNAL_PRODUCTION: 'Output postings',
  QUALITY: 'Inspection results', SCOPE_ADDENDUM: 'Post-baseline requirement changes', REASON_UNAVAILABLE: 'No evidence record',
};

/** WF-07 delay analytics over closed orders dispatched in the period, plus live exposure. */
export const buildAnalytics = ({ closed, liveEvaluated, from, buyer }) => {
  const scope = closed.filter((x) => x.eval.order.actualDispatch >= from && (!buyer || x.st.src.buyer === buyer));
  const n = scope.length;
  const impacts = {};
  scope.forEach(({ st }) => st.versions.filter((v) => v.deltaDispatch > 0).forEach((v) => {
    const cat = v.attribution || 'REASON_UNAVAILABLE';
    const e = (impacts[cat] = impacts[cat] || { total: 0, orders: new Set() });
    e.total += v.deltaDispatch;
    e.orders.add(st.src.id);
  }));
  const totalImpact = Object.values(impacts).reduce((s, e) => s + e.total, 0);
  const attribution = Object.entries(impacts)
    .map(([category, e]) => ({ category, evidenceSource: EVIDENCE_SOURCE[category], orders: e.orders.size, meanImpact: mean([e.total / e.orders.size]), share: pct(e.total, totalImpact) }))
    .sort((x, y) => y.share - x.share);

  const byBuyer = {};
  scope.forEach(({ st, eval: ev }) => {
    const b = (byBuyer[st.src.buyer] = byBuyer[st.src.buyer] || { buyer: st.src.buyer, revised: 0, movements: [], lateOriginal: 0, lateLatest: 0 });
    if (ev.order.commitmentMovement) { b.revised += 1; b.movements.push(ev.order.commitmentMovement); }
    if (ev.order.original.actualDelay > 0) b.lateOriginal += 1;
    if (ev.order.latest.actualDelay > 0) b.lateLatest += 1;
  });

  const exposure = liveEvaluated
    .filter((x) => x.st.status === 'ACTIVE')
    .map(({ st, eval: ev }) => ({ planId: st.src.id, orderNo: st.src.orderNo, float: ev.order.latest.dispatchFloat, driving: ev.activities.find((a) => a.code === ev.order.drivingActivity) }))
    .sort((x, y) => x.float - y.float)
    .slice(0, 6)
    .map((x) => ({ ...x, drivingCode: x.driving?.code, drivingName: x.driving?.name, ownerModule: x.driving?.sourceModule }));

  const durations = {};
  scope.forEach(({ st }) => {
    const byCode = Object.fromEntries(st.activities.map((a) => [a.code, a]));
    st.activities.filter((a) => a.actualDate && a.predecessors.length && a.predecessors.every((p) => byCode[p]?.actualDate)).forEach((a) => {
      const start = maxDate(a.predecessors.map((p) => byCode[p].actualDate));
      const took = a.dayType === 'CD' ? cdDiff(start, a.actualDate) : wdDiff(st.ctx.cal, start, a.actualDate);
      // A process step's code is its position on that order; group steps by process instead.
      const isStep = !!a.scope;
      const key = isStep ? `${a.sourceModule}:${a.name}` : a.masterCode;
      const d = (durations[key] = durations[key] || {
        code: isStep ? a.sourceModule : a.masterCode, name: a.name.replace(/ — cycle \d+$/, ''), master: a.duration, dayType: a.dayType, samples: [],
      });
      d.samples.push(took);
    });
  });
  const masterBias = Object.values(durations)
    .filter((d) => d.samples.length >= 5)
    .map((d) => ({ ...d, actualMean: mean(d.samples), bias: Math.round((mean(d.samples) - d.master) * 10) / 10, sample: d.samples.length }))
    .sort((x, y) => Math.abs(y.bias) - Math.abs(x.bias))
    .slice(0, 8);

  return {
    kpis: {
      orders: n,
      lateVsOriginalPct: pct(scope.filter((x) => x.eval.order.original.actualDelay > 0).length, n),
      onTimeVsLatestPct: pct(scope.filter((x) => x.eval.order.latest.actualDelay <= 0).length, n),
      ordersWithRevisions: scope.filter((x) => x.eval.order.commitmentMovement !== 0).length,
      meanExecutionDelay: mean(scope.map((x) => Math.max(0, x.eval.order.original.actualDelay))),
      reasonUnavailablePct: pct(impacts.REASON_UNAVAILABLE?.total || 0, totalImpact),
    },
    attribution,
    commitmentByBuyer: Object.values(byBuyer).map((b) => ({ ...b, meanMovement: mean(b.movements), movements: undefined })),
    exposure,
    masterBias,
  };
};
