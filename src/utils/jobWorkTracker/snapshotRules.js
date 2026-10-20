/**
 * A job's figures as of today (plan "Risk", "Receipts", "Received floor"): effective cumulative per
 * colour × stage, received per stage, per-stage projection over working days, stall, risk with its
 * reasons, stale, ready-to-close and completion. Pure: the same rows feed the tracker and the drawer.
 */
import {
  FLAG, OPEN_JOB_STATUSES, PULLBACK_STATUS, RECEIPT_STATUS, RISK, RISK_REASON,
} from './constants';
import { colourTotals } from './planRules';
import {
  addWorkingDays, isAfterDay, isBeforeDay, previousWorkingDay, workingDaysBetween,
} from './workingDays';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);

/** { [stage]: { [colour]: { good, rejected, alter } } } from POSTED receipts. */
export const receivedByStage = (receipts = []) => {
  const out = {};
  receipts.filter((r) => r.status === RECEIPT_STATUS.POSTED).forEach((r) => {
    out[r.stage] = out[r.stage] || {};
    (r.lines || []).forEach((l) => {
      const row = out[r.stage][l.colour] || { good: 0, rejected: 0, alter: 0 };
      row.good += Number(l.good) || 0;
      row.rejected += Number(l.rejected) || 0;
      row.alter += Number(l.alter) || 0;
      out[r.stage][l.colour] = row;
    });
  });
  return out;
};

export const receivedQty = (received, stage, colour) => {
  const row = received?.[stage]?.[colour];
  return row ? row.good + row.rejected : 0;
};

/** Received floor per colour × stage: a stage can never be below what was received at it or at any later stage. */
export const floorByStage = (stages, colours, received) => {
  const floor = {};
  colours.forEach((colour) => {
    let carry = 0;
    [...stages].reverse().forEach((stage) => {
      carry = Math.max(carry, receivedQty(received, stage, colour));
      floor[colour] = floor[colour] || {};
      floor[colour][stage] = carry;
    });
  });
  return floor;
};

/** Reported cells raised to the received floor, so earlier stages are never below later ones. */
export const effectiveCells = (stages, colours, cells = {}, floor = {}) => {
  const out = {};
  colours.forEach((colour) => {
    out[colour] = {};
    let carry = 0;
    [...stages].reverse().forEach((stage) => {
      const v = Math.max(Number(cells?.[colour]?.[stage]) || 0, floor?.[colour]?.[stage] || 0, carry);
      out[colour][stage] = v;
      carry = v;
    });
  });
  return out;
};

const totalsOf = (stages, cellsByColour) => Object.fromEntries(
  stages.map((s) => [s, sum(Object.values(cellsByColour || {}).map((c) => c?.[s]))]),
);

/** Pieces taken off the vendor per colour, for Ready to close: approved while APPROVED, returned + written off after settle. */
export const withdrawnByColour = (pullBacks = [], returnsByPullBack = {}) => {
  const out = {};
  pullBacks.forEach((pb) => {
    if (pb.status === PULLBACK_STATUS.APPROVED) {
      pb.lines.forEach((l) => { out[l.colour] = (out[l.colour] || 0) + (Number(l.approved) || 0); });
    } else if (pb.status === PULLBACK_STATUS.SETTLED) {
      (returnsByPullBack[pb.id] || []).forEach((ret) => ret.lines.forEach((l) => {
        out[l.colour] = (out[l.colour] || 0) + (Number(l.good) || 0) + (Number(l.damaged) || 0);
      }));
      pb.lines.forEach((l) => { out[l.colour] = (out[l.colour] || 0) + (Number(l.writtenOff) || 0); });
    }
  });
  return out;
};

const window3 = (entries) => {
  const last = entries.slice(-3);
  if (last.length < 2 || last[0].date === last[last.length - 1].date) return null;
  return { first: last[0], last: last[last.length - 1], span: workingDaysBetween(last[0].date, last[last.length - 1].date) };
};

/**
 * @param {object} p
 * @param {object} p.job       { status, dueDate, revisedDue, plannedStart, startDate }
 * @param {string[]} p.stages  job stage chain
 * @param {object} p.plan      net plan { [stage]: { [colour]: { [size]: qty } } }
 * @param {object} p.share     job share per colour
 * @param {object[]} p.entries progress entries, oldest first: { date, flag, issueCategory, cells }
 * @param {object[]} p.receipts receipts of the job
 * @param {object} p.withdrawn pieces withdrawn per colour (withdrawnByColour)
 * @param {string} p.today     ISO date
 */
