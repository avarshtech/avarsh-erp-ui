/**
 * Pull-back rules (plan 1e): pieces at each stage, what may be pulled back, the suggested quantity,
 * request checks, the approval clamp and which vendor POs a piece comes off. Pure.
 */
import {
  DOC_TYPE, FINISHING_PROCESS_STAGE, NOT_STARTED, STAGE, WITHDRAWAL_KIND, sortStages, stageLabel, stageSeq,
} from './constants';
import {
  addWorkingDays, isAfterDay, subtractWorkingDays, workingDaysBetween,
} from './workingDays';

/**
 * Pieces sitting at each stage per colour: not started = first-stage plan − its cumulative;
 * at stage s = cumulative(s) − cumulative(next) − pull-back returns already at s;
 * at the final stage = cumulative − final good + rejected.
 */
export const piecesAtStages = ({ stages, colours, cells, planByColour, finalReceived, returnedAt = {} }) => {
  const out = {};
  const first = stages[0];
  const last = stages[stages.length - 1];
  colours.forEach((colour) => {
    const c = cells?.[colour] || {};
    const row = { [NOT_STARTED]: Math.max(0, (planByColour?.[first]?.[colour] || 0) - (c[first] || 0)) };
    stages.forEach((stage, i) => {
      const next = stages[i + 1];
      const here = (c[stage] || 0) - (next ? (c[next] || 0) : (finalReceived?.[colour] || 0));
      row[stage] = stage === last ? Math.max(0, here) : Math.max(0, here - (returnedAt?.[colour]?.[stage] || 0));
    });
    out[colour] = row;
  });
  return out;
};

/** Per colour: final-stage plan − final good+rejected − pieces on other approved, unreturned pull-backs. */
export const availableToPullBack = ({ colours, finalPlan, finalReceived, otherOpen = {} }) => Object.fromEntries(
  colours.map((c) => [c, Math.max(0, (finalPlan?.[c] || 0) - (finalReceived?.[c] || 0) - (otherOpen[c] || 0))]),
);

/** The earlier of the due date and the ship date less the buffer; never before the next working day. */
export const pullBackTargetDate = ({ dueDate, shipDate, bufferDays, today }) => {
  const candidates = [dueDate, shipDate ? subtractWorkingDays(shipDate, bufferDays) : null].filter(Boolean);
  const earliest = candidates.sort()[0] || null;
  const nextWorking = addWorkingDays(today, 1);
  return earliest && isAfterDay(earliest, today) ? earliest : nextWorking;
};

/**
 * Suggested lines [{ colour, stage, suggested }]: the shortfall the vendor cannot finish by the target
 * date at the slowest moving stage's pace, split over colours by what each has left, least-advanced first.
 */
export const suggestPullBack = ({ stages, colours, pieces, planByColour, cells, rates, today, targetDate, available }) => {
  const final = stages[stages.length - 1];
  const positive = Object.values(rates || {}).filter((r) => r > 0);
  const pace = positive.length ? Math.min(...positive) : 0;
  const days = workingDaysBetween(today, targetDate);
  const remaining = Object.fromEntries(colours.map((c) => [c, Math.max(0, (planByColour?.[final]?.[c] || 0) - (cells?.[c]?.[final] || 0))]));
  const remainingTotal = Object.values(remaining).reduce((a, b) => a + b, 0);
  const shortfall = Math.max(0, Math.round(remainingTotal - pace * days));
  if (!shortfall || !remainingTotal) return [];
  const order = [NOT_STARTED, ...stages.slice(0, -1)];
  const lines = [];
  let given = 0;
  colours.forEach((colour, i) => {
    let want = i === colours.length - 1 ? shortfall - given
      : Math.round((shortfall * remaining[colour]) / remainingTotal);
    want = Math.min(want, available?.[colour] ?? want);
    given += want;
    order.forEach((stage) => {
      if (want <= 0) return;
      const take = Math.min(want, pieces?.[colour]?.[stage] || 0);
      if (take > 0) { lines.push({ colour, stage, suggested: take }); want -= take; }
    });
  });
  return lines;
};

