/**
 * In-memory Time & Action API (mock phase, CR-TNA-001 Round 1). Every plan is replayed from
 * mock source events at first use; nothing on any T&A screen is typed. The only writes are
 * the ones the CR allows: "Report data issue" (a correction task, never a plan value),
 * resolving an identity exception, acknowledging an infeasible commitment, and governed
 * master data (versioned; a change never rewrites an existing plan — FR-12.2).
 * Function signatures are the contract of the Round 2 endpoints under /api/v1/tna.
 */
import dayjs from 'dayjs';
import { MOCK_AS_OF } from './tnaEnv';
import { cdDiff, wdDiff, addCD } from './tnaCalendar';
import {
  replayOrder, regenerate, makeContext, evaluateOrder, commitments,
} from './tnaReplay';
import {
  seedMasterVersions, seedDurationOverrides, processSteps, seedCalendar, seedSettings,
} from './tnaMockMasters';
import { seedSourceOrders } from './tnaMockSources';
import { buildHistorySources } from './tnaMockHistory';
import {
  buildExceptions, buildSyncStatus, buildReconciliation, buildAnalytics, ownerOf,
} from './tnaMockAnalytics';

const delay = (ms = 120) => new Promise((r) => { setTimeout(r, ms); });
const clone = (v) => JSON.parse(JSON.stringify(v));
const fail = (msg) => { throw new Error(msg); };
const asOf = () => MOCK_AS_OF || dayjs().format('YYYY-MM-DD');
const now = () => `${asOf()} 18:30`;
const isOpen = (x) => x.status === 'OPEN';

let db = null;
const store = () => {
  if (db) return db;
  const masters = seedMasterVersions();
  const calendar = clone(seedCalendar);
  const overrides = clone(seedDurationOverrides);
  const settings = { ...seedSettings };
  const ctx = makeContext({ master: masters.find((v) => v.status === 'ACTIVE'), overrides: clone(overrides), processSteps, calendar: clone(calendar), settings: { ...settings }, asOf: asOf() });
  const live = seedSourceOrders.map((src) => replayOrder(src, ctx));
  const history = buildHistorySources(ctx).map((src) => replayOrder(src, ctx)).filter((st) => st.status === 'CLOSED');
  db = { masters, calendar, overrides, settings, ctx, live, history, dataIssues: [], seq: 1 };
  return db;
};

/** Masters, calendar and settings as of now — used only by plans generated after the change. */
const refreshContext = () => {
  const d = store();
  d.ctx = makeContext({
    master: d.masters.find((v) => v.status === 'ACTIVE'), overrides: clone(d.overrides), processSteps,
    calendar: clone(d.calendar), settings: { ...d.settings }, asOf: asOf(),
  });
};

const allStates = () => [...store().live, ...store().history];
const findState = (id) => allStates().find((st) => st.src.id === Number(id)) || fail('Plan not found');
const evaluate = (st) => evaluateOrder(st, st.ctx);

const healthOf = (st, ev, basis) => {
  if (st.status === 'BLOCKED') return 'BLOCKED';
  if (st.status === 'INFEASIBLE') return 'INFEASIBLE';
  if (st.generation?.feasibility === 'INFEASIBLE' && ev.order.revisedDispatch > ev.order[basis].commitment) return 'INFEASIBLE';
  return ev.order[basis].health;
};

const lineRows = (st, ev) => st.lines.map((l) => ({
  lineId: l.lineId, lineNo: l.lineNo, buyerPoNo: l.buyerPoNo, destination: l.destination, qty: l.qty,
  originalCommitment: l.originalCommitment, latestCommitment: l.latestCommitment, movement: cdDiff(l.originalCommitment, l.latestCommitment),
  actualDispatch: l.actualDispatch, dispatchRef: l.dispatchRef || null,
  actualDelayOriginal: l.actualDispatch ? cdDiff(l.originalCommitment, l.actualDispatch) : null,
  actualDelayLatest: l.actualDispatch ? cdDiff(l.latestCommitment, l.actualDispatch) : null,
  forecastDelayLatest: ev && !l.actualDispatch ? cdDiff(l.latestCommitment, ev.order.forecastDispatch) : null,
}));

