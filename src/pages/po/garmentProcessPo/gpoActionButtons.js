/**
 * Which actions the Garment Process PO action bar offers (PRD §16, §19): by status and
 * permission. Pure — the bar renders the list in order.
 *
 * `s` = { doc, can, superuser, userId, issued, withVendor, editing, blocked }
 * A draft in edit mode offers only Save Draft and Submit for Approval; viewed, it offers Cancel PO and Edit.
 * Back is the page header's arrow and Print sits in the page header.
 * Each item: { key, label, primary?, danger?, dialog?, disabledReason? } — `dialog` names
 * the reason dialog the action needs; the bar calls on[key] otherwise. Approve and reject are
 * the approval engine's, in the Approval panel (decision D1).
 */
import { JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

export const gpoActionButtons = ({ doc, can, superuser, userId, issued, withVendor, editing, blocked }) => {
  const out = [];
  const add = (show, item) => { if (show) out.push(item); };
  const st = doc.status;
  if (st === S.DRAFT && editing) {
    add(can.edit, { key: 'save', label: 'Save Draft' });
    add(can.submit, { key: 'submit', label: 'Submit for Approval', primary: true, disabledReason: blocked ? 'Fix the issues in the action bar first (§19).' : null });
    return out;
  }
  if (st === S.DRAFT) {
    add(doc.id && can.cancel, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
    add(can.edit, { key: 'edit', label: 'Edit', primary: true });
    return out;
  }
  if (st === S.SUBMITTED) {
    add(can.edit && (String(doc.createdById) === String(userId) || superuser), { key: 'recall', label: 'Recall' });
    return out;
  }
  add([S.APPROVED, S.SENT_TO_VENDOR].includes(st) && can.edit, { key: 'amend', label: 'Amend delivery / instructions' });
  add(st === S.APPROVED && can.cancel && !issued, { key: 'cancel', label: 'Cancel PO', danger: true, dialog: 'cancel' });
  add([S.SENT_TO_VENDOR, S.PARTIALLY_COMPLETED, S.COMPLETED].includes(st) && can.cancel, {
    key: 'shortClose', label: st === S.COMPLETED ? 'Close' : 'Close short', danger: st !== S.COMPLETED, dialog: 'shortClose',
    disabledReason: withVendor ? 'Garments are still with the vendor — receive them back first.' : null,
  });
  add(st === S.APPROVED && can.approve, { key: 'send', label: 'Send to Vendor', primary: true });
  return out;
};