export const computeSnapshot = ({ job, stages, plan, share, entries = [], receipts = [], withdrawn = {}, today }) => {
  const finalStage = stages[stages.length - 1];
  const colours = Object.keys(colourTotals(plan[finalStage] || plan[stages[0]] || {}));
  const planByColour = Object.fromEntries(stages.map((s) => [s, colourTotals(plan[s])]));
  const planTotals = Object.fromEntries(stages.map((s) => [s, sum(Object.values(planByColour[s] || {}))]));
  const received = receivedByStage(receipts);
  const floor = floorByStage(stages, colours, received);
  const lastEntry = entries[entries.length - 1] || null;
  const cells = effectiveCells(stages, colours, lastEntry?.cells, floor);
  const totals = totalsOf(stages, cells);

  const finalReceived = Object.fromEntries(colours.map((c) => [c, receivedQty(received, finalStage, c)]));
  const finalAlter = sum(colours.map((c) => received?.[finalStage]?.[c]?.alter || 0));
  const finalGood = sum(colours.map((c) => received?.[finalStage]?.[c]?.good || 0));
  const finalRejected = sum(colours.map((c) => received?.[finalStage]?.[c]?.rejected || 0));
  const finalReceivedTotal = sum(Object.values(finalReceived));
  // A colour pulled back in full has no final-stage plan left and cannot hold completion up.
  const plannedColours = colours.filter((c) => (planByColour[finalStage]?.[c] || 0) > 0);
  const completed = plannedColours.length > 0
    && plannedColours.every((c) => finalReceived[c] >= planByColour[finalStage][c]);
  const readyToClose = !completed && colours.length > 0
    && colours.every((c) => finalReceived[c] >= Math.max(0, (share[c] || 0) - (withdrawn[c] || 0)));

  // Per-stage projection over the last 3 entries (at least 2, on different dates).
  const w = window3(entries);
  const rates = {};
  let projectedDate = null;
  let bindingStage = null;
  let stalled = false;
  if (w && w.span > 0) {
    const firstTotals = totalsOf(stages, w.first.cells);
    const lastTotals = totalsOf(stages, w.last.cells);
    stages.forEach((s) => {
      rates[s] = (lastTotals[s] - firstTotals[s]) / w.span;
      if (firstTotals[s] > 0 && totals[s] < planTotals[s] && rates[s] > 0) {
        const p = addWorkingDays(w.last.date, Math.ceil((planTotals[s] - totals[s]) / rates[s]));
        if (!projectedDate || isAfterDay(p, projectedDate)) { projectedDate = p; bindingStage = s; }
      }
    });
    const moved = stages.some((s) => lastTotals[s] !== firstTotals[s]);
    stalled = !moved && w.span >= 2 && stages.some((s) => totals[s] > 0) && totals[finalStage] < planTotals[finalStage];
  }

  const open = OPEN_JOB_STATUSES.includes(job.status);
  const due = job.dueDate || null;
  const effectiveDue = job.revisedDue || due;
  const latestFlag = lastEntry?.flag || null;
  const reasons = [];
  if (due && projectedDate && isAfterDay(projectedDate, due)) reasons.push(RISK_REASON.PROJECTED_LATE);
  if (stalled) reasons.push(RISK_REASON.STALLED);
  if (due && job.revisedDue && isAfterDay(job.revisedDue, due)) reasons.push(RISK_REASON.REVISED);
  if (latestFlag === FLAG.AT_RISK || latestFlag === FLAG.DELAYED) reasons.push(RISK_REASON.FLAGGED);

  let risk = RISK.ON_TRACK;
  if (open && due && !readyToClose && !completed) {
    if (isBeforeDay(effectiveDue, today)) risk = RISK.OVERDUE;
    else if (reasons.length) risk = RISK.AT_RISK;
  }
  const prevWorking = previousWorkingDay(today);
  const stale = open && latestFlag !== FLAG.ON_HOLD && (lastEntry
    ? isBeforeDay(lastEntry.date, prevWorking)
    : Boolean(job.plannedStart || job.startDate) && !isAfterDay(job.plannedStart || job.startDate, prevWorking));

  const firstStage = stages[0];
  return {
    stages,
    finalStage,
    colours,
    planByColour,
    planTotals,
    received,
    floor,
    cells,
    totals,
    finalReceived,
    finalReceivedTotal,
    finalGood,
    finalRejected,
    finalAlter,
    alterationPct: finalGood + finalRejected + finalAlter > 0
      ? Math.round((finalAlter / (finalGood + finalRejected + finalAlter)) * 1000) / 10 : 0,
    inProcess: Math.max(0, (totals[firstStage] || 0) - finalReceivedTotal),
    completed,
    readyToClose,
    rates,
    projectedDate,
    bindingStage,
    stalled,
    risk,
    riskReasons: risk === RISK.ON_TRACK ? [] : reasons,
    stale,
    noDueDate: !due,
    effectiveDue,
    lastEntryDate: lastEntry?.date || null,
    latestFlag,
    latestIssue: lastEntry?.issueCategory || null,
  };
};