const headerOf = (st, ev) => {
  const c = commitments(st);
  const base = {
    id: st.src.id, orderNo: st.src.orderNo, buyer: st.src.buyer, styleNo: st.src.styleNo, productType: st.src.productType,
    garmentType: st.src.garmentType, qty: st.src.qty, merchandiser: st.src.merchandiser, orderDate: st.src.orderDate,
    status: st.status, asOf: asOf(), originalCommitment: c.original, latestCommitment: c.latest, commitmentMovement: cdDiff(c.original, c.latest),
    generation: st.generation, baselineFrozen: st.baselineFrozen, acknowledged: st.acknowledged || null, versionCount: st.versions.length,
    openExceptions: st.exceptions.filter(isOpen).length, provisional: st.activities.some((a) => a.provisional),
    addendum: st.activities.some((a) => a.postBaseline), lines: lineRows(st, ev),
    blockedReasons: st.exceptions.filter((x) => x.severity === 'BLOCK' && isOpen(x)).map((x) => x.detail),
  };
  if (!ev) return base;
  const driving = ev.activities.find((a) => a.code === ev.order.drivingActivity);
  const gate = ev.activities.find((a) => a.code === ev.order.nextGate);
  return {
    ...base, ...ev.order, commitmentMovement: ev.order.commitmentMovement,
    healthLatest: healthOf(st, ev, 'latest'), healthOriginal: healthOf(st, ev, 'original'),
    driving: driving ? { code: driving.code, name: driving.name, overdueDays: driving.overdueDays, status: driving.status, sourceModule: driving.sourceModule } : null,
    nextGateActivity: gate ? { code: gate.code, name: gate.name, revisedTarget: gate.revisedTarget } : null,
  };
};

const decorate = (a) => ({
  ...a,
  awaitingSource: a.sourceStatus === 'MISSING' && !a.actualDate,
  ownerRole: ownerOf(a.sourceModule),
  sourceRecord: a.evidence?.sourceRecord || a.sampleRef || a.requirementRef || null,
});

const isLate = (a) => (a.actualDate ? a.targetAtCompletion && a.actualDate > a.targetAtCompletion : a.overdueDays > 0);
const attributionOf = (a) => {
  if (!isLate(a) && !(a.baselineVariance > 0)) return null;
  const ev = a.attributionEvidence;
  return {
    category: ev ? (a.attributionOverride || a.attribution) : 'REASON_UNAVAILABLE',
    derivedFrom: ev?.derivedFrom || (ev ? ev.text : null),
    evidenceRecord: ev?.record || null,
    reasonText: ev ? `${ev.text} — taken from the source, not entered here` : 'Reason unavailable — no evidence record exists',
  };
};

const rowOf = (st) => {
  const ev = evaluate(st);
  const h = headerOf(st, ev);
  return {
    id: h.id, orderNo: h.orderNo, buyer: h.buyer, styleNo: h.styleNo, productType: h.productType, merchandiser: h.merchandiser,
    orderDate: h.orderDate, status: h.status, originalCommitment: h.originalCommitment, latestCommitment: h.latestCommitment,
    commitmentMovement: h.commitmentMovement, forecastDispatch: ev ? ev.order.forecastDispatch : null,
    delayOriginal: ev ? ev.order.original.forecastDelay : null, delayLatest: ev ? ev.order.latest.forecastDelay : null,
    progress: ev ? ev.order.progress : null, nextGate: h.nextGateActivity || null,
    openCriticalLatest: ev ? ev.order.latest.openCritical : null, openCriticalOriginal: ev ? ev.order.original.openCritical : null,
    healthLatest: ev ? h.healthLatest : 'BLOCKED', healthOriginal: ev ? h.healthOriginal : 'BLOCKED',
    dispatchFloatLatest: ev ? ev.order.latest.dispatchFloat : null, dispatchFloatOriginal: ev ? ev.order.original.dispatchFloat : null,
    driving: h.driving || null, blockedReason: h.blockedReasons[0] || null, shortfallDays: st.generation?.shortfallDays || 0,
    openOverdue: ev ? ev.activities.filter((a) => !a.actualDate && a.overdueDays > 0).length : 0,
  };
};

// ── Plans ────────────────────────────────────────────────────────────────────
export const getMeta = async () => { await delay(20); return { asOf: asOf(), now: now(), mock: true }; };

export const listPlans = async () => {
  await delay();
  const d = store();
  const live = d.live.filter((st) => !['CLOSED', 'CANCELLED'].includes(st.status));
  const rows = live.map(rowOf);
  const exceptions = buildExceptions(d.live, null, d.dataIssues).filter(isOpen);
  const planned = rows.filter((r) => r.status !== 'BLOCKED');
  return clone({
    asOf: asOf(),
    rows,
    kpis: {
      livePlanned: planned.length,
      forecastBeyond: planned.filter((r) => r.status === 'ACTIVE' && r.delayLatest > 0).length,
      openOverdue: rows.reduce((s, r) => s + r.openOverdue, 0),
      infeasible: rows.filter((r) => r.healthLatest === 'INFEASIBLE').length,
      dataQuality: exceptions.length,
      autoGeneratedPct: planned.length ? 100 : 0,
      blocked: rows.length - planned.length,
    },
  });
};

