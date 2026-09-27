/**
 * Which actions the Garment Process PO action bar offers (PRD §16, §19): by status and
 * permission. Pure — the bar renders the list in order.
 *
 * `s` = { doc, can, isCreator, superuser, received, blocked }
 * Each item: { key, label, primary?, danger?, dialog?, disabledReason? } — `dialog` names
 * the reason dialog the action needs; the bar calls on[key] otherwise.
 */
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

export const gpoActionButtons = ({ doc, can, isCreator, superuser, received, blocked }) => {
  const out = [];
  const add = (show, item) => { if (show) out.push(item); };
  const st = doc.status;
  add(true, { key: 'back', label: st === S.DRAFT && can.edit ? 'Cancel' : 'Back to list' });
  add(doc.id, { key: 'print', label: 'Print' });
  if (st === S.DRAFT) {
    add(doc.id && can.cancel, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
    add(can.edit, { key: 'save', label: 'Save Draft' });
    add(can.submit, { key: 'submit', label: 'Submit for Approval', primary: true, disabledReason: blocked ? 'Fix the issues in the action bar first (§19).' : null });
    return out;
  }
  if (st === S.SUBMITTED) {
    add(can.edit && (isCreator || superuser), { key: 'recall', label: 'Recall' });
    add(can.reject, { key: 'reject', label: 'Reject to Draft', danger: true, dialog: 'reject' });
    add(can.approve, { key: 'approve', label: 'Approve', primary: true, disabledReason: isCreator && !superuser ? 'You raised this PO — someone else approves it.' : null });
    return out;
  }
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.edit, { key: 'amend', label: 'Amend dates / remarks' });
  add(st === S.APPROVED && can.cancel && !received, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
  add([S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED].includes(st) && can.cancel,
    { key: 'shortClose', label: st === S.COMPLETED ? 'Close' : 'Close short', danger: st !== S.COMPLETED, dialog: 'shortClose' });
  add(st === S.APPROVED && can.approve, { key: 'send', label: 'Send to Vendor', primary: true });
  return out;
};
