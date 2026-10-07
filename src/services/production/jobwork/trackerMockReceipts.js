/**
 * Mock of /api/v1/job-work/receipts and POST /jobs/{id}/receipts (plan 1a "Receipts"):
 * good / alter / rejected per colour × size at a stage; alter pieces are handed back for repair
 * and do not count; an earlier-stage receipt is a temporary transfer.
 */
import { JOB_STATUS, OPEN_JOB_STATUSES, RECEIPT_STATUS, STAGE_LABEL } from '../../../utils/jobWorkTracker/constants';
import { validateReceipt } from '../../../utils/jobWorkTracker/sheetRules';
import {
  clone, latency, loadTrackerDb, mockError, mutateTrackerDb, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';

const sumLines = (lines, key) => lines.reduce((a, l) => a + (Number(l[key]) || 0), 0);

const receiptRow = (db, r, today) => {
  const job = db.jobs.find((j) => j.id === r.jobId);
  const ctx = jobContext(db, job, today);
  return {
    ...r,
    jobNo: job.jobNo,
    orderNo: ctx.order.orderNo,
    styleNo: ctx.order.styleNo,
    vendorId: ctx.vendor.id,
    vendorName: ctx.vendor.name,
    stageLabel: STAGE_LABEL[r.stage],
    temporary: r.stage !== ctx.snapshot.finalStage,
    good: sumLines(r.lines, 'good'),
    rejected: sumLines(r.lines, 'rejected'),
    alter: sumLines(r.lines, 'alter'),
  };
};

export const searchReceipts = (filters = {}) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const q = (filters.q || '').trim().toLowerCase();
  const page = filters.page ?? 0;
  const size = filters.size ?? 25;
  const rows = db.receipts.map((r) => receiptRow(db, r, today)).filter((r) => {
    if (filters.jobId && r.jobId !== filters.jobId) return false;
    if (filters.vendorId && r.vendorId !== filters.vendorId) return false;
    if (filters.status && r.status !== filters.status) return false;
    return !q || [r.receiptNo, r.jobNo, r.orderNo, r.styleNo, r.vendorName, r.vendorDcNo].some((v) => String(v || '').toLowerCase().includes(q));
  }).sort((a, b) => b.receiptDate.localeCompare(a.receiptDate) || b.id - a.id);
  return latency({
    content: rows.slice(page * size, page * size + size), pageNumber: page, pageSize: size, totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)), last: (page + 1) * size >= rows.length,
  });
};

/** What the Receive drawer needs: stages, sizes, plan and what is already received per colour × size. */
export const getReceiptForm = (jobId) => {
  const db = loadTrackerDb();
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job) return Promise.reject(mockError('Job not found.', { code: 'NOT_FOUND', status: 404 }));
  const ctx = jobContext(db, job, todayIso());
  const receivedBySize = {};
  ctx.receipts.filter((r) => r.status === RECEIPT_STATUS.POSTED).forEach((r) => r.lines.forEach((l) => {
    const k = `${r.stage}|${l.colour}|${l.size}`;
    receivedBySize[k] = (receivedBySize[k] || 0) + (Number(l.good) || 0) + (Number(l.rejected) || 0);
  }));
  return latency(clone({
    jobId: job.id,
    jobNo: job.jobNo,
    vendorName: ctx.vendor.name,
    orderNo: ctx.order.orderNo,
    styleNo: ctx.order.styleNo,
    startDate: job.startDate,
    stages: ctx.stages,
    finalStage: ctx.snapshot.finalStage,
    sizes: ctx.order.sizes,
    colours: ctx.snapshot.colours,
    planBySize: ctx.plan,
    planByColour: ctx.snapshot.planByColour,
    receivedBySize,
    received: ctx.snapshot.received,
  }));
};

export const postReceipt = (jobId, payload) => mutateTrackerDb((db) => {
  const today = todayIso();
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job) throw mockError('Job not found.', { code: 'NOT_FOUND', status: 404 });
  if (!OPEN_JOB_STATUSES.includes(job.status)) throw mockError('Receipts are taken only on an open job.', { status: 409, code: 'CONFLICT' });
  const ctx = jobContext(db, job, today);
  const vendorJobIds = db.jobs.filter((j) => j.vendorId === job.vendorId).map((j) => j.id);
  const postedDcNos = db.receipts.filter((r) => vendorJobIds.includes(r.jobId) && r.status === RECEIPT_STATUS.POSTED).map((r) => r.vendorDcNo);
  const lines = (payload.lines || []).filter((l) => (Number(l.good) || 0) + (Number(l.alter) || 0) + (Number(l.rejected) || 0) > 0);
  const errors = validateReceipt({
    stage: payload.stage, stages: ctx.stages, lines, planByColour: ctx.snapshot.planByColour, received: ctx.snapshot.received,
    receiptDate: payload.receiptDate, today, jobStart: job.startDate, vendorDcNo: payload.vendorDcNo, postedDcNos,
  });
  if (errors.length) throw mockError(errors[0].message, { details: errors });
  const receipt = {
    id: nextId(db, 'receipt'),
    receiptNo: nextDocNo(db, 'JWR'),
    jobId: job.id,
    stage: payload.stage,
    receiptDate: payload.receiptDate,
    vendorDcNo: payload.vendorDcNo.trim(),
    vendorDcDate: payload.vendorDcDate || payload.receiptDate,
    status: RECEIPT_STATUS.POSTED,
    cancelReason: null,
    createdBy: 'You',
    lines: lines.map((l) => ({
      colour: l.colour, size: l.size, good: Number(l.good) || 0, alter: Number(l.alter) || 0, rejected: Number(l.rejected) || 0,
      rejectSource: (Number(l.rejected) || 0) > 0 ? l.rejectSource || null : null,
    })),
  };
  db.receipts.push(receipt);
  const after = jobContext(db, job, today);
  if (after.snapshot.completed) {
    job.status = JOB_STATUS.COMPLETED;
    job.completedAt = payload.receiptDate;
    job.events.push({ at: payload.receiptDate, by: 'You', text: 'Completed: every colour received in full' });
  } else if (job.status === JOB_STATUS.OPEN) job.status = JOB_STATUS.IN_PROGRESS;
  job.version += 1;
  return latency({ id: receipt.id, receiptNo: receipt.receiptNo, jobStatus: job.status });
});

export const cancelReceipt = (id, { reason } = {}) => mutateTrackerDb((db) => {
  const receipt = db.receipts.find((r) => r.id === Number(id));
  if (!receipt) throw mockError('Receipt not found.', { code: 'NOT_FOUND', status: 404 });
  if (receipt.status !== RECEIPT_STATUS.POSTED) throw mockError('This receipt is already cancelled.', { status: 409, code: 'CONFLICT' });
  if (!reason?.trim()) throw mockError('Give a reason for cancelling.');
  const job = db.jobs.find((j) => j.id === receipt.jobId);
  receipt.status = RECEIPT_STATUS.CANCELLED;
  receipt.cancelReason = reason.trim();
  // A completed job reopens; a short-closed job stays closed.
  if (job.status === JOB_STATUS.COMPLETED) {
    job.status = JOB_STATUS.IN_PROGRESS;
    job.completedAt = null;
  }
  job.version += 1;
  job.events.push({ at: todayIso(), by: 'You', text: `Receipt ${receipt.receiptNo} cancelled: ${reason.trim()}` });
  return latency({ id: receipt.id, status: receipt.status, jobStatus: job.status });
});