export const listPlanOptions = async () => {
  await delay(40);
  return allStates().map((st) => ({ id: st.src.id, orderNo: st.src.orderNo, buyer: st.src.buyer, styleNo: st.src.styleNo, productType: st.src.productType, status: st.status }));
};

export const getPlan = async (planId) => {
  await delay();
  const st = findState(planId);
  const ev = evaluate(st);
  return clone({
    header: headerOf(st, ev),
    activities: ev ? ev.activities.map(decorate) : [],
    removed: st.removed.map((a) => ({ code: a.code, name: a.name, removedOn: a.removedOn })),
    exceptions: st.exceptions,
    heldEvents: st.eventLog.filter((e) => e.status === 'HELD'),
  });
};

export const getActivityDetail = async (planId, code) => {
  await delay(60);
  const st = findState(planId);
  const ev = evaluate(st) || fail('This order has no generated plan');
  const a = ev.activities.find((x) => x.code === code) || fail(`Activity ${code} is not on this plan`);
  const v = a.completionVersion ? st.versions[a.completionVersion - 1] : null;
  return clone({
    activity: decorate(a),
    attribution: attributionOf(a),
    impact: v ? {
      versionNo: v.versionNo, createdAt: v.createdAt, activitiesMoved: v.activitiesMoved, total: st.activities.length,
      projectedBefore: v.projectedBefore, projectedAfter: v.projectedAfter, netImpact: v.deltaDispatch,
    } : null,
    audit: [
      ...st.audit.filter((r) => r.activityCode === code),
      ...(a.baselineDate ? [{ id: 0, at: st.generation?.generatedAt, field: 'Baseline', oldValue: null, newValue: a.baselineDate, changeType: 'SYSTEM_DERIVED', actor: 'system', reason: a.postBaseline ? `Baseline addendum — ${a.addendumReason}` : 'Plan activation' }] : []),
    ].sort((x, y) => ((x.at || '') < (y.at || '') ? 1 : -1)),
  });
};

// ── Revisions & audit ────────────────────────────────────────────────────────
export const listVersions = async (planId) => {
  await delay();
  const st = findState(planId);
  return clone(st.versions.map(({ snapshot, ...v }) => v));
};

export const compareVersions = async (planId, a, b) => {
  await delay(60);
  const st = findState(planId);
  const va = st.versions[a - 1]?.snapshot || fail(`Version ${a} not found`);
  const vb = st.versions[b - 1]?.snapshot || fail(`Version ${b} not found`);
  const names = Object.fromEntries([...st.activities, ...st.removed].map((x) => [x.code, x.name]));
  return [...new Set([...Object.keys(va), ...Object.keys(vb)])].map((code) => ({
    code, name: names[code] || code, a: va[code]?.rt || null, b: vb[code]?.rt || null,
    delta: va[code] && vb[code] ? wdDiff(st.ctx.cal, va[code].rt, vb[code].rt) : null,
  }));
};

export const getCommitments = async (planId) => {
  await delay(60);
  const st = findState(planId);
  return clone({ register: st.commitments, lines: lineRows(st, evaluate(st)) });
};

export const getBaselineComparison = async (planId) => {
  await delay(60);
  const st = findState(planId);
  const ev = evaluate(st);
  if (!ev) return { rows: [], netImpactProjected: null, netImpactForecast: null };
  const rows = ev.activities
    .filter((a) => a.baselineDate && (a.actualDate || a.revisedTarget) !== a.baselineDate)
    .map((a) => {
      const current = a.actualDate || a.revisedTarget;
      return {
        code: a.code, name: a.name, baseline: a.baselineDate, current, isActual: !!a.actualDate,
        delta: wdDiff(st.ctx.cal, a.baselineDate, current), attributedTo: attributionOf(a)?.category || null, postBaseline: !!a.postBaseline,
      };
    });
  return clone({
    rows,
    baselineDispatch: ev.order.baselineDispatch,
    netImpactProjected: cdDiff(ev.order.baselineDispatch, ev.order.revisedDispatch),
    netImpactForecast: cdDiff(ev.order.baselineDispatch, ev.order.forecastDispatch),
  });
};

export const getAuditTrail = async (planId) => {
  await delay(60);
  return clone([...findState(planId).audit].reverse());
};

