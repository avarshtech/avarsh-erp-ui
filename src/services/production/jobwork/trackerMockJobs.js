/**
 * Mock of /api/v1/job-work/jobs* (tracker, KPIs, drawer view, close, scope, stage shares).
 * Shapes follow the planned DTOs: JobWorkRowResponse, JobWorkKpiResponse, JobWorkViewResponse.
 */
import {
  DOC_TYPE, FINISHING_STAGES, JOB_STATUS, OPEN_JOB_STATUSES, OPEN_PULLBACK_STATUSES, PULLBACK_STATUS, RISK, STAGE_LABEL,
} from '../../../utils/jobWorkTracker/constants';
import { colourTotals, stageTotal } from '../../../utils/jobWorkTracker/planRules';
import { defaultShares, earnedPerPiece } from '../../../utils/jobWorkTracker/earnings';
import { isAfterDay, isBeforeDay } from '../../../utils/jobWorkTracker/workingDays';
import {
  clone, latency, loadTrackerDb, mockError, mutateTrackerDb, resetTrackerDb, todayIso,
} from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';

const vendorApproval = (vendor, today) => {
  if (!vendor?.jobWorkApprovedUntil) return 'MISSING';
  return isBeforeDay(vendor.jobWorkApprovedUntil, today) ? 'EXPIRED' : 'OK';
};

/** Materials sent per UOM, net of good vendor returns: "1,655 kg · 4,124 pcs". */
const materialsFor = (db, jobId) => {
  const rows = db.materials.filter((m) => m.jobId === jobId);
  const back = {};
  db.vendorReturns.filter((r) => r.jobId === jobId).forEach((r) => r.lines.forEach((l) => {
    back[l.materialId] = (back[l.materialId] || 0) + l.qty;
  }));
  const byUom = {};
  rows.forEach((m) => { byUom[m.uom] = (byUom[m.uom] || 0) + m.qty - (back[m.id] || 0); });
  return { byUom: Object.entries(byUom).map(([uom, qty]) => ({ uom, qty })), kinds: [...new Set(rows.map((m) => m.kind))] };
};

export const toRow = (db, ctx, today) => {
  const { job, order, vendor, branch, snapshot: s, stages, dueDate } = ctx;
  const openPullBack = ctx.pullBacks.find((p) => OPEN_PULLBACK_STATUSES.includes(p.status));
  return {
    id: job.id,
    jobNo: job.jobNo,
    version: job.version,
    status: job.status,
    orderId: order.id,
    orderNo: order.orderNo,
    buyer: order.buyer,
    styleNo: order.styleNo,
    styleName: order.styleName,
    shipDate: order.shipDate,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorApproval: vendorApproval(vendor, today),
    branchId: job.branchId,
    branchName: branch?.name,
    stages: stages.map((stage) => ({
      stage,
      label: STAGE_LABEL[stage],
      cum: s.totals[stage] || 0,
      plan: s.planTotals[stage] || 0,
      received: Object.values(s.received[stage] || {}).reduce((a, r) => a + r.good + r.rejected, 0),
    })),
    finalStage: s.finalStage,
    planTotal: s.planTotals[s.finalStage] || 0,
    shareTotal: Object.values(ctx.share).reduce((a, b) => a + b, 0),
    finalGood: s.finalGood,
    finalRejected: s.finalRejected,
    finalAlter: s.finalAlter,
    alterationPct: s.alterationPct,
    inProcess: s.inProcess,
    dueDate,
    revisedDue: job.revisedDue,
    projectedDate: s.projectedDate,
    bindingStage: s.bindingStage,
    risk: s.risk,
    riskReasons: s.riskReasons,
    stale: s.stale,
    noDueDate: s.noDueDate,
    readyToClose: s.readyToClose,
    completed: s.completed,
    lastEntryDate: s.lastEntryDate,
    latestFlag: s.latestFlag,
    latestIssue: s.latestIssue,
    materials: materialsFor(db, job.id),
    openPullBack: openPullBack ? { id: openPullBack.id, pbNo: openPullBack.pbNo, status: openPullBack.status } : null,
  };
};

const matches = (row, f) => {
  const q = (f.q || '').trim().toLowerCase();
  if (q && ![row.jobNo, row.orderNo, row.styleNo, row.styleName, row.vendorName, row.buyer].some((v) => String(v || '').toLowerCase().includes(q))) return false;
  if (f.vendorId && row.vendorId !== f.vendorId) return false;
  if (f.orderId && row.orderId !== f.orderId) return false;
  if (f.branchId && row.branchId !== f.branchId) return false;
  if (f.status === 'OPEN' && !OPEN_JOB_STATUSES.includes(row.status)) return false;
  if (f.status && f.status !== 'OPEN' && f.status !== 'ALL' && row.status !== f.status) return false;
  if (f.risk && row.risk !== f.risk) return false;
  if (f.stale && !row.stale) return false;
  if (f.readyToClose && !row.readyToClose) return false;
  if (f.noDueDate && !row.noDueDate) return false;
  const due = row.revisedDue || row.dueDate;
  if (f.dueFrom && (!due || isBeforeDay(due, f.dueFrom))) return false;
  if (f.dueTo && (!due || isAfterDay(due, f.dueTo))) return false;
  return true;
};

