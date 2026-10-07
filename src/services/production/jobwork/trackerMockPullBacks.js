/**
 * Mock of /api/v1/job-work/pull-backs* (plan 1e): request → manager approval (the approval engine,
 * simulated) → returns as trucks arrive → settle. Approval moves no goods: it holds the vendor POs'
 * net plan and sets the vendor's new date; the job's progress plan changes only as returns post.
 */
import {
  OPEN_JOB_STATUSES, OPEN_PULLBACK_STATUSES, PULLBACK_STATUS, SETTLE_ACTION, stageLabel,
} from '../../../utils/jobWorkTracker/constants';
import { clampOnApproval, validatePullBackLines } from '../../../utils/jobWorkTracker/pullBackRules';
import {
  clone, latency, loadTrackerDb, mockError, mutateTrackerDb, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import {
  earningsFor, isCmt, pullBackContext, returnedByColour, suggestionFor, withdrawalRows,
} from './trackerMockPullBackContext';

const qtyOf = (pb, l) => (pb.status === PULLBACK_STATUS.APPROVED || pb.status === PULLBACK_STATUS.SETTLED
  ? Number(l.approved) || 0 : Number(l.requested) || 0);

const summarise = (db, pb, today) => {
  const job = db.jobs.find((j) => j.id === pb.jobId);
  const { ctx } = pullBackContext(db, job, today, pb.id);
  const back = returnedByColour(db.pullBackReturns, pb.id);
  const requestedQty = pb.lines.reduce((a, l) => a + (Number(l.requested) || 0), 0);
  const approvedQty = pb.lines.reduce((a, l) => a + (Number(l.approved) || 0), 0);
  return {
    id: pb.id, pbNo: pb.pbNo, status: pb.status, reason: pb.reason, jobId: job.id, jobNo: job.jobNo,
    vendorId: ctx.vendor.id, vendorName: ctx.vendor.name, orderNo: ctx.order.orderNo, styleNo: ctx.order.styleNo,
    requestedQty, approvedQty: pb.status === PULLBACK_STATUS.APPROVED || pb.status === PULLBACK_STATUS.SETTLED ? approvedQty : null,
    returnedQty: Object.values(back).reduce((a, b) => a + b, 0),
    earnedEstimate: earningsFor(ctx, pb.lines.map((l) => ({ stage: l.stage, qty: qtyOf(pb, l) }))).total,
    requestedAt: pb.requestedAt, targetDate: pb.targetDate, vendorNewDue: pb.vendorNewDue,
  };
};

export const listPullBacks = (filters = {}) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const q = (filters.q || '').trim().toLowerCase();
  const rows = db.pullBacks.map((pb) => summarise(db, pb, today)).filter((r) => {
    if (filters.status === 'OPEN' && !OPEN_PULLBACK_STATUSES.includes(r.status)) return false;
    if (filters.status && filters.status !== 'OPEN' && r.status !== filters.status) return false;
    if (filters.vendorId && r.vendorId !== filters.vendorId) return false;
    return !q || [r.pbNo, r.jobNo, r.orderNo, r.styleNo, r.vendorName].some((v) => String(v || '').toLowerCase().includes(q));
  }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id - a.id);
  return latency(rows);
};

/** Everything the request form needs for a job: pieces at each stage, what is available, the suggestion. */
export const getPullBackForm = (jobId) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job) return Promise.reject(mockError('Job not found.', { code: 'NOT_FOUND', status: 404 }));
  const pbc = pullBackContext(db, job, today);
  const { ctx } = pbc;
  const suggestion = suggestionFor(pbc, today);
  const open = ctx.pullBacks.find((p) => OPEN_PULLBACK_STATUSES.includes(p.status));
  return latency(clone({
    jobId: job.id, jobNo: job.jobNo, vendorName: ctx.vendor.name, orderNo: ctx.order.orderNo, styleNo: ctx.order.styleNo,
    shipDate: ctx.order.shipDate, dueDate: ctx.dueDate, revisedDue: job.revisedDue, stages: ctx.stages,
    finalStage: ctx.snapshot.finalStage, colours: ctx.snapshot.colours, pieces: pbc.pieces, available: pbc.available,
    targetDate: pbc.targetDate, suggestion, rates: ctx.snapshot.rates, projectedDate: ctx.snapshot.projectedDate,
    perPiece: Object.fromEntries(['NOT_STARTED', ...ctx.stages].map((st) => [st, earningsFor(ctx, [{ stage: st, qty: 1 }]).total])),
    cmt: isCmt(ctx), openPullBack: open ? { id: open.id, pbNo: open.pbNo, status: open.status } : null,
  }));
};

