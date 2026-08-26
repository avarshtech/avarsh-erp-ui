/**
 * Sample dashboard aggregates (future GET /sample-requests/dashboard).
 * Computed live from the mock store — KPI counts, 48h alert list, deadline
 * tracker rows, status/type breakdowns and quick stats (PRD v3 §12).
 */
import dayjs from 'dayjs';
import { loadDb } from './srMockStore';
import { daysRemaining, deadlineRag } from '../../utils/deadlineUtils';
import { SR_STATUS } from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const ACTIVE = [SR_STATUS.DRAFT, SR_STATUS.SUBMITTED, SR_STATUS.IN_PRODUCTION, SR_STATUS.DISPATCHED];
const PRE_DISPATCH = [SR_STATUS.DRAFT, SR_STATUS.SUBMITTED, SR_STATUS.IN_PRODUCTION];

export const getSampleDashboard = async () => {
  await delay();
  const db = loadDb();
  const rows = db.requests.map((sr) => ({
    id: sr.id,
    srNo: sr.srNo,
    orderNo: sr.orderNo,
    styleNo: sr.styleNo,
    sampleTypeName: sr.sampleTypeName,
    status: sr.status,
    dispatchDeadline: sr.dispatchDeadline,
    buyerApprovalDeadline: sr.buyerApprovalDeadline,
    days: daysRemaining(sr.dispatchDeadline),
    rag: deadlineRag(daysRemaining(sr.dispatchDeadline)),
  }));

  const overdue = rows.filter((r) => PRE_DISPATCH.includes(r.status) && r.days != null && r.days < 0);
  const critical = rows.filter((r) => PRE_DISPATCH.includes(r.status) && r.days != null && r.days <= 2);

  // Approved within the current calendar week (PRD §12.5)
  const weekStart = dayjs().startOf('week');
  const approvedThisWeek = db.requests.filter((sr) => sr.status === SR_STATUS.APPROVED
    && (sr.statusHistory || []).some((h) => h.status === SR_STATUS.APPROVED
      && dayjs(h.date).isAfter(weekStart.subtract(1, 'day')))).length;

  const byStatus = {};
  const byType = {};
  db.requests.forEach((sr) => {
    byStatus[sr.status] = (byStatus[sr.status] || 0) + 1;
    if (ACTIVE.includes(sr.status)) {
      byType[sr.sampleTypeName] = (byType[sr.sampleTypeName] || 0) + 1;
    }
  });

  return {
    kpis: {
      activeSamples: rows.filter((r) => ACTIVE.includes(r.status)).length,
      overdueSamples: overdue.length,
      awaitingBuyerFeedback: rows.filter((r) => r.status === SR_STATUS.DISPATCHED).length,
      // "Comments logged but action pending" (PRD §12.1): either resting at
      // Feedback Received awaiting the decision, or Dispatched with a saved
      // comment draft.
      pendingApprovals: db.requests.filter((sr) => sr.status === SR_STATUS.FEEDBACK_RECEIVED
        || (sr.status === SR_STATUS.DISPATCHED && sr.feedback)).length,
    },
    alerts: critical
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .map((r) => ({ ...r, overdue: r.days < 0 })),
    deadlines: rows
      .filter((r) => ACTIVE.includes(r.status) && r.dispatchDeadline)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
      .slice(0, 10),
    byStatus,
    byType,
    quickStats: {
      dueToday: rows.filter((r) => PRE_DISPATCH.includes(r.status) && r.days === 0).length,
      overdue: overdue.length,
      approvedThisWeek,
    },
  };
};
