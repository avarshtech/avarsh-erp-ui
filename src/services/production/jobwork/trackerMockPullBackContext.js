/**
 * Shared figures for a job's pull-backs (plan 1e): pieces at each stage, what may still be pulled
 * back, the suggestion, earnings and the withdrawal rows per vendor PO. Used by the pull-back and
 * return mocks only.
 */
import {
  DOC_TYPE, PULLBACK_SHIP_BUFFER_DAYS, PULLBACK_STATUS, RETURN_STATUS, stageLabel,
} from '../../../utils/jobWorkTracker/constants';
import {
  availableToPullBack, piecesAtStages, pullBackTargetDate, splitBySize, suggestPullBack, withdrawalKinds,
} from '../../../utils/jobWorkTracker/pullBackRules';
import { earnedPerPiece } from '../../../utils/jobWorkTracker/earnings';
import { jobContext } from './trackerMockContext';

/** Posted return quantities (good + damaged) per colour × stage reached, for one pull-back or all. */
export const returnedAt = (returns, pullBackId) => {
  const out = {};
  returns.filter((r) => r.status === RETURN_STATUS.POSTED && (pullBackId === undefined || r.pullBackId === pullBackId))
    .forEach((r) => r.lines.forEach((l) => {
      out[l.colour] = out[l.colour] || {};
      out[l.colour][l.stage] = (out[l.colour][l.stage] || 0) + (Number(l.good) || 0) + (Number(l.damaged) || 0);
    }));
  return out;
};

export const returnedByColour = (returns, pullBackId) => {
  const at = returnedAt(returns, pullBackId);
  return Object.fromEntries(Object.entries(at).map(([c, byStage]) => [c, Object.values(byStage).reduce((a, b) => a + b, 0)]));
};

/** Pieces approved on a pull-back and not returned yet, per colour. */
export const openApprovedByColour = (pb, returns) => {
  if (pb.status !== PULLBACK_STATUS.APPROVED) return {};
  const back = returnedByColour(returns, pb.id);
  const out = {};
  pb.lines.forEach((l) => { out[l.colour] = (out[l.colour] || 0) + (Number(l.approved) || 0); });
  Object.keys(out).forEach((c) => { out[c] = Math.max(0, out[c] - (back[c] || 0)); });
  return out;
};

export const pullBackContext = (db, job, today, excludePullBackId) => {
  const ctx = jobContext(db, job, today);
  const s = ctx.snapshot;
  const allReturns = db.pullBackReturns.filter((r) => r.jobId === job.id);
  const otherOpen = {};
  ctx.pullBacks.filter((p) => p.id !== excludePullBackId).forEach((p) => {
    Object.entries(openApprovedByColour(p, allReturns)).forEach(([c, q]) => { otherOpen[c] = (otherOpen[c] || 0) + q; });
  });
  const pieces = piecesAtStages({
    stages: ctx.stages, colours: s.colours, cells: s.cells, planByColour: s.planByColour,
    finalReceived: s.finalReceived, returnedAt: returnedAt(allReturns),
  });
  const available = availableToPullBack({
    colours: s.colours, finalPlan: s.planByColour[s.finalStage], finalReceived: s.finalReceived, otherOpen,
  });
  const targetDate = pullBackTargetDate({
    dueDate: job.revisedDue || ctx.dueDate, shipDate: ctx.order.shipDate, bufferDays: PULLBACK_SHIP_BUFFER_DAYS, today,
  });
  return { ctx, pieces, available, targetDate, allReturns };
};

export const suggestionFor = (pbc, today) => {
  const { ctx, pieces, available, targetDate } = pbc;
  const s = ctx.snapshot;
  return suggestPullBack({
    stages: ctx.stages, colours: s.colours, pieces, planByColour: s.planByColour, cells: s.cells, rates: s.rates,
    today, targetDate, available,
  });
};

/** Earned for good pieces per line: [{ stage, qty }] → { total, perLine }. */
export const earningsFor = (ctx, lines) => {
  const perLine = lines.map((l) => {
    const per = earnedPerPiece({ stage: l.stage, docs: ctx.docs, finishingScope: ctx.job.finishingScope });
    return { ...l, perPiece: per.amount, amount: per.amount * (Number(l.qty) || 0), breakdown: per.breakdown };
  });
  return { total: perLine.reduce((a, l) => a + l.amount, 0), perLine };
};

/** Withdrawal rows per vendor PO for lines [{ colour, stage, qty }]: kind, qty and the size split. */
export const withdrawalRows = (ctx, lines, provisional) => lines.flatMap((l) => withdrawalKinds({
  stage: l.stage, docs: ctx.docs, finishingScope: ctx.job.finishingScope,
}).map(({ doc, kind }) => {
  const weights = {};
  (doc.lines || []).filter((dl) => dl.colour === l.colour).forEach((dl) => { weights[dl.size] = (weights[dl.size] || 0) + dl.plannedQty; });
  return {
    docKey: doc.key, docNo: doc.docNo, docType: doc.docType, kind, colour: l.colour, stage: l.stage, stageLabel: stageLabel(l.stage),
    qty: l.qty, sizes: splitBySize(l.qty, weights), provisional,
  };
})).filter((r) => r.qty > 0);

export const isCmt = (ctx) => ctx.docs.some((d) => d.docType === DOC_TYPE.CUTTING_PO) && ctx.docs.some((d) => d.docType === DOC_TYPE.WORK_ORDER);