const RISK_ORDER = { [RISK.OVERDUE]: 0, [RISK.AT_RISK]: 1, [RISK.ON_TRACK]: 2 };

const allRows = (db, today) => db.jobs.map((job) => toRow(db, jobContext(db, job, today), today));

export const searchJobs = (filters = {}) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const page = filters.page ?? 0;
  const size = filters.size ?? 25;
  const rows = allRows(db, today).filter((r) => matches(r, { status: 'OPEN', ...filters }))
    .sort((a, b) => (RISK_ORDER[a.risk] - RISK_ORDER[b.risk]) || String(a.revisedDue || a.dueDate || '9999').localeCompare(String(b.revisedDue || b.dueDate || '9999')));
  const content = rows.slice(page * size, page * size + size);
  return latency({
    content, pageNumber: page, pageSize: size, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)),
    last: (page + 1) * size >= rows.length,
  });
};

export const getJobKpis = (filters = {}) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const rows = allRows(db, today).filter((r) => matches(r, { ...filters, status: 'OPEN', risk: undefined, stale: undefined }));
  return latency({
    open: rows.length,
    inProcess: rows.reduce((a, r) => a + r.inProcess, 0),
    overdue: rows.filter((r) => r.risk === RISK.OVERDUE).length,
    atRisk: rows.filter((r) => r.risk === RISK.AT_RISK).length,
    stale: rows.filter((r) => r.stale).length,
    noDueDate: rows.filter((r) => r.noDueDate).length,
    readyToClose: rows.filter((r) => r.readyToClose).length,
  });
};

export const getJobVendors = () => {
  const db = loadTrackerDb();
  const ids = new Set(db.jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).map((j) => j.vendorId));
  return latency(db.vendors.filter((v) => ids.has(v.id)).map((v) => ({
    id: v.id, name: v.name, city: v.city, openJobs: db.jobs.filter((j) => j.vendorId === v.id && OPEN_JOB_STATUSES.includes(j.status)).length,
  })));
};

