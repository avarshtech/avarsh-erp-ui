/**
 * What the packing-list workspace says about a list's way through approval. The API sends `approval`
 * (the latest submission: its request, when and by whom; kept after the request ends) and `returned`
 * (why the list is a draft again: REFERRED_BACK, REJECTED or WITHDRAWN, by whom, when and why; cleared
 * when it is submitted again).
 */

const RETURNED_AS = {
  REFERRED_BACK: 'Referred back',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

/** "Referred back by Priya S. on 2026-11-18 10:05: <reason>"; a withdrawal has no reason, so none is shown. */
export const returnedText = (returned) => {
  if (!returned) return null;
  const head = `${RETURNED_AS[returned.kind] || 'Returned'} by ${returned.by || '—'} on ${returned.at || '—'}`;
  return returned.reason ? `${head}: ${returned.reason}` : head;
};

/** Whether the latest submission went to an approval flow: one that no flow applied to was final at once. */
const wentForApproval = (pl) => pl?.approval?.requestId != null;

/**
 * The History timeline's entries, oldest first: created; submitted for approval; sent back; finalised
 * (approved, when a flow's approver finalised it); the revision's reason; superseded; cancelled.
 */
export const historyItems = (pl) => [
  { content: `Created by ${pl.createdBy} on ${pl.createdAt}` },
  ...(wentForApproval(pl)
    ? [{ content: `Submitted for approval by ${pl.approval.submittedBy || '—'} on ${pl.approval.submittedAt || '—'}` }]
    : []),
  ...(pl.returned ? [{ content: returnedText(pl.returned), color: 'orange' }] : []),
  ...(pl.finalisedBy
    ? [{ content: `${wentForApproval(pl) ? 'Approved' : 'Finalised'} by ${pl.finalisedBy} on ${pl.finalSnapshot?.at}`, color: 'green' }]
    : []),
  ...(pl.reviseReason ? [{ content: `Revision ${pl.revision}: ${pl.reviseReason}`, color: 'orange' }] : []),
  ...(pl.supersededByPlId ? [{ content: 'Superseded by a later revision', color: 'gray' }] : []),
  ...(pl.cancelReason ? [{ content: `Cancelled: ${pl.cancelReason}`, color: 'red' }] : []),
];
