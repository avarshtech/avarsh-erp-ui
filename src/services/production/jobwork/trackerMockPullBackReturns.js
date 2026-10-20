/**
 * Mock of pull-back returns (goods back as trucks arrive) and of the in-house PO pre-fill (plan 1e).
 * Posting needs an APPROVED pull-back; per colour, good + damaged cannot pass what was approved; a
 * line at the job's final stage is refused (that is a normal receipt).
 */
import {
  DOC_TYPE, FINISHING_STAGES, NOT_STARTED, PULLBACK_STATUS, RETURN_STATUS, STAGE, STAGE_LABEL, stageLabel, stageSeq,
} from '../../../utils/jobWorkTracker/constants';
import { splitBySize } from '../../../utils/jobWorkTracker/pullBackRules';
import { isAfterDay } from '../../../utils/jobWorkTracker/workingDays';
import {
  latency, loadTrackerDb, mockError, mutateTrackerDb, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';
import { returnedByColour } from './trackerMockPullBackContext';

const qty = (l) => (Number(l.good) || 0) + (Number(l.damaged) || 0);

const autoSettle = (db, pb, today) => {
  const back = returnedByColour(db.pullBackReturns, pb.id);
  const approved = {};
  pb.lines.forEach((l) => { approved[l.colour] = (approved[l.colour] || 0) + (Number(l.approved) || 0); });
  if (Object.entries(approved).every(([c, q]) => (back[c] || 0) >= q)) {
    pb.status = PULLBACK_STATUS.SETTLED;
    pb.settledAt = today;
    pb.history.push({ action: 'SETTLED', by: 'System', at: today, comment: 'Everything approved has arrived.' });
  }
};

/** payload = { id?, date, vendorDcNo, lines: [{ colour, size, stage, good, damaged, damageSource }], post } */
export const saveReturn = (pullBackId, payload = {}) => mutateTrackerDb((db) => {
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(pullBackId));
  if (!pb || ![PULLBACK_STATUS.PENDING_APPROVAL, PULLBACK_STATUS.APPROVED].includes(pb.status)) {
    throw mockError('Returns are recorded on a pull-back that is pending approval or approved.', { status: 409, code: 'CONFLICT' });
  }
  if (payload.post && pb.status !== PULLBACK_STATUS.APPROVED) throw mockError('Save it as a draft: posting waits for the manager\'s approval.', { status: 409, code: 'CONFLICT' });
  const job = db.jobs.find((j) => j.id === pb.jobId);
  const ctx = jobContext(db, job, today);
  const final = ctx.snapshot.finalStage;
  const lines = (payload.lines || []).filter((l) => qty(l) > 0).map((l) => ({
    colour: l.colour, size: l.size, stage: l.stage, good: Number(l.good) || 0, damaged: Number(l.damaged) || 0,
    damageSource: (Number(l.damaged) || 0) > 0 ? l.damageSource || null : null,
  }));
  const details = [];
  if (!lines.length) details.push({ message: 'Enter at least one quantity.' });
  if (!payload.date) details.push({ message: 'Enter the date the goods arrived.' });
  else if (isAfterDay(payload.date, today)) details.push({ message: 'The date cannot be in the future.' });
  if (payload.post && !(payload.vendorDcNo || '').trim()) details.push({ message: 'Enter the vendor\'s DC number.' });
  lines.forEach((l) => {
    if (l.stage === final) details.push({ colour: l.colour, message: `${l.colour} ${l.size}: pieces at ${STAGE_LABEL[final]} are received on a normal receipt.` });
    if (l.damaged > 0 && !l.damageSource) details.push({ colour: l.colour, message: `${l.colour} ${l.size}: say where the damage came from.` });
  });
  if (pb.status === PULLBACK_STATUS.APPROVED) {
    const before = returnedByColour(db.pullBackReturns.filter((r) => r.id !== payload.id), pb.id);
    const approved = {};
    pb.lines.forEach((l) => { approved[l.colour] = (approved[l.colour] || 0) + l.approved; });
    const now = {};
    lines.forEach((l) => { now[l.colour] = (now[l.colour] || 0) + qty(l); });
    Object.entries(now).forEach(([c, q]) => {
      if ((before[c] || 0) + q > (approved[c] || 0)) details.push({ colour: c, message: `${c}: ${before[c] || 0} back already + ${q} is more than the ${approved[c] || 0} approved.` });
    });
  }
  if (details.length) throw mockError(details[0].message, { details });

  let ret = payload.id ? db.pullBackReturns.find((r) => r.id === payload.id) : null;
  if (ret && ret.status !== RETURN_STATUS.DRAFT) throw mockError('Only a draft return can be changed.', { status: 409, code: 'CONFLICT' });
  if (!ret) {
    ret = { id: nextId(db, 'pullBackReturn'), prNo: nextDocNo(db, 'JPR'), pullBackId: pb.id, jobId: job.id, status: RETURN_STATUS.DRAFT, createdBy: 'You' };
    db.pullBackReturns.push(ret);
  }
  Object.assign(ret, { date: payload.date, vendorDcNo: (payload.vendorDcNo || '').trim(), lines });
  if (payload.post) {
    ret.status = RETURN_STATUS.POSTED;
    // The new plan must still hold what the daily sheets recorded; if not, keep the draft and say where.
    const after = jobContext(db, job, today).snapshot;
    const clash = [];
    after.colours.forEach((c) => ctx.stages.forEach((st) => {
      const recorded = after.cells?.[c]?.[st] || 0;
      const planned = after.planByColour?.[st]?.[c] || 0;
      if (recorded > planned) clash.push({ colour: c, stage: st, message: `${c} at ${STAGE_LABEL[st]}: ${recorded} recorded but only ${planned} would be planned. Correct the daily sheet, then post.` });
    }));
    if (clash.length) throw mockError(clash[0].message, { status: 409, code: 'CONFLICT', details: clash });
    job.events.push({ at: payload.date, by: 'You', text: `Pull-back return ${ret.prNo}: ${lines.reduce((a, l) => a + qty(l), 0)} pieces back` });
    autoSettle(db, pb, today);
  }
  return latency({ id: ret.id, prNo: ret.prNo, status: ret.status, pullBackStatus: pb.status });
});