// ── My activities (ownership follows the source module — FR-6.5) ────────────
export const listMyActivities = async ({ module } = {}) => {
  await delay();
  const rank = (a) => (a.overdueDays > 0 ? 0 : a.status === 'DUE_SOON' ? 1 : a.isCritical ? 2 : 3);
  return clone(store().live.filter((st) => st.status === 'ACTIVE').flatMap((st) => {
    const ev = evaluate(st);
    return ev.activities.filter((a) => !a.actualDate && (!module || a.sourceModule === module)).map((a) => ({
      ...decorate(a), planId: st.src.id, orderNo: st.src.orderNo, buyer: st.src.buyer, styleNo: st.src.styleNo,
    }));
  }).sort((x, y) => rank(x) - rank(y) || y.overdueDays - x.overdueDays || (x.revisedTarget < y.revisedTarget ? -1 : 1)));
};

// ── Exceptions, sync, reconciliation ─────────────────────────────────────────
export const listExceptions = async () => {
  await delay();
  const d = store();
  const rows = buildExceptions(d.live, null, d.dataIssues);
  const log = d.live.flatMap((st) => st.eventLog);
  return clone({
    rows,
    kpis: {
      blocking: rows.filter((x) => x.severity === 'BLOCK' && isOpen(x)).length,
      warnings: rows.filter((x) => x.severity === 'WARN' && isOpen(x)).length,
      failedEvents: log.filter((e) => e.status === 'FAILED').length,
      eventsProcessed7d: log.filter((e) => e.at > `${addCD(asOf(), -7)} 18:30` && e.at <= now()).length,
      duplicatesSuppressed: d.live.reduce((s, st) => s + st.duplicates, 0),
      lastReconciliation: `${asOf()} 06:12`,
    },
  });
};

export const getSyncStatus = async () => { await delay(60); return clone(buildSyncStatus(store().live, now())); };

export const getReconciliation = async () => {
  await delay(60);
  return clone({ lastRunAt: `${asOf()} 06:12`, checks: buildReconciliation(store().live) });
};

/** FR-6.4 — a correction task against the source record; nothing is written into the plan. */
export const reportDataIssue = async ({ planId, activityCode, text, by }) => {
  await delay();
  const d = store();
  const st = findState(planId);
  const a = st.activities.find((x) => x.code === activityCode);
  const issue = {
    id: `DI-${d.seq++}`, severity: 'WARN', type: 'DATA_ISSUE_REPORTED', orderId: st.src.id, orderNo: st.src.orderNo, buyer: st.src.buyer,
    detail: a ? `${a.code} ${a.name}: ${text}` : text, sourceRecord: (a && (a.evidence?.sourceRecord || a.sampleRef || a.requirementRef)) || st.src.orderNo,
    systemBehaviour: 'Correction task raised against the source record; no value written into the plan',
    ownerRole: a ? ownerOf(a.sourceModule) : 'Merchandising', raisedOn: now(), raisedBy: by, status: 'OPEN',
  };
  d.dataIssues.push(issue);
  return clone(issue);
};

export const resolveException = async (id, { by, note }) => {
  await delay();
  const d = store();
  const issue = d.dataIssues.find((x) => x.id === id);
  if (issue) { Object.assign(issue, { status: 'RESOLVED', resolvedOn: now(), resolvedBy: by, note }); return clone(issue); }
  const st = d.live.find((s) => s.exceptions.some((x) => x.id === id)) || fail('Only identity and reported data issues are resolved here');
  const ex = st.exceptions.find((x) => x.id === id);
  if (ex.type === 'IDENTITY_UNRESOLVED') {
    regenerate(st, d.ctx, now(), by);
    return clone({ ...ex, regenerated: st.status });
  }
  if (ex.type === 'MISSING_MANDATORY_INPUT') fail('Create and release the BOM in the BOM module — the plan generates as soon as it exists');
  Object.assign(ex, { status: 'RESOLVED', resolvedOn: now(), resolvedBy: by, note });
  return clone(ex);
};

/** D-06 — the Merchandising Manager acknowledges; the plan activates, still reported infeasible. */
export const acknowledgeInfeasible = async (planId, { by, reason }) => {
  await delay();
  const st = findState(planId);
  if (st.status !== 'INFEASIBLE') fail('Only an infeasible, not-yet-activated plan can be acknowledged');
  Object.assign(st, { status: 'ACTIVE', baselineFrozen: true, acknowledged: { by, reason, at: now() } });
  st.exceptions.filter((x) => x.type === 'INFEASIBLE_COMMITMENT').forEach((x) => Object.assign(x, { status: 'ACKNOWLEDGED', acknowledgedBy: by, acknowledgedOn: now(), note: reason }));
  const last = st.versions[st.versions.length - 1];
  st.versions.push({ ...last, versionNo: st.versions.length + 1, createdAt: now(), triggerEvent: 'infeasible.acknowledged', sourceModule: 'Time & Action', sourceRecord: st.src.orderNo, approvedInSourceBy: by, changeType: 'ACKNOWLEDGEMENT', activitiesMoved: 0, activitiesCreated: 0, projectedBefore: last.projectedAfter, deltaDispatch: 0, reason: `Infeasible commitment acknowledged: ${reason}`, attribution: null, triggerActivity: null });
  return clone(headerOf(st, evaluate(st)));
};

