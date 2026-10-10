/**
 * Per-order event replay (mock phase) — the behaviour Round 2's backend reproduces.
 * Source events are processed in business-date order (FR-9.7) and each one either:
 *  - generates the plan (order.confirmed): identity + eligibility, derivation, baseline,
 *    feasibility (§9.2, BR-01/18); a blocked order gets no plan, only an exception;
 *  - completes an activity at its threshold, with the source record as evidence (FR-6.2/6.6);
 *  - revises the network (sample rejection, requirement change, promise or deadline revision);
 *  - revises a commitment — a version with zero activities moved (FR-5.6).
 * Every change that moves a revised target produces exactly one plan version (§10.3) and
 * append-only audit rows (FR-10.1). Duplicate deliveries are suppressed and counted (FR-9.5).
 * Version deltas are measured on the projected (revised-target) dispatch: it moves only on
 * source facts, so the sum of a closed order's deltas is its execution delay (§11.3).
 */
import { cdDiff, makeCalendar } from './tnaCalendar';
import {
  generateBaseline, revisedTargets, forecasts, terminalCode, evaluatePlan, RULE_VERSION,
} from './tnaEngine';
import { deriveActivities, SAMPLE_KEY } from './tnaDerivation';

const MODULE_OF = [
  ['order.', 'Order Entry'], ['identity.', 'Order Entry'], ['bom.', 'BOM'], ['purchase_order.', 'Purchase'], ['po.', 'Purchase'],
  ['sample.', 'Sampling'], ['grn.', 'Stores'], ['inspection.', 'QC'], ['pattern.', 'BOM'], ['marker.', 'Cutting'],
  ['pp_meeting.', 'Production'], ['production.cut', 'Cutting'], ['production.sewing', 'Sewing'], ['production.finishing', 'Finishing'],
  ['production.packing', 'Packing'], ['panel.', 'Cut Panel'], ['cut_panel.', 'Cut Panel'], ['process.', 'Garment Process'],
  ['garment_process.', 'Garment Process'], ['shipment.', 'Orders'], ['source.', 'Source'],
];
export const moduleOfEvent = (name) => (MODULE_OF.find(([p]) => name.startsWith(p)) || [null, 'Other'])[1];

const SIMPLE_TARGET = {
  'bom.version_released': 'A02', 'pattern.released': 'A12', 'marker.released': 'A15', 'pp_meeting.recorded': 'A16',
  'grn.posted': 'A13', 'production.cut_output': 'A17', 'production.sewing_output': 'A20',
  'production.finishing_output': 'A21', 'production.packing_completed': 'A22',
};

const STATE_FIELDS = ['baselineDate', 'actualDate', 'targetAtCompletion', 'evidence', 'attributionEvidence', 'attributionOverride',
  'achievedQty', 'partials', 'progressPct', 'notBefore', 'postBaseline', 'addendumOn', 'addendumReason', 'outcome', 'completionVersion'];

const dateOf = (at) => at.slice(0, 10);
const minOf = (xs) => xs.reduce((m, x) => (x < m ? x : m));

/** Order-level commitments: the first shipment line drives the network (one plan per order). */
export const commitments = (st) => ({
  original: minOf(st.lines.map((l) => l.originalCommitment)),
  latest: minOf(st.lines.map((l) => l.latestCommitment)),
});

export const makeContext = ({ master, overrides, processSteps, calendar, settings, asOf }) => ({
  master, overrides, processSteps, settings, asOf,
  cal: makeCalendar({ weeklyOff: calendar.weeklyOff, holidays: calendar.holidays.map((h) => h.date) }),
});

/** The plan as of ctx.asOf: decorated activities and order measures on both bases. */
export const evaluateOrder = (st, ctx) => {
  if (!st.activities.length) return null;
  const { original, latest } = commitments(st);
  return evaluatePlan({
    cal: ctx.cal, activities: st.activities, orderDate: st.src.orderDate,
    originalCommitment: original, latestCommitment: latest, today: ctx.asOf, settings: ctx.settings,
  });
};

const dates = (st, ctx, today) => ({
  rt: revisedTargets(ctx.cal, st.activities, st.src.orderDate),
  fc: forecasts(ctx.cal, st.activities, st.src.orderDate, today),
});