export const cancelReturn = (returnId, { reason = '' } = {}) => mutateTrackerDb((db) => {
  const ret = db.pullBackReturns.find((r) => r.id === Number(returnId));
  if (!ret || ret.status === RETURN_STATUS.CANCELLED) throw mockError('This return is already cancelled.', { status: 409, code: 'CONFLICT' });
  const pb = db.pullBacks.find((p) => p.id === ret.pullBackId);
  if (pb.status === PULLBACK_STATUS.SETTLED) throw mockError('The pull-back is settled; its returns can no longer be cancelled.', { status: 409, code: 'CONFLICT' });
  if (ret.status === RETURN_STATUS.POSTED && !reason.trim()) throw mockError('Give a reason for cancelling a posted return.');
  ret.status = RETURN_STATUS.CANCELLED;
  ret.cancelReason = reason.trim();
  return latency({ id: ret.id, status: ret.status });
});

/** Good pieces per colour × size × stage: posted returns, plus approved-but-unreturned pieces split pro rata. */
const goodPieces = (db, pb, ctx) => {
  const posted = db.pullBackReturns.filter((r) => r.pullBackId === pb.id && r.status === RETURN_STATUS.POSTED);
  const rows = posted.flatMap((r) => r.lines.map((l) => ({ colour: l.colour, size: l.size, stage: l.stage, qty: Number(l.good) || 0, actual: true })));
  const recut = posted.flatMap((r) => r.lines.filter((l) => l.damaged > 0).map((l) => ({ colour: l.colour, size: l.size, qty: l.damaged })));
  pb.lines.filter((l) => l.writtenOff > 0).forEach((l) => recut.push({ colour: l.colour, size: null, qty: l.writtenOff }));
  if (pb.status === PULLBACK_STATUS.APPROVED) {
    const back = returnedByColour(db.pullBackReturns, pb.id);
    const left = { ...back };
    [...pb.lines].sort((a, b) => stageSeq(a.stage) - stageSeq(b.stage)).forEach((l) => {
      const used = Math.min(left[l.colour] || 0, l.approved);
      left[l.colour] = (left[l.colour] || 0) - used;
      const open = l.approved - used;
      if (open <= 0) return;
      const weights = {};
      ctx.docs.flatMap((d) => d.lines || []).filter((dl) => dl.colour === l.colour).forEach((dl) => { weights[dl.size] = Math.max(weights[dl.size] || 0, dl.plannedQty); });
      Object.entries(splitBySize(open, weights)).forEach(([size, q]) => rows.push({ colour: l.colour, size, stage: l.stage, qty: q, actual: false }));
    });
  }
  return { rows, recut };
};

const addTo = (lines, colour, size, q) => {
  if (q <= 0) return;
  const k = `${colour}|${size || '-'}`;
  lines[k] = { colour, size: size || '-', qty: (lines[k]?.qty || 0) + q };
};

