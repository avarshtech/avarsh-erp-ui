/**
 * Which actions the Cut Panel PO action bar offers (PRD §18.1 ⑥, §16.3, §6): by status,
 * open amendment and permission. Pure — the bar renders the list in order.
 *
 * `s` = { doc, rev, dirty, docDirty, can, isMaker, superuser, received, username }
 * Each item: { key, label, primary?, danger?, dialog?, disabledReason? } — `dialog` names the
 * reason dialog the action needs; the bar calls on[key] otherwise. Past Draft, unsaved edits
 * to the live PO (details, notes) must be saved before any other action, which would
 * otherwise act on the stored PO and drop them.
 */
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

const REASON_STATUSES = [S.APPROVED, S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED];

export const cppActionButtons = ({ doc, rev, dirty, docDirty, can, isMaker, superuser, received, username }) => {
  const out = [];
  const st = doc.status;
  const unsaved = st !== S.DRAFT && docDirty ? 'Save your changes first.' : null;
  const add = (show, item) => { if (show) out.push(unsaved && item.key !== 'back' && !item.disabledReason ? { ...item, disabledReason: unsaved } : item); };
  const pending = doc.pendingRevision;
  add(true, { key: 'back', label: st === S.DRAFT && can.edit ? 'Cancel' : 'Back to list' });
  add(doc.id, { key: 'print', label: 'Print vendor copy' });
  if (unsaved && can.edit) out.push({ key: 'saveDetails', label: 'Save changes', primary: true });
  if (st === S.DRAFT) {
    add(doc.id && can.delete, { key: 'remove', label: 'Delete draft', danger: true, confirm: true });
    add(doc.id && can.cancel, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
    add(can.edit, { key: 'save', label: 'Save Draft' });
    add(can.submit, { key: 'submit', label: 'Submit', primary: true });
    return out;
  }
  if (st === S.SUBMITTED) {
    add(can.edit && (doc.createdByUser === username || superuser), { key: 'recall', label: 'Recall' });
    add(can.referBack, { key: 'sendBack', label: 'Send back', dialog: 'sendBack' });
    add(can.reject, { key: 'reject', label: 'Reject', danger: true, dialog: 'reject' });
    add(can.approve, { key: 'approve', label: 'Approve', primary: true, disabledReason: isMaker && !superuser ? 'You raised, edited or submitted this PO — someone else approves it (BR-15).' : null });
    return out;
  }
  if (pending?.status === S.DRAFT) {
    add(can.edit, { key: 'dropRev', label: 'Discard amendment', danger: true, dialog: 'dropRev' });
    add(can.edit && dirty, { key: 'saveRev', label: 'Save amendment' });
    add(can.edit, { key: 'submitRev', label: `Submit amendment R${pending.revisionNo}`, primary: true });
    return out;
  }
  if (pending?.status === S.SUBMITTED) {
    add(can.referBack, { key: 'sendBackRev', label: 'Send back amendment', dialog: 'sendBackRev' });
    add(can.reject, { key: 'rejectRev', label: 'Reject amendment', danger: true, dialog: 'dropRev' });
    const maker = [pending.createdByUser, pending.modifiedByUser, pending.submittedByUser].includes(username);
    add(can.approve, { key: 'approveRev', label: `Approve amendment R${pending.revisionNo}`, primary: true, disabledReason: maker && !superuser ? 'You raised, edited or submitted this amendment — someone else approves it.' : null });
    return out;
  }
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.cancel && !received, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
  add(REASON_STATUSES.includes(st) && can.cancel, { key: 'shortClose', label: st === S.COMPLETED ? 'Close' : 'Close short', danger: st !== S.COMPLETED, dialog: 'shortClose' });
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.edit && !received && !rev, { key: 'amend', label: 'Amend', dialog: 'amend' });
  add(st === S.APPROVED && can.edit, { key: 'send', label: 'Send to Vendor', primary: true });
  return out;
};