export const getPullBack = (id) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  if (!pb) return Promise.reject(mockError('Pull-back not found.', { code: 'NOT_FOUND', status: 404 }));
  const job = db.jobs.find((j) => j.id === pb.jobId);
  const pbc = pullBackContext(db, job, today, pb.id);
  const { ctx } = pbc;
  const back = returnedByColour(db.pullBackReturns, pb.id);
  const lineQty = pb.lines.map((l) => ({ colour: l.colour, stage: l.stage, qty: qtyOf(pb, l) }));
  const approvedByColour = {};
  pb.lines.forEach((l) => { approvedByColour[l.colour] = (approvedByColour[l.colour] || 0) + (Number(l.approved) || 0); });
  const { warnings } = validatePullBackLines({ lines: pb.lines, stages: ctx.stages, available: pbc.available, pieces: pbc.pieces });
  return latency(clone({
    ...pb,
    stageLabels: Object.fromEntries(pb.lines.map((l) => [l.stage, stageLabel(l.stage)])),
    job: { id: job.id, jobNo: job.jobNo, status: job.status, revisedDue: job.revisedDue, dueDate: ctx.dueDate, finishingScope: job.finishingScope, branchName: ctx.branch?.name },
    vendor: { id: ctx.vendor.id, name: ctx.vendor.name, phone: ctx.vendor.phone, contactPerson: ctx.vendor.contactPerson },
    order: { id: ctx.order.id, orderNo: ctx.order.orderNo, styleNo: ctx.order.styleNo, styleName: ctx.order.styleName, shipDate: ctx.order.shipDate, sizes: ctx.order.sizes },
    stages: ctx.stages,
    finalStage: ctx.snapshot.finalStage,
    pieces: pbc.pieces,
    available: pbc.available,
    warnings,
    earnings: earningsFor(ctx, lineQty),
    withdrawals: withdrawalRows(ctx, lineQty, pb.status !== PULLBACK_STATUS.SETTLED),
    approvedByColour,
    returnedByColour: back,
    returns: db.pullBackReturns.filter((r) => r.pullBackId === pb.id),
    vendorReturns: db.vendorReturns.filter((r) => r.pullBackId === pb.id),
    draftPos: (db.draftPos || []).filter((d) => d.pullBackId === pb.id),
    allArrived: Object.keys(approvedByColour).length > 0 && Object.entries(approvedByColour).every(([c, q]) => (back[c] || 0) >= q),
  }));
};

const assertEditable = (pb) => {
  if (![PULLBACK_STATUS.DRAFT, PULLBACK_STATUS.REFERRED_BACK].includes(pb.status)) {
    throw mockError('Only a draft or referred-back pull-back can be changed.', { status: 409, code: 'CONFLICT' });
  }
};

const cleanLines = (db, lines) => (lines || []).filter((l) => (Number(l.requested) || 0) > 0).map((l) => ({
  id: l.id || nextId(db, 'pullBackLine'), colour: l.colour, stage: l.stage, suggested: Number(l.suggested) || 0,
  requested: Number(l.requested) || 0, approved: null, backToVendor: 0, writtenOff: 0, writeOffReason: null,
}));