/** In-house PO previews: Cutting PO (uncut fabric + re-cut), Work Order (below Stitched), Finishing PO (Stitched or later). */
export const getPoPrefill = (pullBackId) => {
  const db = loadTrackerDb();
  const pb = db.pullBacks.find((p) => p.id === Number(pullBackId));
  if (!pb) return Promise.reject(mockError('Pull-back not found.', { code: 'NOT_FOUND', status: 404 }));
  if (![PULLBACK_STATUS.APPROVED, PULLBACK_STATUS.SETTLED].includes(pb.status)) return latency({ previews: [], note: 'In-house POs can be raised once the pull-back is approved.' });
  const job = db.jobs.find((j) => j.id === pb.jobId);
  const ctx = jobContext(db, job, todayIso());
  const { rows, recut } = goodPieces(db, pb, ctx);
  const cpo = {};
  const wo = {};
  const fpo = {};
  // "Not started" means uncut fabric only when the vendor was cutting; on a sewing-only job it is cut panels.
  const vendorCuts = ctx.docs.some((d) => d.docType === DOC_TYPE.CUTTING_PO);
  rows.forEach((r) => {
    if (r.stage === NOT_STARTED) {
      if (vendorCuts) addTo(cpo, r.colour, r.size, r.qty);
      addTo(wo, r.colour, r.size, r.qty);
    } else if (stageSeq(r.stage) < stageSeq(STAGE.STITCHED)) addTo(wo, r.colour, r.size, r.qty);
    else addTo(fpo, r.colour, r.size, r.qty);
  });
  recut.forEach((r) => { addTo(cpo, r.colour, r.size, r.qty); addTo(wo, r.colour, r.size, r.qty); });
  const latest = rows.filter((r) => stageSeq(r.stage) >= stageSeq(STAGE.STITCHED)).map((r) => stageSeq(r.stage)).sort().pop();
  const remainingProcesses = FINISHING_STAGES.filter((st) => job.finishingScope.includes(st) && (!latest || stageSeq(st) > latest)).map((st) => STAGE_LABEL[st]);
  const rates = db.inhouseRates?.[job.orderId] || {};
  const units = db.inhouse?.[job.orderId]?.units || [];
  const branch = db.branches.find((b) => b.id === job.branchId)?.name;
  const preview = (docType, label, lines, extra = {}) => ({
    docType, label, branch, unit: units[units.length - 1] || 'Pick a unit', rate: rates[docType] ?? null,
    lines: Object.values(lines).sort((a, b) => a.colour.localeCompare(b.colour)),
    totalQty: Object.values(lines).reduce((a, l) => a + l.qty, 0),
    provisional: rows.some((r) => !r.actual), ...extra,
  });
  const previews = [
    preview(DOC_TYPE.CUTTING_PO, 'Cutting PO (in-house)', cpo, { note: 'Uncut fabric returned, plus re-cutting damaged and written-off pieces.' }),
    preview(DOC_TYPE.WORK_ORDER, 'Work Order (in-house)', wo, { note: 'Pieces back below Stitched, plus re-cut pieces.' }),
    preview(DOC_TYPE.FINISHING_PO, 'Finishing PO (in-house)', fpo, { note: 'Pieces back at Stitched or later.', processes: remainingProcesses }),
  ].filter((p) => p.totalQty > 0);
  return latency({ previews, stageNames: Object.fromEntries(rows.map((r) => [r.stage, stageLabel(r.stage)])) });
};

/** Mock of "open the PO form pre-filled and save a draft": records the link the cancel guard checks. */
export const createDraftPo = (pullBackId, { docType, totalQty } = {}) => mutateTrackerDb((db) => {
  const pb = db.pullBacks.find((p) => p.id === Number(pullBackId));
  if (!pb) throw mockError('Pull-back not found.', { code: 'NOT_FOUND', status: 404 });
  const prefix = { CUTTING_PO: 'CPO', WORK_ORDER: 'WO', FINISHING_PO: 'FPO' }[docType];
  db.draftPos = db.draftPos || [];
  const draft = { id: nextId(db, 'draftPo'), pullBackId: pb.id, docType, docNo: nextDocNo(db, prefix), status: 'DRAFT', totalQty, createdAt: todayIso() };
  db.draftPos.push(draft);
  return latency(draft);
});

export const removeDraftPo = (draftId) => mutateTrackerDb((db) => {
  db.draftPos = (db.draftPos || []).filter((d) => d.id !== Number(draftId));
  return latency({ ok: true });
});
