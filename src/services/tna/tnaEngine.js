/**
 * Time & Action scheduling and delay engine — CR-TNA-001 §9 (scheduling), §10 (revision),
 * §11 (delay). Pure functions, no I/O; every figure of the §17 worked example reproduces
 * (asserted by e2e/specs/tna/01-engine-worked-example.spec.js).
 *
 * Four separately held dates per activity (FR-5.5):
 *  - baseline        frozen at activation: forward pass from the order date, no actuals.
 *  - revised target  forward pass with completed activities pinned to their actual date;
 *                    moves only when a source fact changes, never with the clock (FR-5.2).
 *  - forecast        as the revised target, but an open activity starts no earlier than
 *                    today (FR-7.4), so nothing open is forecast to finish in the past.
 *  - actual          the completion event's date, set by the source, never typed.
 * Latest allowable = backward pass from a dispatch commitment; sinks take the commitment.
 * Activity float = latest allowable − revised target (FR-3.7); the header's dispatch float
 * = latest allowable − forecast of the dispatch activity. Durations are never shortened
 * (FR-3.10): an unreachable commitment is reported as a shortfall, not absorbed.
 * Activity measures are working days; order measures are calendar days (§11.1/§11.2).
 */
import {
  addWD, subWD, addCD, subCD, wdDiff, cdDiff, maxDate, minDate,
} from './tnaCalendar';

export const RULE_VERSION = 'TNA-R1';
export const DEFAULT_SETTINGS = { floatWarningWd: 3, dueSoonWd: 3 };

/** Kahn topological order over the predecessor graph (the cascade follows the graph, §10.3). */
export const topology = (acts) => {
  const byCode = Object.fromEntries(acts.map((a) => [a.code, a]));
  const indeg = Object.fromEntries(acts.map((a) => [a.code, a.predecessors.length]));
  const succ = {};
  acts.forEach((a) => a.predecessors.forEach((p) => { (succ[p] = succ[p] || []).push(a.code); }));
  const order = [];
  const queue = acts.filter((a) => indeg[a.code] === 0).map((a) => a.code);
  while (queue.length) {
    const c = queue.shift();
    order.push(c);
    (succ[c] || []).forEach((s) => { indeg[s] -= 1; if (indeg[s] === 0) queue.push(s); });
  }
  return { order, succ, byCode, cyclic: order.length !== acts.length };
};

const finishAfter = (cal, a, start) => (a.dayType === 'CD' ? addCD(start, a.duration) : addWD(cal, start, a.duration));
const startBefore = (cal, a, finish) => (a.dayType === 'CD' ? subCD(finish, a.duration) : subWD(cal, finish, a.duration));

/**
 * Forward pass (§9.3): finish = latest predecessor finish + own duration.
 * useActuals pins completed activities; today clamps open starts (forecast);
 * notBefore applies a source-held date such as a supplier's promised delivery.
 */
export const forwardPass = (cal, acts, anchor, { useActuals = false, today = null, floors = true } = {}) => {
  const { order, byCode } = topology(acts);
  const out = {};
  order.forEach((c) => {
    const a = byCode[c];
    if (useActuals && a.actualDate) { out[c] = a.actualDate; return; }
    let start = a.predecessors.length ? maxDate(a.predecessors.map((p) => out[p])) : anchor;
    if (today && start < today) start = today;
    let finish = finishAfter(cal, a, start);
    if (floors && a.notBefore && a.notBefore > finish) finish = a.notBefore;
    out[c] = finish;
  });
  return out;
};

/** Backward pass (§9.3): LS(a) = min over successors s of LS(s) − duration(s). */
export const backwardPass = (cal, acts, commitment) => {
  const { order, succ, byCode } = topology(acts);
  const ls = {};
  [...order].reverse().forEach((c) => {
    const s = succ[c] || [];
    ls[c] = s.length ? minDate(s.map((x) => startBefore(cal, byCode[x], ls[x]))) : commitment;
  });
  return ls;
};

export const terminalCode = (acts) => (acts.find((a) => a.isTerminal) || acts[acts.length - 1]).code;
export const revisedTargets = (cal, acts, orderDate) => forwardPass(cal, acts, orderDate, { useActuals: true });
export const forecasts = (cal, acts, orderDate, today) => forwardPass(cal, acts, orderDate, { useActuals: true, today });

/** Generation (§9.2 steps 6–9, §9.4): baseline, latest allowable and feasibility. */
export const generateBaseline = (cal, acts, orderDate, commitment, settings = DEFAULT_SETTINGS) => {
  const es = forwardPass(cal, acts, orderDate);
  const ls = backwardPass(cal, acts, commitment);
  const term = terminalCode(acts);
  const root = topology(acts).order[0];
  const earliestDispatch = es[term];
  const dispatchFloat = wdDiff(cal, earliestDispatch, ls[term]);
  let feasibility = 'FEASIBLE';
  if (earliestDispatch > commitment) feasibility = 'INFEASIBLE';
  else if (dispatchFloat <= settings.floatWarningWd) feasibility = 'FEASIBLE_TIGHT';
  return {
    baseline: es,
    latestAllowable: ls,
    earliestDispatch,
    dispatchFloat,
    feasibility,
    shortfallDays: Math.max(0, cdDiff(commitment, earliestDispatch)),
    floatAtReceipt: wdDiff(cal, es[root], ls[root]),
  };
};