export const createPullBack = (jobId, payload = {}) => mutateTrackerDb((db) => {
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job || !OPEN_JOB_STATUSES.includes(job.status)) throw mockError('Pull-backs are raised on open jobs only.', { status: 409, code: 'CONFLICT' });
  const open = db.pullBacks.find((p) => p.jobId === job.id && OPEN_PULLBACK_STATUSES.includes(p.status));
  if (open) throw mockError(`${open.pbNo} is still open on this job; finish or cancel it first.`, { status: 409, code: 'CONFLICT' });
  const pb = {
    id: nextId(db, 'pullBack'), pbNo: nextDocNo(db, 'JPB'), jobId: job.id, status: PULLBACK_STATUS.DRAFT,
    reason: payload.reason, remarks: payload.remarks || '', targetDate: payload.targetDate || null,
    vendorNewDue: payload.vendorNewDue || null, prevRevisedDue: null, earnedEstimate: 0,
    requestedBy: 'You', requestedAt: todayIso(), history: [], lines: cleanLines(db, payload.lines), withdrawals: [], settledAt: null,
  };
  db.pullBacks.push(pb);
  return latency({ id: pb.id, pbNo: pb.pbNo });
});

export const updatePullBack = (id, payload = {}) => mutateTrackerDb((db) => {
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  assertEditable(pb);
  Object.assign(pb, {
    reason: payload.reason ?? pb.reason, remarks: payload.remarks ?? pb.remarks,
    targetDate: payload.targetDate ?? pb.targetDate, vendorNewDue: payload.vendorNewDue ?? pb.vendorNewDue,
    lines: payload.lines ? cleanLines(db, payload.lines) : pb.lines,
  });
  return latency({ id: pb.id });
});

export const submitPullBack = (id) => mutateTrackerDb((db) => {
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  assertEditable(pb);
  if (!pb.reason) throw mockError('Pick a reason.');
  const job = db.jobs.find((j) => j.id === pb.jobId);
  const pbc = pullBackContext(db, job, today, pb.id);
  const { errors, warnings } = validatePullBackLines({ lines: pb.lines, stages: pbc.ctx.stages, available: pbc.available, pieces: pbc.pieces });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  pb.status = PULLBACK_STATUS.PENDING_APPROVAL;
  pb.earnedEstimate = earningsFor(pbc.ctx, pb.lines.map((l) => ({ stage: l.stage, qty: l.requested }))).total;
  pb.history.push({ action: 'SUBMITTED', by: 'You', at: today, comment: '' });
  return latency({ id: pb.id, status: pb.status, warnings });
});

