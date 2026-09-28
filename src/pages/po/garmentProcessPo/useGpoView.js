import { useMemo } from 'react';
import { getCurrentUser } from '../../../services/auth/authService';
import { hasPermission, isSuperuser, canSubmitRequirement } from '../../../utils/permissions';
import { gpoValue, gpoRequirementChange } from '../../../utils/garmentProcessPoCalc';
import { poFlags, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';
import { gpoActionButtons } from './gpoActionButtons';

const KEY = 'garment-process';

/**
 * What the Garment Process PO screen may do and show: permissions (the reused
 * garment-process key, decision 4), whether it is an editable draft, its value, flags
 * and action buttons. `checks` = validateGpo() — Submit stays disabled while it blocks.
 */
const useGpoView = ({ doc }, ctx, checks) => useMemo(() => {
  if (!doc) return null;
  const user = getCurrentUser() || {};
  const superuser = isSuperuser();
  const can = {
    edit: hasPermission(KEY, doc.id ? 'update' : 'add'), submit: canSubmitRequirement(KEY), approve: hasPermission(KEY, 'approve'),
    reject: hasPermission(KEY, 'reject'), cancel: hasPermission(KEY, 'cancel'), override: hasPermission(KEY, 'override'),
  };
  const isMaker = [doc.createdByUser, doc.modifiedByUser, doc.submittedByUser].includes(user.username);
  const received = doc.lines.some((l) => Number(l.receivedQty) > 0);
  const flags = poFlags(doc, {
    orderCancelled: Boolean(ctx) && doc.lines.some((l) => ctx.orders?.[l.orderId]?.status === 'CANCELLED'),
    requirementChanged: Boolean(ctx?.state) && doc.status !== S.DRAFT && doc.lines.some((l) => gpoRequirementChange(l, ctx.state)),
  });
  return {
    can, draft: doc.status === S.DRAFT && can.edit, value: gpoValue(doc), flags, isMaker, superuser, username: user.username,
    buttons: gpoActionButtons({ doc, can, isMaker, superuser, username: user.username, received, blocked: Boolean(checks?.blocking.length) }),
  };
}, [doc, ctx, checks]);

export default useGpoView;