/** { errors, warnings } for request lines [{ colour, stage, requested }]. */
export const validatePullBackLines = ({ lines, stages, available, pieces }) => {
  const errors = [];
  const warnings = [];
  const final = stages[stages.length - 1];
  const byColour = {};
  if (!lines?.length) errors.push({ message: 'Add at least one line.' });
  (lines || []).forEach((l) => {
    const qty = Number(l.requested) || 0;
    if (!Number.isInteger(qty) || qty <= 0) errors.push({ colour: l.colour, message: `${l.colour}: enter a whole number above 0.` });
    if (l.stage === final) errors.push({ colour: l.colour, message: `${l.colour}: pieces at ${stageLabel(final)} are received on a normal receipt.` });
    byColour[l.colour] = (byColour[l.colour] || 0) + qty;
    const there = pieces?.[l.colour]?.[l.stage];
    if (there !== undefined && qty > there) {
      warnings.push({ colour: l.colour, message: `${l.colour} at ${stageLabel(l.stage)}: only ${there} are there by the last update.` });
    }
  });
  Object.entries(byColour).forEach(([colour, qty]) => {
    if (qty > (available?.[colour] || 0)) {
      errors.push({ colour, message: `${colour}: ${qty} asked, only ${available?.[colour] || 0} can still be pulled back.` });
    }
  });
  return { errors, warnings };
};

/** Approval clamp: per colour, cut the most-advanced lines first down to what is still available. */
export const clampOnApproval = ({ lines, available }) => {
  const byColour = {};
  lines.forEach((l) => { (byColour[l.colour] = byColour[l.colour] || []).push(l); });
  return Object.entries(byColour).flatMap(([colour, rows]) => {
    let excess = rows.reduce((a, r) => a + r.requested, 0) - (available?.[colour] || 0);
    const sorted = [...rows].sort((a, b) => stageSeq(b.stage) - stageSeq(a.stage));
    const approved = new Map(sorted.map((r) => {
      const cut = Math.max(0, Math.min(r.requested, excess));
      excess -= cut;
      return [r, r.requested - cut];
    }));
    return rows.map((r) => ({ ...r, approved: approved.get(r) }));
  });
};

const lastProcessStage = (doc) => sortStages((doc.processes || []).map((p) => FINISHING_PROCESS_STAGE[p]).filter(Boolean)).pop();

/**
 * Which vendor POs a piece pulled back at `stage` comes off: every vendor PO of the job whose stages run
 * past it, one row each. Cutting PO: not-started only (CUT). Work Order: SEW below STITCHED, FIN from
 * STITCHED up to the last finishing stage in scope. Vendor Finishing PO: FIN below its last process.
 * Cut Panel / Garment Process PO: PROCESS when not started.
 */
export const withdrawalKinds = ({ stage, docs, finishingScope = [] }) => {
  const rows = [];
  const lastFinishing = sortStages(finishingScope).pop();
  const pick = (type) => docs.filter((d) => d.docType === type)[0];
  const cpo = pick(DOC_TYPE.CUTTING_PO);
  const wo = pick(DOC_TYPE.WORK_ORDER);
  const fpo = pick(DOC_TYPE.FINISHING_PO);
  const proc = pick(DOC_TYPE.CUT_PANEL_PO) || pick(DOC_TYPE.GARMENT_PROCESS_PO);
  if (cpo && stage === NOT_STARTED) rows.push({ doc: cpo, kind: WITHDRAWAL_KIND.CUT });
  if (wo) {
    if (stage === NOT_STARTED || stageSeq(stage) < stageSeq(STAGE.STITCHED)) rows.push({ doc: wo, kind: WITHDRAWAL_KIND.SEW });
    else if (lastFinishing && stageSeq(stage) < stageSeq(lastFinishing)) rows.push({ doc: wo, kind: WITHDRAWAL_KIND.FIN });
  }
  const fpoLast = fpo && lastProcessStage(fpo);
  if (fpoLast && stageSeq(stage) < stageSeq(fpoLast)) rows.push({ doc: fpo, kind: WITHDRAWAL_KIND.FIN });
  if (proc && stage === NOT_STARTED) rows.push({ doc: proc, kind: WITHDRAWAL_KIND.PROCESS });
  return rows;
};

/** Split `qty` over sizes pro rata to `weights` ({ size: qty }), largest remainder first. */
export const splitBySize = (qty, weights) => {
  const entries = Object.entries(weights || {}).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total || qty <= 0) return {};
  const raw = entries.map(([size, w]) => ({ size, exact: (qty * w) / total }));
  const out = Object.fromEntries(raw.map((r) => [r.size, Math.floor(r.exact)]));
  let left = qty - Object.values(out).reduce((a, b) => a + b, 0);
  raw.sort((a, b) => (b.exact % 1) - (a.exact % 1)).forEach((r) => { if (left > 0) { out[r.size] += 1; left -= 1; } });
  return out;
};