const audit = (st, row) => st.audit.push({ id: st.audit.length + 1, orderId: st.src.id, ...row });

const raise = (st, ex) => st.exceptions.push({
  id: `${st.src.id}-${st.exceptions.length + 1}`, orderId: st.src.id, orderNo: st.src.orderNo, status: 'OPEN', ...ex,
});

const keys = (st) => ({ buyer: st.src.buyer, productType: st.src.productType });

const derive = (st, ctx) => deriveActivities(st.snapshot, { ...ctx.master, overrides: ctx.overrides, processSteps: ctx.processSteps }, keys(st));

/** Default attribution of a late completion: the master category with its evidence, else "Reason unavailable". */
const attributionOf = (act, ev) => {
  if (!act || !act.actualDate || !act.targetAtCompletion || act.actualDate <= act.targetAtCompletion) return null;
  return ev.evidence || act.attributionEvidence ? (act.attributionOverride || act.attribution) : 'REASON_UNAVAILABLE';
};

/** Record one plan version if anything moved (or when forced, e.g. a commitment revision). */
const cascade = (st, ctx, ev, changeType, before, extra = {}) => {
  const today = dateOf(ev.at);
  const after = dates(st, ctx, today);
  const term = terminalCode(st.activities);
  const moved = st.activities.filter((a) => before.rt[a.code] && before.rt[a.code] !== after.rt[a.code]);
  const created = extra.created || [];
  if (!moved.length && !created.length && !extra.force) return 'NO_CHANGE';
  const delta = before.rt[term] ? cdDiff(before.rt[term], after.rt[term]) : 0;
  moved.forEach((a) => audit(st, {
    at: ev.at, activityCode: a.code, field: 'Revised target', oldValue: before.rt[a.code], newValue: after.rt[a.code],
    changeType, actor: 'system', sourceRecord: ev.ref,
    reason: a.code === extra.trigger ? 'Actual date set from the source event' : `Cascade — ${extra.trigger || ev.event}`,
    dispatchImpact: delta,
  }));
  const trigger = st.activities.find((a) => a.code === extra.trigger);
  st.versions.push({
    versionNo: st.versions.length + 1,
    createdAt: ev.processedAt || ev.at,
    triggerEvent: ev.event,
    sourceModule: moduleOfEvent(ev.event),
    sourceRecord: ev.ref,
    approvedInSourceBy: ev.by || '—',
    changeType,
    activitiesMoved: moved.length,
    activitiesCreated: created.length,
    projectedBefore: before.rt[term] || null,
    projectedAfter: after.rt[term],
    deltaDispatch: delta,
    forecastDispatch: after.fc[term],
    reason: ev.reason || extra.reason || (trigger ? `${trigger.code} ${trigger.name} — actual from ${ev.ref}` : ev.event),
    attribution: extra.attribution !== undefined ? extra.attribution : (delta > 0 ? attributionOf(trigger, ev) : null),
    triggerActivity: extra.trigger || null,
    snapshot: Object.fromEntries(st.activities.map((a) => [a.code, { rt: after.rt[a.code], fc: after.fc[a.code] }])),
  });
  if (trigger) trigger.completionVersion = st.versions.length;
  return 'PROCESSED';
};

