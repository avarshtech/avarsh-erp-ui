/**
 * Which actions the Cut Panel PO action bar offers (PRD §18.1, §16.3, §6): by status,
 * view or edit mode, open amendment and permission. Pure — the bar renders the list in order.
 *
 * `s` = { doc, rev, dirty, can, superuser, issued, received, withVendor, userId, editing, detailsEditable }
 * Each item: { key, label, primary?, danger?, dialog?, disabledReason? } — `dialog` names the
 * reason dialog the action needs; the bar calls on[key] otherwise. Edit mode offers only its
 * saves: Save Draft and Submit for Approval on a draft; past Draft, where it covers the live
 * PO's details and notes, Save changes. Viewed, the PO offers its workflow and Edit. Back is the
 * page header's arrow and Print sits in the page header. Approve, send back and reject — of the
 * PO and of an amendment — are the approval engine's, in the Approval panel (decision D1).
 */
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

const REASON_STATUSES = [S.APPROVED, S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED];

export const cppActionButtons = ({ doc, rev, dirty, can, superuser, issued, received, withVendor, userId, editing, detailsEditable }) => {
  const out = [];
  const st = doc.status;
  const add = (show, item) => { if (show) out.push(item); };
  const pending = doc.pendingRevision;
  if (st === S.DRAFT) {
    if (editing) {
      add(can.edit, { key: 'save', label: 'Save Draft' });
      add(can.submit, { key: 'submit', label: 'Submit for Approval', primary: true });
      return out;
    }
    add(doc.id && can.delete, { key: 'remove', label: 'Delete draft', danger: true, confirm: true });
    add(doc.id && can.cancel, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
    add(can.edit, { key: 'edit', label: 'Edit', primary: true });
    return out;
  }
  if (editing && detailsEditable) {
    add(true, { key: 'saveDetails', label: 'Save changes', primary: true });
    return out;
  }
  if (st === S.SUBMITTED) {
    add(can.edit && (String(doc.createdById) === String(userId) || superuser), { key: 'recall', label: 'Recall' });
    return out;
  }
  if (pending?.status === S.DRAFT) {
    add(can.edit, { key: 'dropRev', label: 'Discard amendment', danger: true, dialog: 'dropRev' });
    add(can.edit && dirty, { key: 'saveRev', label: 'Save amendment' });
    add(can.edit, { key: 'submitRev', label: `Submit amendment R${pending.revisionNo}`, primary: true });
    return out;
  }
  if (pending?.status === S.SUBMITTED) {
    add(can.edit, { key: 'dropRev', label: 'Withdraw amendment', danger: true, dialog: 'dropRev' });
    return out;
  }
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.cancel && !issued && !received, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
  add(REASON_STATUSES.includes(st) && can.cancel, {
    key: 'shortClose', label: st === S.COMPLETED ? 'Close' : 'Close short', danger: st !== S.COMPLETED, dialog: 'shortClose',
    disabledReason: withVendor ? 'Panels are still with the job worker — receive them back first.' : null,
  });
  add(detailsEditable, { key: 'edit', label: 'Edit' });
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.edit && !received && !rev, { key: 'amend', label: 'Amend', dialog: 'amend' });
  add(st === S.APPROVED && can.edit, { key: 'send', label: 'Send to Vendor', primary: true });
  return out;
};
