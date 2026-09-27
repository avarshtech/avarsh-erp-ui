import dayjs from 'dayjs';
import { DATE_FORMAT } from './uiConstants';

/**
 * Job-work approval of a supplier on a date (default today). The approval runs to the
 * end of its valid-until day; an empty date means the job worker is not approved yet.
 *
 * @returns {{ status: 'approved'|'expired'|'missing', label: string, color: string }}
 */
export const jobWorkApproval = (validUntil, onDate = dayjs()) => {
  if (!validUntil) return { status: 'missing', label: 'Not approved', color: 'default' };
  const until = dayjs(validUntil);
  if (dayjs(onDate).isAfter(until, 'day')) {
    return { status: 'expired', label: `Expired ${until.format(DATE_FORMAT)}`, color: 'error' };
  }
  return { status: 'approved', label: `Approved to ${until.format(DATE_FORMAT)}`, color: 'success' };
};

/**
 * Can this supplier take a job-work PO for a process on a date (CPP BR-14 / VR-13,
 * GPO §13)? Lookups list ineligible job workers greyed with the first issue, never hidden.
 * The Cut Panel PO blocks on any issue; the Garment Process PO lets an unapproved or
 * untagged vendor through with a warning for the approver (`warnOnly` issues).
 *
 * `processId` null skips the capability check (the Garment Process PO knows its process
 * only once lines are added).
 */
export const vendorEligibility = (vendor, { processId = null, processLabel = 'this process', onDate = dayjs() } = {}) => {
  const issues = [];
  if (vendor.active === false) issues.push({ code: 'INACTIVE', text: 'Inactive' });
  if (!vendor.jobWorker) issues.push({ code: 'NOT_JOB_WORKER', text: 'Not a job worker' });
  else if (processId != null && !(vendor.processIds || []).includes(processId)) {
    issues.push({ code: 'NO_PROCESS', text: `Does not do ${processLabel}`, warnOnly: true });
  }
  const approval = jobWorkApproval(vendor.jobWorkApprovedUntil, onDate);
  if (approval.status === 'missing') issues.push({ code: 'APPROVAL_MISSING', text: 'Job-work approval missing', warnOnly: true });
  if (approval.status === 'expired') {
    issues.push({ code: 'APPROVAL_EXPIRED', text: `Approval expired ${dayjs(vendor.jobWorkApprovedUntil).format(DATE_FORMAT)}`, warnOnly: true });
  }
  return { eligible: issues.length === 0, issues, reason: issues[0]?.text ?? null, approval };
};