/** Re-derive the network after a source change, keeping every recorded fact by code. */
const rederive = (st, ctx, ev, reason, attribution) => {
  const before = dates(st, ctx, dateOf(ev.at));
  const old = Object.fromEntries(st.activities.map((a) => [a.code, a]));
  const fresh = derive(st, ctx);
  const created = [];
  st.activities = fresh.map((f) => {
    const o = old[f.code];
    if (!o) { created.push(f.code); return { ...f, baselineDate: null, postBaseline: st.baselineFrozen, addendumOn: dateOf(ev.at), addendumReason: reason }; }
    const kept = Object.fromEntries(STATE_FIELDS.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    if (o.provisional && !f.provisional) Object.assign(kept, { postBaseline: st.baselineFrozen, addendumOn: dateOf(ev.at), addendumReason: reason });
    return { ...f, ...kept };
  });
  Object.keys(old).filter((c) => !fresh.some((f) => f.code === c)).forEach((c) => {
    st.removed.push({ ...old[c], removedOn: ev.at });
    audit(st, { at: ev.at, activityCode: c, field: 'Activity', oldValue: old[c].name, newValue: 'Removed', changeType: 'SOURCE_AMENDED', actor: 'system', sourceRecord: ev.ref, reason: 'Removed by requirement change; predecessors re-linked to successors' });
  });
  // An addendum carries its own effective date and a baseline frozen from that date (FR-4.4).
  const now = revisedTargets(ctx.cal, st.activities, st.src.orderDate);
  st.activities.forEach((a) => { if (!a.baselineDate && !a.provisional) a.baselineDate = now[a.code]; });
  created.forEach((c) => audit(st, { at: ev.at, activityCode: c, field: 'Activity', oldValue: null, newValue: 'Added', changeType: 'SYSTEM_DERIVED', actor: 'system', sourceRecord: ev.ref, reason }));
  return cascade(st, ctx, ev, 'SYSTEM_DERIVED', before, { created, reason, attribution });
};

/** Set an actual at its threshold; partial postings are audited and set no date (FR-6.6). */
const complete = (st, ctx, ev, act, outcome = 'COMPLETED') => {
  if (!act) return 'NO_MATCH';
  if (act.actualDate) {
    audit(st, { at: ev.at, activityCode: act.code, field: 'Event', oldValue: null, newValue: ev.ref, changeType: 'PARTIAL_PROGRESS', actor: 'system', sourceRecord: ev.ref, reason: 'Event after completion — no change' });
    return 'NO_CHANGE';
  }
  if (act.threshold && ev.qty != null) {
    act.achievedQty = (act.achievedQty || 0) + ev.qty;
    act.partials = [...(act.partials || []), { ref: ev.ref, qty: ev.qty, at: ev.at, by: ev.by }];
    act.progressPct = Math.min(100, Math.round((act.achievedQty / act.requiredQty) * 100));
    if (act.achievedQty < (act.requiredQty * act.threshold) / 100) {
      audit(st, {
        at: ev.at, activityCode: act.code, field: 'Progress', oldValue: null,
        newValue: `${act.achievedQty.toLocaleString('en-IN')} of ${act.requiredQty.toLocaleString('en-IN')} ${act.uom}`,
        changeType: 'PARTIAL_PROGRESS', actor: 'system', sourceRecord: ev.ref,
        reason: `Partial — threshold ${act.threshold}% not met · no date set`,
      });
      return 'PARTIAL';
    }
  }
  const before = dates(st, ctx, dateOf(ev.at));
  Object.assign(act, {
    actualDate: dateOf(ev.at),
    targetAtCompletion: before.rt[act.code],
    outcome,
    evidence: {
      eventId: ev.id, event: ev.event, sourceModule: moduleOfEvent(ev.event), sourceRecord: ev.ref, at: ev.at, postedBy: ev.by,
      threshold: act.threshold, achievedQty: act.achievedQty, requiredQty: act.requiredQty, uom: act.uom, outcome,
    },
    attributionEvidence: ev.evidence || act.attributionEvidence || null,
  });
  audit(st, { at: ev.at, activityCode: act.code, field: 'Actual', oldValue: null, newValue: act.actualDate, changeType: 'SYSTEM_DERIVED', actor: 'system', sourceRecord: ev.ref, reason: `${ev.event} · ${ev.ref}` });
  return cascade(st, ctx, ev, 'SYSTEM_DERIVED', before, { trigger: act.code });
};

const sampleActivity = (st, ev, stage) => st.activities.find((a) => a.sampleKey === SAMPLE_KEY[ev.sampleType]
  && a.sampleStage === stage && a.cycle === (ev.cycle || 1));

const generate = (st, ctx, ev) => {
  st.confirmedEvent = st.confirmedEvent || ev;
  if (st.snapshot.identityIssues.length) {
    st.status = 'BLOCKED';
    st.snapshot.identityIssues.forEach((i) => raise(st, {
      severity: 'BLOCK', type: 'IDENTITY_UNRESOLVED', detail: i.detail, sourceRecord: i.ref, raisedOn: ev.at,
      systemBehaviour: 'Plan not generated', ownerRole: 'Data steward', action: 'RESOLVE_IDENTITY', unresolvedValue: i.value,
    }));
    return 'HELD';
  }
  if (!st.snapshot.bom) {
    st.status = 'BLOCKED';
    raise(st, {
      severity: 'BLOCK', type: 'MISSING_MANDATORY_INPUT', detail: 'No BOM exists for the order; the activity set cannot be derived',
      sourceRecord: '—', raisedOn: ev.at, systemBehaviour: 'Plan not generated', ownerRole: 'Merchandising',
    });
    return 'HELD';
  }
  const when = ev.processedAt || ev.at;
  const { original } = commitments(st);
  st.activities = derive(st, ctx);
  const gen = generateBaseline(ctx.cal, st.activities, st.src.orderDate, original, ctx.settings);
  st.activities.forEach((a) => { a.baselineDate = a.provisional ? null : gen.baseline[a.code]; });
  st.generation = {
    generatedAt: when, masterVersion: ctx.master.versionNo, ruleVersion: RULE_VERSION, feasibility: gen.feasibility,
    earliestDispatch: gen.earliestDispatch, dispatchFloat: gen.dispatchFloat, shortfallDays: gen.shortfallDays, floatAtReceipt: gen.floatAtReceipt,
  };
  st.lines.forEach((l) => st.commitments.push({
    lineId: l.lineId, lineNo: l.lineNo, buyerPoNo: l.buyerPoNo, type: 'ORIGINAL', date: l.originalCommitment, previous: null,
    setOn: st.confirmedEvent.at, sourceRecord: st.src.orderNo, actor: st.confirmedEvent.by, reason: 'Order confirmed',
  }));
  const infeasible = gen.feasibility === 'INFEASIBLE';
  st.status = infeasible ? 'INFEASIBLE' : 'ACTIVE';
  st.baselineFrozen = !infeasible;
  const a01 = st.activities.find((a) => a.code === 'A01');
  Object.assign(a01, {
    actualDate: dateOf(ev.at), targetAtCompletion: a01.baselineDate, outcome: 'COMPLETED',
    evidence: { eventId: ev.id, event: ev.event, sourceModule: 'Order Entry', sourceRecord: st.src.orderNo, at: ev.at, postedBy: ev.by, outcome: 'COMPLETED' },
  });
  const after = dates(st, ctx, dateOf(when));
  const term = terminalCode(st.activities);
  st.versions.push({
    versionNo: st.versions.length + 1, createdAt: when, triggerEvent: ev.event, sourceModule: 'Order Entry', sourceRecord: st.src.orderNo,
    approvedInSourceBy: ev.by, changeType: 'GENERATION', activitiesMoved: 0, activitiesCreated: st.activities.length,
    projectedBefore: null, projectedAfter: after.rt[term], deltaDispatch: 0, forecastDispatch: after.fc[term],
    reason: infeasible ? `Plan generated, not activated — commitment short by ${gen.shortfallDays} CD` : 'Baseline set',
    attribution: null, triggerActivity: 'A01',
    snapshot: Object.fromEntries(st.activities.map((a) => [a.code, { rt: after.rt[a.code], fc: after.fc[a.code] }])),
  });
  a01.completionVersion = st.versions.length;
  if (infeasible) {
    raise(st, {
      severity: 'BLOCK', type: 'INFEASIBLE_COMMITMENT', sourceRecord: st.src.orderNo, raisedOn: when, ownerRole: 'Merchandising Manager',
      detail: `Earliest feasible dispatch ${gen.earliestDispatch} against commitment ${original} — short by ${gen.shortfallDays} CD`,
      systemBehaviour: 'Plan generated, flagged, not activated. Durations not shortened', action: 'ACKNOWLEDGE_INFEASIBLE',
    });
  }
  const provisional = st.activities.filter((a) => a.provisional);
  if (provisional.length) {
    raise(st, {
      severity: 'WARN', type: 'PROVISIONAL_ACTIVITIES', sourceRecord: provisional[0].requirementRef, raisedOn: when, ownerRole: 'Production Planning',
      detail: `${provisional[0].sourceModule} requirement still in Draft; ${provisional.length} activities planned from master defaults`,
      systemBehaviour: 'Plan provisional; excluded from baseline until submitted', activities: provisional.map((a) => a.code),
    });
  }
  return 'PROCESSED';
};

const resolveRaised = (st, type, at) => st.exceptions
  .filter((x) => x.type === type && x.status === 'OPEN')
  .forEach((x) => Object.assign(x, { status: 'RESOLVED', resolvedOn: at }));

/** Event handlers once the plan exists. Each returns the event-log processing status. */
const HANDLERS = {
  'order.dispatch_revised': (st, ctx, ev) => {
    const line = st.lines.find((l) => l.lineId === ev.lineId);
    const before = dates(st, ctx, dateOf(ev.at));
    st.commitments.push({ lineId: line.lineId, lineNo: line.lineNo, buyerPoNo: line.buyerPoNo, type: 'REVISED', date: ev.date, previous: line.latestCommitment, setOn: ev.at, sourceRecord: ev.ref, actor: ev.by, reason: ev.reason });
    audit(st, { at: ev.at, activityCode: null, field: `Dispatch commitment (line ${line.lineNo})`, oldValue: line.latestCommitment, newValue: ev.date, changeType: 'COMMITMENT_REVISION', actor: ev.by, sourceRecord: ev.ref, reason: ev.reason });
    line.latestCommitment = ev.date;
    return cascade(st, ctx, ev, 'COMMITMENT_REVISION', before, { force: true, attribution: null });
  },
  'purchase_order.approved': (st, ctx, ev) => complete(st, ctx, ev, st.activities.find((a) => a.code === (ev.material === 'FABRIC' ? 'A07' : 'A08'))),
  'sample.submitted': (st, ctx, ev) => {
    audit(st, { at: ev.at, activityCode: sampleActivity(st, ev, 'DISPATCH')?.code, field: 'Sample status', oldValue: null, newValue: 'Submitted', changeType: 'PARTIAL_PROGRESS', actor: 'system', sourceRecord: ev.ref, reason: 'Submitted is not dispatched — no activity completed (FR-6.9)' });
    return 'NO_CHANGE';
  },
  'sample.dispatched': (st, ctx, ev) => complete(st, ctx, ev, sampleActivity(st, ev, 'DISPATCH')),
  'sample.approved': (st, ctx, ev) => complete(st, ctx, ev, sampleActivity(st, ev, 'APPROVAL')),
  'sample.rejected': (st, ctx, ev) => {
    const status = complete(st, ctx, ev, sampleActivity(st, ev, 'APPROVAL'), 'REJECTED');
    const sample = st.snapshot.samples.find((s) => SAMPLE_KEY[s.sampleType] === SAMPLE_KEY[ev.sampleType]);
    sample.cycles = (ev.cycle || 1) + 1;
    raise(st, { severity: 'WARN', type: 'QUALITY_REJECTION', sourceRecord: ev.ref, raisedOn: ev.at, ownerRole: 'Merchandising', detail: `${ev.sampleType} rejected by buyer: ${ev.reason}`, systemBehaviour: `Cycle ${sample.cycles} opened; the completed cycle is kept in history` });
    rederive(st, ctx, ev, `${ev.sampleType} cycle ${sample.cycles} — buyer rejection of ${ev.ref}`, 'BUYER');
    return status;
  },
  'sample.deadline_revised': (st, ctx, ev) => {
    const act = sampleActivity(st, ev, ev.stage);
    if (!act || act.actualDate) return 'NO_CHANGE';
    const before = dates(st, ctx, dateOf(ev.at));
    audit(st, { at: ev.at, activityCode: act.code, field: 'Source target', oldValue: act.notBefore || null, newValue: ev.date, changeType: 'SOURCE_AMENDED', actor: ev.by, sourceRecord: ev.ref, reason: ev.reason });
    act.notBefore = ev.date;
    act.attributionEvidence = { record: ev.ref, text: ev.reason };
    return cascade(st, ctx, ev, 'SOURCE_AMENDED', before, { trigger: act.code, attribution: act.attribution });
  },
  'po.promise_revised': (st, ctx, ev) => {
    const act = st.activities.find((a) => a.code === 'A13');
    if (act.actualDate) return 'NO_CHANGE';
    const before = dates(st, ctx, dateOf(ev.at));
    audit(st, { at: ev.at, activityCode: 'A13', field: 'Supplier promise', oldValue: act.notBefore || null, newValue: ev.date, changeType: 'SOURCE_AMENDED', actor: ev.by, sourceRecord: ev.ref, reason: ev.reason });
    act.notBefore = ev.date;
    act.attributionEvidence = { record: ev.ref, text: ev.reason, derivedFrom: `PO promised ${ev.promised} · revised ${ev.date}` };
    return cascade(st, ctx, ev, 'SOURCE_AMENDED', before, { trigger: 'A13', attribution: 'SUPPLIER' });
  },
  'inspection.completed': (st, ctx, ev) => {
    const act = st.activities.find((a) => a.code === (ev.scope === 'FINAL' ? 'A23' : 'A14'));
    if (ev.result === 'FAIL') {
      audit(st, { at: ev.at, activityCode: act.code, field: 'Inspection', oldValue: null, newValue: 'Fail', changeType: 'PARTIAL_PROGRESS', actor: 'system', sourceRecord: ev.ref, reason: 'A Fail does not complete the activity (BR-09)' });
      raise(st, { severity: 'WARN', type: 'QUALITY_REJECTION', sourceRecord: ev.ref, raisedOn: ev.at, ownerRole: 'Head of Quality', detail: `${act.name} failed: ${ev.reason}`, systemBehaviour: 'Activity stays open; critical alert sent' });
      act.attributionEvidence = { record: ev.ref, text: ev.reason };
      act.attributionOverride = 'QUALITY';
      return 'NO_CHANGE';
    }
    const status = complete(st, ctx, ev, act);
    resolveRaised(st, 'QUALITY_REJECTION', ev.at);
    return status;
  },
  'panel.receipt_accepted': (st, ctx, ev) => complete(st, ctx, ev, st.activities.find((a) => a.lane === 'CUTTING' && a.scope?.seq === ev.seq)),
  'process.receipt_accepted': (st, ctx, ev) => complete(st, ctx, ev, st.activities.find((a) => a.lane === 'SEWING' && a.scope?.seq === ev.seq)),
  'cut_panel.requirement_changed': (st, ctx, ev) => {
    st.snapshot.cutPanel = { ...st.snapshot.cutPanel, ...ev.requirement };
    const status = rederive(st, ctx, ev, ev.reason, 'SCOPE_ADDENDUM');
    if (st.baselineFrozen) raise(st, { severity: 'WARN', type: 'POST_BASELINE_ADDENDUM', sourceRecord: ev.ref, raisedOn: ev.at, ownerRole: 'Production Planning', detail: ev.reason, systemBehaviour: 'Added as baseline addendum, flagged post-baseline' });
    return status;
  },
  // "Fully Used" means the PO allocation is consumed, not that processed goods exist (FR-2.7, BR-07).
  'cut_panel.status_changed': (st, ctx, ev) => {
    audit(st, { at: ev.at, activityCode: null, field: 'Requirement status', oldValue: null, newValue: ev.status, changeType: 'PARTIAL_PROGRESS', actor: 'system', sourceRecord: ev.ref, reason: 'Allocation status — completes no activity; completion is the accepted receipt' });
    return 'NO_CHANGE';
  },
  'garment_process.requirement_changed': (st, ctx, ev) => {
    st.snapshot.garmentProcess = { ...st.snapshot.garmentProcess, ...ev.requirement };
    const status = rederive(st, ctx, ev, ev.reason, 'SCOPE_ADDENDUM');
    if (!st.activities.some((a) => a.provisional)) resolveRaised(st, 'PROVISIONAL_ACTIVITIES', ev.at);
    return status;
  },
  'shipment.dispatched': (st, ctx, ev) => {
    const line = st.lines.find((l) => l.lineId === ev.lineId);
    line.actualDispatch = dateOf(ev.at);
    line.dispatchRef = ev.ref;
    const status = complete(st, ctx, ev, st.activities.find((a) => a.isTerminal));
    if (st.lines.every((l) => l.actualDispatch)) { st.status = 'CLOSED'; st.closedOn = ev.at; }
    return status;
  },
  'source.amended': (st, ctx, ev) => {
    const act = st.activities.find((a) => a.evidence?.eventId === ev.targetId);
    if (!act) return 'NO_MATCH';
    const before = dates(st, ctx, dateOf(ev.at));
    audit(st, { at: ev.at, activityCode: act.code, field: 'Actual', oldValue: act.actualDate, newValue: dateOf(ev.newAt), changeType: 'SOURCE_AMENDED', actor: ev.by, sourceRecord: ev.ref, reason: ev.reason });
    act.actualDate = dateOf(ev.newAt);
    act.evidence = { ...act.evidence, amendedFrom: act.evidence.at, at: ev.newAt };
    return cascade(st, ctx, ev, 'SOURCE_AMENDED', before, { trigger: act.code });
  },
  'order.cancelled': (st) => { st.status = 'CANCELLED'; return 'PROCESSED'; },
};

const handle = (st, ctx, ev) => {
  if (ev.event === 'order.confirmed') return generate(st, ctx, ev);
  if (!st.activities.length) { st.pending.push(ev); return 'HELD'; }
  if (HANDLERS[ev.event]) return HANDLERS[ev.event](st, ctx, ev);
  if (SIMPLE_TARGET[ev.event]) return complete(st, ctx, ev, st.activities.find((a) => a.code === SIMPLE_TARGET[ev.event]));
  return 'NO_MATCH';
};

/** Replay one order's source events up to `ctx.asOf`. */
export const replayOrder = (src, ctx) => {
  const st = {
    src,
    ctx, // the masters, calendar and rules this plan was generated with (FR-12.2)
    status: 'NOT_PLANNED',
    snapshot: {
      samples: src.samples.map((s) => ({ ...s, cycles: 1 })),
      cutPanel: src.cutPanel ? { ...src.cutPanel } : null,
      garmentProcess: src.garmentProcess ? { ...src.garmentProcess } : null,
      flags: src.flags || {},
      bom: src.bom || null,
      identityIssues: [...(src.identityIssues || [])],
      orderQty: src.qty,
      fabricRequired: src.fabricRequired,
      fabricUom: src.fabricUom || 'm',
    },
    lines: src.lines.map((l) => ({ ...l, originalCommitment: l.dispatchDate, latestCommitment: l.dispatchDate, actualDispatch: null })),
    activities: [], removed: [], versions: [], audit: [], commitments: [], exceptions: [], eventLog: [], pending: [],
    seen: new Set(), duplicates: 0, baselineFrozen: false, generation: null,
  };
  [...src.events]
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))
    .filter((ev) => dateOf(ev.at) <= ctx.asOf)
    .forEach((ev) => {
      const entry = { id: ev.id, at: ev.at, event: ev.event, module: moduleOfEvent(ev.event), sourceRecord: ev.ref, orderId: src.id, orderNo: src.orderNo };
      if (st.seen.has(ev.id)) {
        st.duplicates += 1;
        st.eventLog.push({ ...entry, status: 'DUPLICATE_SUPPRESSED' });
        return;
      }
      st.seen.add(ev.id);
      st.eventLog.push({ ...entry, status: handle(st, ctx, ev) });
    });
  return st;
};

/** Generate a held plan now (identity resolved / input supplied), then apply what was held. */
export const regenerate = (st, ctx, at, by) => {
  st.ctx = ctx;
  st.snapshot.identityIssues = [];
  st.exceptions.filter((x) => x.status === 'OPEN' && x.severity === 'BLOCK').forEach((x) => Object.assign(x, { status: 'RESOLVED', resolvedOn: at, resolvedBy: by }));
  const ev = { ...st.confirmedEvent, processedAt: at };
  st.eventLog.push({ id: `${st.src.id}-regen`, at, event: 'identity.resolved', module: 'Order Entry', sourceRecord: st.src.orderNo, orderId: st.src.id, orderNo: st.src.orderNo, status: generate(st, ctx, ev) });
  const held = st.pending;
  st.pending = [];
  // Held facts keep their business date; only the version records when they were applied.
  held.forEach((p) => {
    const entry = st.eventLog.find((x) => x.id === p.id);
    if (entry) entry.status = handle(st, ctx, { ...p, processedAt: at, reason: p.reason || `Held while blocked; applied ${at.slice(0, 10)}` });
  });
};
