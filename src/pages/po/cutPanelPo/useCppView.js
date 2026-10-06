import { useMemo } from 'react';
import { getCurrentUser } from '../../../services/auth/authService';
import { hasPermission, isSuperuser, canSubmitRequirement } from '../../../utils/permissions';
import { cppValue, requirementChange } from '../../../utils/cutPanelPoCalc';
import { mergedRevision } from '../../../utils/cutPanelPoRevision';
import { poFlags, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';
import { cppActionButtons } from './cppActionButtons';

const KEY = 'cut-panel';

/**
 * What the Cut Panel PO screen may do and show: permissions (the reused cut-panel key,
 * decision 4), which parts are editable in this status (BR-16), the document on screen —
 * the open amendment merged over the live PO — its value, flags and action buttons.
 */
const useCppView = ({ doc, rev, dirty, docDirty }, ctx) => useMemo(() => {
  if (!doc) return null;
  const user = getCurrentUser() || {};
  const superuser = isSuperuser();
  const can = {
    edit: hasPermission(KEY, doc.id ? 'update' : 'add'), submit: canSubmitRequirement(KEY), delete: hasPermission(KEY, 'delete'),
    approve: hasPermission(KEY, 'approve'), reject: hasPermission(KEY, 'reject'), referBack: hasPermission(KEY, 'refer_back'),
    cancel: hasPermission(KEY, 'cancel'), override: hasPermission(KEY, 'override'),
  };
  const draft = doc.status === S.DRAFT && can.edit;
  const amending = Boolean(rev) && can.edit;
  const edit = {
    draft, lines: draft || amending, commercial: draft || amending,
    delivery: draft || (doc.status === S.APPROVED && !doc.pendingRevision && can.edit),
    terms: draft || amending || (doc.status === S.APPROVED && !doc.pendingRevision && can.edit),
    // Notes belong to the live PO; while an amendment draft is open, it owns the save buttons.
    notes: ![S.CANCELLED, S.REJECTED].includes(doc.status) && doc.pendingRevision?.status !== S.DRAFT && can.edit,
  };
  // An open amendment is shown as the PO would stand: editable while drafted, read-only while awaiting approval.
  const shownRev = rev || doc.pendingRevision;
  const working = shownRev ? mergedRevision(doc, shownRev) : doc;
  // Panels out with the job worker stop a cancel; panels back stop a cancel and an amendment (VR-19)
  const issued = doc.lines.some((l) => Number(l.issuedQty) > 0);
  const withVendor = doc.lines.some((l) => Number(l.issuedQty) - Number(l.receivedQty) - Number(l.rejectedQty) > 0);
  const received = doc.lines.some((l) => Number(l.receivedQty) > 0 || Number(l.rejectedQty) > 0);
  const flags = poFlags(doc, {
    orderCancelled: Boolean(ctx) && doc.lines.some((l) => ctx.orderStatus?.[l.orderId] === 'CANCELLED'),
    requirementChanged: Boolean(ctx?.state) && doc.lines.some((l) => requirementChange(l, ctx.state)),
  });
  return {
    can, edit, working, value: cppValue(working), flags, superuser, userId: user.id,
    buttons: cppActionButtons({ doc, rev, dirty, docDirty, can, superuser, issued, received, withVendor, userId: user.id }),
  };
}, [doc, rev, dirty, docDirty, ctx]);

export default useCppView;