export const listFilterOptions = () => {
  const db = loadTrackerDb();
  return latency({
    vendors: db.vendors.map((v) => ({ value: v.id, label: v.name })),
    orders: db.orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` })),
    branches: db.branches.map((b) => ({ value: b.id, label: b.name })),
  });
};

const stageHasActivity = (ctx, stage) => (ctx.snapshot.totals[stage] || 0) > 0
  || Object.keys(ctx.snapshot.received[stage] || {}).length > 0;

const sharesFrozen = (ctx) => ctx.pullBacks.some((p) => [PULLBACK_STATUS.PENDING_APPROVAL, PULLBACK_STATUS.APPROVED, PULLBACK_STATUS.SETTLED].includes(p.status));

export const getJob = (id) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const job = db.jobs.find((j) => j.id === Number(id));
  if (!job) return Promise.reject(mockError('Job not found.', { code: 'NOT_FOUND', status: 404 }));
  const ctx = jobContext(db, job, today);
  const s = ctx.snapshot;
  const workOrder = ctx.docs.find((d) => d.docType === DOC_TYPE.WORK_ORDER);
  const scope = job.finishingScope;
  const earningsByStage = ctx.stages.map((stage) => ({ stage, ...earnedPerPiece({ stage, docs: ctx.docs, finishingScope: scope }) }));
  const timeline = [
    ...ctx.entries.map((e) => ({ key: `e${e.id}`, at: e.date, kind: 'PROGRESS', entry: e, by: e.enteredBy })),
    ...ctx.receipts.map((r) => ({ key: `r${r.id}`, at: r.receiptDate, kind: 'RECEIPT', receipt: r, by: r.createdBy })),
    ...ctx.pullBacks.flatMap((p) => p.history.map((h, i) => ({ key: `p${p.id}-${i}`, at: h.at, kind: 'PULLBACK', pullBack: { id: p.id, pbNo: p.pbNo }, action: h.action, comment: h.comment, by: h.by }))),
    ...job.events.map((ev, i) => ({ key: `j${i}`, at: ev.at, kind: 'EVENT', text: ev.text, by: ev.by })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const latestEntry = ctx.entries[ctx.entries.length - 1] || null;
  return latency(clone({
    row: toRow(db, ctx, today),
    job: { ...job, dueDate: ctx.dueDate, plannedStart: ctx.plannedStart },
    order: ctx.order,
    vendor: ctx.vendor,
    docs: ctx.docs.map((d) => ({ ...d, plannedTotal: (d.lines || []).reduce((a, l) => a + l.plannedQty, 0) })),
    grid: {
      stages: ctx.stages, colours: s.colours, planByColour: s.planByColour, cells: s.cells, received: s.received, share: ctx.share,
      withdrawn: ctx.withdrawn, finalReceived: s.finalReceived,
    },
    snapshot: s,
    latestEntryId: latestEntry?.id || null,
    latestEntryVersion: latestEntry?.version ?? null,
    timeline,
    receipts: ctx.receipts,
    pullBacks: ctx.pullBacks.map((p) => ({ id: p.id, pbNo: p.pbNo, status: p.status, requestedAt: p.requestedAt })),
    finishing: workOrder ? {
      scope,
      locked: FINISHING_STAGES.filter((st) => scope.includes(st) && stageHasActivity(ctx, st)),
    } : null,
    shares: workOrder ? {
      docKey: workOrder.key, docNo: workOrder.docNo, rate: workOrder.rate, shares: workOrder.shares,
      cuts: ctx.docs.some((d) => d.docType === DOC_TYPE.CUTTING_PO),
      frozen: sharesFrozen(ctx),
      defaults: defaultShares({ cuts: ctx.docs.some((d) => d.docType === DOC_TYPE.CUTTING_PO), finishingScope: scope }),
    } : null,
    earningsByStage,
    planTotals: Object.fromEntries(ctx.stages.map((st) => [st, stageTotal(ctx.plan[st])])),
    shareByColour: ctx.share,
    buyerByColour: Object.fromEntries(ctx.order.colours.map((c) => [c.colour, Object.values(c.qty).reduce((a, b) => a + b, 0)])),
    sizeColumns: ctx.order.sizes,
    planBySize: ctx.plan,
    colourPlan: colourTotals(ctx.plan[s.finalStage]),
  }));
};

export const closeJob = (id, { version, reason } = {}) => mutateTrackerDb((db) => {
  const job = db.jobs.find((j) => j.id === Number(id));
  if (!job) throw mockError('Job not found.', { code: 'NOT_FOUND', status: 404 });
  if (version !== undefined && version !== job.version) throw mockError('This job changed since you opened it. Reload and try again.', { code: 'OPTIMISTIC_LOCK_CONFLICT', status: 409 });
  if (!OPEN_JOB_STATUSES.includes(job.status)) throw mockError('Only an open job can be short-closed.', { status: 409, code: 'CONFLICT' });
  if (!reason?.trim()) throw mockError('Give a reason for the short-close.');
  if (db.pullBacks.some((p) => p.jobId === job.id && OPEN_PULLBACK_STATUSES.includes(p.status))) {
    throw mockError('Settle or cancel the open pull-back before closing the job.', { status: 409, code: 'CONFLICT' });
  }
  job.status = JOB_STATUS.CLOSED;
  job.closedReason = reason.trim();
  job.closedAt = todayIso();
  job.version += 1;
  job.events.push({ at: todayIso(), by: 'You', text: `Short-closed: ${reason.trim()}` });
  return latency({ id: job.id, status: job.status, version: job.version });
});

export const updateJobScope = (id, { stages = [] } = {}) => mutateTrackerDb((db) => {
  const job = db.jobs.find((j) => j.id === Number(id));
  const ctx = jobContext(db, job, todayIso());
  const removed = job.finishingScope.filter((st) => !stages.includes(st));
  const blocked = removed.filter((st) => stageHasActivity(ctx, st));
  if (blocked.length) throw mockError(`${blocked.map((st) => STAGE_LABEL[st]).join(', ')} already has progress or receipts and cannot be switched off.`, { status: 409, code: 'CONFLICT' });
  job.finishingScope = FINISHING_STAGES.filter((st) => stages.includes(st));
  job.version += 1;
  job.events.push({ at: todayIso(), by: 'You', text: `Finishing scope: ${job.finishingScope.map((st) => STAGE_LABEL[st]).join(', ') || 'none (ends at Stitched)'}` });
  return latency({ scope: job.finishingScope });
});

export const updateStageShares = (jobId, { shares } = {}) => mutateTrackerDb((db) => {
  const job = db.jobs.find((j) => j.id === Number(jobId));
  const ctx = jobContext(db, job, todayIso());
  const wo = ctx.docs.find((d) => d.docType === DOC_TYPE.WORK_ORDER);
  if (!wo) throw mockError('This job has no vendor Work Order.');
  if (sharesFrozen(ctx)) throw mockError('Shares are frozen while a pull-back on this Work Order is pending, approved or settled.', { status: 409, code: 'CONFLICT' });
  const total = ['cut', 'sew', 'fin'].reduce((a, k) => a + (Number(shares?.[k]) || 0), 0);
  if (Math.abs(total - 100) > 0.05) throw mockError(`The shares add up to ${total}%; they must add up to 100%.`);
  db.docs.find((d) => d.key === wo.key).shares = { cut: Number(shares.cut) || 0, sew: Number(shares.sew) || 0, fin: Number(shares.fin) || 0 };
  return latency({ shares: db.docs.find((d) => d.key === wo.key).shares });
});

export const resetDemoData = () => {
  resetTrackerDb();
  return latency({ ok: true }, 300);
};