/** Binding-predecessor chain into the dispatch activity — the longest path (FR-7.7). */
export const longestPath = (acts, finish) => {
  const { byCode } = topology(acts);
  const chain = [];
  let c = terminalCode(acts);
  while (c) {
    chain.unshift(c);
    const preds = byCode[c].predecessors;
    c = preds.length ? preds.reduce((m, p) => (finish[p] > finish[m] ? p : m)) : null;
  }
  return chain;
};

/** Net order impact = change in projected dispatch through the network, never a sum (§11.3). */
export const netOrderImpact = (dispatchBefore, dispatchAfter) => cdDiff(dispatchBefore, dispatchAfter);

const activityStatus = (cal, a, rt, today, settings) => {
  if (a.actualDate) {
    const reference = a.baselineDate || a.targetAtCompletion;
    return reference && a.actualDate > reference ? 'COMPLETED_LATE' : 'COMPLETED_ON_TIME';
  }
  if (today > rt) return 'OVERDUE';
  if (wdDiff(cal, today, rt) <= settings.dueSoonWd) return 'DUE_SOON';
  return a.progressPct > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
};

const healthOf = (forecastDispatch, commitment, openCriticalOverdue, dispatchFloat, settings) => {
  if (forecastDispatch > commitment) return 'RED';
  if (openCriticalOverdue || dispatchFloat <= settings.floatWarningWd) return 'AMBER';
  return 'GREEN';
};

/**
 * Evaluate a plan as of `today` (§10.1, §11). Inputs: activities with frozen baselineDate,
 * actualDate where completed; both commitments. Returns decorated activities and the
 * order-level measures on both commitment bases (FR-7.3).
 */
export const evaluatePlan = ({ cal, activities, orderDate, originalCommitment, latestCommitment, today, settings = DEFAULT_SETTINGS }) => {
  const rt = revisedTargets(cal, activities, orderDate);
  const fc = forecasts(cal, activities, orderDate, today);
  const lsLatest = backwardPass(cal, activities, latestCommitment);
  const lsOriginal = backwardPass(cal, activities, originalCommitment);
  const term = terminalCode(activities);

  const decorated = activities.map((a) => {
    const reference = a.actualDate || fc[a.code];
    const floatLatest = wdDiff(cal, rt[a.code], lsLatest[a.code]);
    const open = !a.actualDate;
    return {
      ...a,
      revisedTarget: rt[a.code],
      forecastDate: fc[a.code],
      latestAllowable: lsLatest[a.code],
      latestAllowableOriginal: lsOriginal[a.code],
      floatDays: floatLatest,
      floatDaysOriginal: wdDiff(cal, rt[a.code], lsOriginal[a.code]),
      isCritical: floatLatest <= 0,
      baselineVariance: a.baselineDate ? wdDiff(cal, a.baselineDate, reference) : null,
      revisedVariance: a.actualDate && a.targetAtCompletion ? wdDiff(cal, a.targetAtCompletion, a.actualDate) : null,
      overdueDays: open && today > rt[a.code] ? wdDiff(cal, rt[a.code], today) : 0,
      status: activityStatus(cal, a, rt[a.code], today, settings),
    };
  });

  const byCode = Object.fromEntries(decorated.map((a) => [a.code, a]));
  const openActs = decorated.filter((a) => !a.actualDate);
  const chain = longestPath(activities, fc);
  const driving = chain.map((c) => byCode[c]).find((a) => !a.actualDate) || null;
  const forecastDispatch = fc[term];
  const actualDispatch = byCode[term].actualDate || null;
  const basis = (commitment, ls, floatKey) => {
    const dispatchFloat = wdDiff(cal, forecastDispatch, ls[term]);
    const critical = openActs.filter((a) => a[floatKey] <= 0);
    return {
      commitment,
      dispatchFloat,
      openCritical: critical.length,
      forecastDelay: cdDiff(commitment, forecastDispatch),
      actualDelay: actualDispatch ? cdDiff(commitment, actualDispatch) : null,
      health: healthOf(forecastDispatch, commitment, critical.some((a) => a.overdueDays > 0), dispatchFloat, settings),
    };
  };
  const nextGate = openActs.filter((a) => a.isGate).sort((x, y) => (x.revisedTarget < y.revisedTarget ? -1 : 1))[0] || null;

  return {
    activities: decorated,
    order: {
      baselineDispatch: byCode[term].baselineDate || null,
      revisedDispatch: rt[term],
      forecastDispatch,
      actualDispatch,
      original: basis(originalCommitment, lsOriginal, 'floatDaysOriginal'),
      latest: basis(latestCommitment, lsLatest, 'floatDays'),
      commitmentMovement: cdDiff(originalCommitment, latestCommitment),
      leadTimeDays: cdDiff(orderDate, originalCommitment),
      elapsedToLatestDays: cdDiff(orderDate, latestCommitment),
      longestPath: chain,
      drivingActivity: driving ? driving.code : null,
      nextGate: nextGate ? nextGate.code : null,
      progress: { done: decorated.length - openActs.length, total: decorated.length },
    },
  };
};
