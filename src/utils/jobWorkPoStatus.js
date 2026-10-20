/**
 * Job-work PO lifecycle — Cut Panel PO (CPP) and Garment Process PO (GPO).
 *
 *   Draft → Submitted → Approved → Sent to Vendor → Partially Completed → Completed → Closed
 *
 *   Cut Panel PO     Reject is terminal (Rejected); Send back and Recall return to Draft.
 *                    Balance is consumed on approval (PRD BR-10).
 *   Garment Process  Reject and Recall return to Draft — there is no Rejected status.
 *   PO               Balance is consumed from submission (PRD §10).
 *   Both             Cancel (terminal) releases the allocation; Close short releases the
 *                    unreceived part. Partially Completed / Completed come from receipts.
 */
import dayjs from 'dayjs';

export const JOB_WORK_PO_TYPE = { CPP: 'CPP', GPO: 'GPO' };

export const JOB_WORK_PO_TYPE_LABEL = { CPP: 'Cut Panel PO', GPO: 'Garment Process PO' };

export const JW_PO_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  SENT_TO_VENDOR: 'SENT_TO_VENDOR',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

const S = JW_PO_STATUS;

const LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  SENT_TO_VENDOR: 'Sent to Vendor',
  PARTIALLY_COMPLETED: 'Partially Completed',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const jobWorkPoStatusLabel = (status) => LABELS[status] || status || '—';

export const jobWorkPoStatusOptions = (type) => Object.keys(LABELS)
  .filter((s) => type !== JOB_WORK_PO_TYPE.GPO || s !== S.REJECTED)
  .map((value) => ({ value, label: LABELS[value] }));

const FINISHED = [S.COMPLETED, S.CLOSED, S.REJECTED, S.CANCELLED];

export const isOpenPo = (status) => !FINISHED.includes(status);

/** The date a PO is due back: required delivery (CPP), expected return (GPO). */
export const poDueDate = (doc) => (doc.type === JOB_WORK_PO_TYPE.GPO ? doc.expectedReturnDate : doc.requiredDeliveryDate);

export const APPROVED_NOT_SENT_DAYS = 3;

/**
 * Derived flags (CPP PRD §17.3; GPO overdue returns). `context` carries what the PO cannot
 * know about itself: { orderCancelled, requirementChanged }. Overdue replaces the status
 * pill in list views (FR-28).
 */
export const poFlags = (doc, { orderCancelled = false, requirementChanged = false, today = dayjs() } = {}) => {
  const flags = [];
  const due = poDueDate(doc);
  if (due && isOpenPo(doc.status) && dayjs(today).isAfter(dayjs(due), 'day')) {
    flags.push({ key: 'OVERDUE', label: 'Overdue', color: 'error' });
  }
  if (doc.status === S.APPROVED && doc.approvedOn
    && dayjs(today).diff(dayjs(doc.approvedOn), 'day') > APPROVED_NOT_SENT_DAYS) {
    flags.push({ key: 'APPROVED_NOT_SENT', label: 'Approved, not sent', color: 'warning' });
  }
  if (orderCancelled && isOpenPo(doc.status)) flags.push({ key: 'ORDER_CANCELLED', label: 'Order cancelled', color: 'volcano' });
  if (requirementChanged && isOpenPo(doc.status)) flags.push({ key: 'REQUIREMENT_CHANGED', label: 'Requirement changed', color: 'magenta' });
  return flags;
};
