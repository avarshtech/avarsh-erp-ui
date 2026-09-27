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
const useCppView = ({ doc, rev, dirty }, ctx) => useMemo(() => {
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
    notes: ![S.CANCELLED, S.REJECTED].includes(doc.status) && can.edit,
  };
  // An open amendment is shown as the PO would stand: editable while drafted, read-only while awaiting approval.
  const shownRev = rev || doc.pendingRevision;
  const working = shownRev ? mergedRevision(doc, shownRev) : doc;
  const isCreator = doc.createdByUser === user.username;
  const received = doc.lines.some((l) => Number(l.receivedQty) > 0);
  const flags = poFlags(doc, {
    orderCancelled: Boolean(ctx) && doc.lines.some((l) => ctx.orderStatus?.[l.orderId] === 'CANCELLED'),
    requirementChanged: Boolean(ctx?.state) && doc.status !== S.DRAFT && doc.lines.some((l) => requirementChange(l, ctx.state)),
  });
  return {
    can, edit, working, value: cppValue(working), flags, isCreator, superuser, username: user.username,
    buttons: cppActionButtons({ doc, rev, dirty, can, isCreator, superuser, received, username: user.username }),
  };
}, [doc, rev, dirty, ctx]);

export default useCppView;