// ── Analytics ────────────────────────────────────────────────────────────────
export const getAnalytics = async ({ months = 6, buyer = null } = {}) => {
  await delay(160);
  const d = store();
  const closed = [...d.history, ...d.live.filter((st) => st.status === 'CLOSED')].map((st) => ({ st, eval: evaluate(st) }));
  const liveEvaluated = d.live.filter((st) => st.activities.length).map((st) => ({ st, eval: evaluate(st) }));
  return clone({
    asOf: asOf(),
    buyers: [...new Set(closed.map((x) => x.st.src.buyer))].sort(),
    ...buildAnalytics({ closed, liveEvaluated, from: months ? dayjs(asOf()).subtract(months, 'month').format('YYYY-MM-DD') : '0000-00-00', buyer }),
  });
};

// ── Masters (versioned; FR-12.1/12.2) ────────────────────────────────────────
export const listMasterVersions = async () => {
  await delay(60);
  return clone(store().masters.map(({ activities, ...v }) => ({
    ...v, activityCount: activities.length, plansUsing: allStates().filter((st) => st.generation?.masterVersion === v.versionNo).length,
  })));
};

export const getMasterVersion = async (id) => {
  await delay(60);
  return clone(store().masters.find((v) => v.id === Number(id)) || fail('Master version not found'));
};

export const createDraftVersion = async () => {
  await delay();
  const d = store();
  const draft = d.masters.find((v) => v.status === 'DRAFT');
  if (draft) return clone(draft);
  const active = d.masters.find((v) => v.status === 'ACTIVE');
  const next = Math.max(...d.masters.map((v) => v.versionNo)) + 1;
  const v = { id: next, versionNo: next, status: 'DRAFT', effectiveFrom: addCD(asOf(), 30), approvedBy: null, approvedOn: null, activities: clone(active.activities) };
  d.masters.push(v);
  return clone(v);
};

const EDITABLE = ['duration', 'dayType', 'threshold', 'isGate', 'attribution'];
export const saveActivity = async (versionId, activity) => {
  await delay();
  const v = store().masters.find((x) => x.id === Number(versionId)) || fail('Master version not found');
  if (v.status !== 'DRAFT') fail('Only a draft master version can be edited; create a draft first');
  const target = v.activities.find((a) => a.code === activity.code) || fail(`Activity ${activity.code} not in this version`);
  EDITABLE.forEach((k) => { if (activity[k] !== undefined) target[k] = activity[k]; });
  return clone(target);
};

export const activateVersion = async (versionId, { effectiveFrom, by }) => {
  await delay();
  const d = store();
  const v = d.masters.find((x) => x.id === Number(versionId)) || fail('Master version not found');
  if (v.status !== 'DRAFT') fail('Only a draft version can be approved');
  d.masters.filter((x) => x.status === 'ACTIVE').forEach((x) => { x.status = 'RETIRED'; });
  Object.assign(v, { status: 'ACTIVE', effectiveFrom, approvedBy: by, approvedOn: asOf() });
  refreshContext(); // plans generated from now on use it; existing plans keep their version
  return clone(v);
};

export const getCalendar = async () => { await delay(40); return clone(store().calendar); };
export const saveCalendar = async (calendar) => {
  await delay();
  Object.assign(store().calendar, clone(calendar));
  refreshContext();
  return clone(store().calendar);
};

export const listDurationOverrides = async () => { await delay(40); return clone(store().overrides); };
export const saveDurationOverride = async (o) => {
  await delay();
  const list = store().overrides;
  if (o.id) Object.assign(list.find((x) => x.id === o.id) || fail('Override not found'), o);
  else list.push({ ...o, id: Math.max(0, ...list.map((x) => x.id)) + 1 });
  refreshContext();
  return clone(list);
};
export const deleteDurationOverride = async (id) => {
  await delay();
  const list = store().overrides;
  list.splice(list.findIndex((x) => x.id === id), 1);
  refreshContext();
  return clone(list);
};

export const getSettings = async () => { await delay(40); return clone(store().settings); };
export const saveSettings = async (s) => { await delay(); Object.assign(store().settings, s); refreshContext(); return clone(store().settings); };