/** Stand-in for the approval engine's decision (web or owner app). action: APPROVE | REJECT | REFER_BACK. */
export const decidePullBack = (id, { action, comment = '' } = {}) => mutateTrackerDb((db) => {
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  if (pb?.status !== PULLBACK_STATUS.PENDING_APPROVAL) throw mockError('Only a pull-back pending approval can be decided.', { status: 409, code: 'CONFLICT' });
  const job = db.jobs.find((j) => j.id === pb.jobId);
  if (action === 'REJECT' || action === 'REFER_BACK') {
    if (!comment.trim()) throw mockError('Give a reason.');
    pb.status = action === 'REJECT' ? PULLBACK_STATUS.REJECTED : PULLBACK_STATUS.REFERRED_BACK;
    pb.history.push({ action: action === 'REJECT' ? 'REJECTED' : 'REFERRED_BACK', by: 'You (manager)', at: today, comment });
    return latency({ id: pb.id, status: pb.status });
  }
  // Approve: clamp to what is still available (the vendor may have kept working since the request).
  const pbc = pullBackContext(db, job, today, pb.id);
  const clamped = clampOnApproval({ lines: pb.lines, available: pbc.available });
  pb.lines = pb.lines.map((l) => ({ ...l, approved: clamped.find((c) => c.id === l.id).approved }));
  const cut = pb.lines.reduce((a, l) => a + l.requested - l.approved, 0);
  pb.status = PULLBACK_STATUS.APPROVED;
  pb.earnedEstimate = earningsFor(pbc.ctx, pb.lines.map((l) => ({ stage: l.stage, qty: l.approved }))).total;
  pb.history.push({ action: 'APPROVED', by: 'You (manager)', at: today, comment: cut > 0 ? `${comment} (clamped by ${cut}: the vendor moved on since the request)`.trim() : comment });
  if (pb.vendorNewDue) {
    pb.prevRevisedDue = job.revisedDue || null;
    job.revisedDue = pb.vendorNewDue;
  }
  job.progressSeq += 1;
  job.version += 1;
  job.events.push({ at: today, by: 'You (manager)', text: `Pull-back ${pb.pbNo} approved${pb.vendorNewDue ? `; vendor's new date ${pb.vendorNewDue}` : ''}` });
  return latency({ id: pb.id, status: pb.status, clampedBy: cut });
});

/** Settle: per colour, what was approved but never arrived goes back to the vendor or is written off. */
export const settlePullBack = (id, { colours = [] } = {}) => mutateTrackerDb((db) => {
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  if (pb?.status !== PULLBACK_STATUS.APPROVED) throw mockError('Only an approved pull-back can be settled.', { status: 409, code: 'CONFLICT' });
  const back = returnedByColour(db.pullBackReturns, pb.id);
  const approved = {};
  pb.lines.forEach((l) => { approved[l.colour] = (approved[l.colour] || 0) + l.approved; });
  Object.entries(approved).forEach(([colour, qty]) => {
    let balance = Math.max(0, qty - (back[colour] || 0));
    if (!balance) return;
    const choice = colours.find((c) => c.colour === colour);
    if (!choice?.action) throw mockError(`Say what happens to the ${balance} ${colour} pieces that never arrived.`);
    if (choice.action === SETTLE_ACTION.WRITE_OFF && !choice.reason?.trim()) throw mockError(`Give a reason for writing off ${colour}.`);
    [...pb.lines].filter((l) => l.colour === colour).reverse().forEach((l) => {
      const take = Math.min(balance, l.approved);
      if (choice.action === SETTLE_ACTION.WRITE_OFF) { l.writtenOff = take; l.writeOffReason = choice.reason.trim(); } else l.backToVendor = take;
      balance -= take;
    });
  });
  pb.status = PULLBACK_STATUS.SETTLED;
  pb.settledAt = today;
  pb.history.push({ action: 'SETTLED', by: 'You', at: today, comment: '' });
  return latency({ id: pb.id, status: pb.status });
});

export const cancelPullBack = (id, { reason = '' } = {}) => mutateTrackerDb((db) => {
  const today = todayIso();
  const pb = db.pullBacks.find((p) => p.id === Number(id));
  if (!pb || [PULLBACK_STATUS.SETTLED, PULLBACK_STATUS.CANCELLED, PULLBACK_STATUS.REJECTED].includes(pb.status)) {
    throw mockError('This pull-back can no longer be cancelled.', { status: 409, code: 'CONFLICT' });
  }
  let warning = null;
  if (pb.status === PULLBACK_STATUS.APPROVED) {
    if (!reason.trim()) throw mockError('Give a reason for cancelling an approved pull-back.');
    if (db.pullBackReturns.some((r) => r.pullBackId === pb.id && r.status === 'POSTED')) throw mockError('Goods have already come back on this pull-back; settle it instead.', { status: 409, code: 'CONFLICT' });
    if ((db.draftPos || []).some((d) => d.pullBackId === pb.id)) throw mockError('An in-house PO is linked to this pull-back; remove it first.', { status: 409, code: 'CONFLICT' });
    const job = db.jobs.find((j) => j.id === pb.jobId);
    if (pb.vendorNewDue && (job.revisedDue || null) === pb.vendorNewDue) job.revisedDue = pb.prevRevisedDue || null;
    else if (pb.vendorNewDue) warning = 'The vendor\'s date was changed on a daily sheet since approval; it was left as it is.';
    job.progressSeq += 1;
    job.events.push({ at: today, by: 'You', text: `Pull-back ${pb.pbNo} cancelled: ${reason.trim()}` });
  }
  pb.status = PULLBACK_STATUS.CANCELLED;
  pb.history.push({ action: 'CANCELLED', by: 'You', at: today, comment: reason });
  return latency({ id: pb.id, status: pb.status, warning });
});
