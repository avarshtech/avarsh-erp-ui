/**
 * Mock of the inward job orders (plan Phase 2): the list with KPIs, one order's view, creating an
 * order of type Job work, closing it once everything is back and billed, and cancelling it before
 * any material arrives. Never reaches the API.
 */
import dayjs from 'dayjs';
import { JO_STATUS, RISK } from '../../../utils/jobWorkInward/inwardConstants';
import { clone, latency, mockError, todayIso } from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { jobOrderContext, toRow } from './inwardMockContext';
import { jobOrderView } from './inwardMockOrderView';

const RISK_RANK = { [RISK.OVERDUE]: 0, [RISK.AT_RISK]: 1, [RISK.ON_TRACK]: 2 };
const allRows = (db, today) => db.jobOrders.map((jo) => toRow(jobOrderContext(db, jo, today)));

const matches = (r, f, today) => {
  const q = (f.q || '').trim().toLowerCase();
  if (q && ![r.orderNo, r.principalName, r.principalRef, r.styleNo, r.styleName].some((v) => String(v || '').toLowerCase().includes(q))) return false;
  if (f.status === 'OPEN' && !r.open) return false;
  if (f.status && !['OPEN', 'ALL'].includes(f.status) && r.status !== f.status) return false;
  if (f.principalId && r.principalId !== f.principalId) return false;
  if (f.scope && r.scope !== f.scope) return false;
  if (f.risk && r.risk !== f.risk) return false;
  if (f.waiting && !r.waiting) return false;
  if (f.readyToReturn && !(r.readyToReturn > 0)) return false;
  if (f.dueSoon && !(r.dueDate >= today && r.dueDate <= dayjs(today).add(7, 'day').format('YYYY-MM-DD') && r.status !== JO_STATUS.RETURNED)) return false;
  return true;
};

export const searchJobOrders = (filters = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const page = filters.page ?? 0;
  const size = filters.size ?? 25;
  const rows = allRows(db, today).filter((r) => matches(r, { status: 'OPEN', ...filters }, today))
    .sort((a, b) => Number(b.open) - Number(a.open) || RISK_RANK[a.risk] - RISK_RANK[b.risk] || Number(b.waiting) - Number(a.waiting)
      || String(a.dueDate).localeCompare(String(b.dueDate)));
  return latency({
    content: rows.slice(page * size, page * size + size), pageNumber: page, pageSize: size, totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)), last: (page + 1) * size >= rows.length,
  });
};

export const getJobOrderKpis = (filters = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const open = allRows(db, today).filter((r) => r.open && (!filters.principalId || r.principalId === filters.principalId));
  return latency({
    open: open.length,
    toMake: open.reduce((a, r) => a + Math.max(0, r.qty - r.returned), 0),
    waiting: open.filter((r) => r.waiting).length,
    dueSoon: open.filter((r) => matches(r, { dueSoon: true }, today)).length,
    overdue: open.filter((r) => r.risk === RISK.OVERDUE).length,
    readyToReturn: open.reduce((a, r) => a + r.readyToReturn, 0),
  });
};

export const listInwardFilterOptions = () => {
  const db = loadInwardDb();
  return latency({
    principals: db.principals.map((p) => ({ value: p.id, label: p.name })),
    jobOrders: db.jobOrders.filter((j) => j.status === 'OPEN')
      .map((j) => ({ value: j.id, label: `${j.orderNo} · ${j.styleNo} — ${db.principals.find((p) => p.id === j.principalId)?.name}`, principalId: j.principalId })),
  });
};

export const getJobOrder = (id) => {
  const db = loadInwardDb();
  const jo = db.jobOrders.find((j) => j.id === Number(id));
  if (!jo) return Promise.reject(mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 }));
  return latency(clone(jobOrderView(db, jobOrderContext(db, jo, todayIso()))));
};

/** Close once everything is back and billed; with pieces still out, only with a reason (short-close). */
export const closeJobOrder = (id, { reason = '' } = {}) => mutateInwardDb((db) => {
  const today = todayIso();
  const jo = db.jobOrders.find((j) => j.id === Number(id));
  if (!jo || jo.status !== 'OPEN') throw mockError('Only an open job order can be closed.', { status: 409, code: 'CONFLICT' });
  const { closeCheck } = jobOrderView(db, jobOrderContext(db, jo, today));
  if (closeCheck.blockers.length) throw mockError(closeCheck.blockers[0], { status: 409, code: 'CONFLICT', details: closeCheck.blockers.map((m) => ({ message: m })) });
  if (closeCheck.piecesOut > 0 && !reason.trim()) throw mockError(`${closeCheck.piecesOut} pieces are not back yet; give a reason to close short.`);
  jo.status = JO_STATUS.CLOSED;
  jo.closedAt = today;
  jo.closedReason = reason.trim() || 'Everything returned and billed.';
  jo.events.push({ at: today, by: 'You', text: `Closed: ${jo.closedReason}` });
  return latency({ id: jo.id, status: jo.status });
});

/** Cancel only before any of the principal's material has come in. */
export const cancelJobOrder = (id, { reason = '' } = {}) => mutateInwardDb((db) => {
  const jo = db.jobOrders.find((j) => j.id === Number(id));
  if (!jo || jo.status !== 'OPEN') throw mockError('Only an open job order can be cancelled.', { status: 409, code: 'CONFLICT' });
  if (db.inwards.some((i) => i.jobOrderId === jo.id && i.status === 'POSTED')) throw mockError('Material has come in on this order; close it instead.', { status: 409, code: 'CONFLICT' });
  if (!reason.trim()) throw mockError('Give a reason for cancelling.');
  jo.status = JO_STATUS.CANCELLED;
  jo.closedReason = reason.trim();
  jo.events.push({ at: todayIso(), by: 'You', text: `Cancelled: ${reason.trim()}` });
  return latency({ id: jo.id, status: jo.status });
});
