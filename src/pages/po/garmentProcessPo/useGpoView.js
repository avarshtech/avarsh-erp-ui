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
 * A saved draft is editable only in edit mode (`editing`, the screen's ?edit=1); a new one always is.
 */
const useGpoView = ({ doc }, ctx, checks, editing) => useMemo(() => {
  if (!doc) return null;
  const user = getCurrentUser() || {};
  const superuser = isSuperuser();
  const can = {
    edit: hasPermission(KEY, doc.id ? 'update' : 'add'), submit: canSubmitRequirement(KEY), approve: hasPermission(KEY, 'approve'),
    reject: hasPermission(KEY, 'reject'), cancel: hasPermission(KEY, 'cancel'), override: hasPermission(KEY, 'override'),
  };
  const editMode = !doc.id || editing;
  // Garments out with the vendor stop a cancel and a short close (decision D6)
  const issued = doc.lines.some((l) => Number(l.issuedQty) > 0);
  const withVendor = doc.lines.some((l) => Number(l.issuedQty) - Number(l.receivedQty) - Number(l.rejectedQty) > 0);
  const flags = poFlags(doc, {
    orderCancelled: Boolean(ctx) && doc.lines.some((l) => ctx.orders?.[l.orderId]?.status === 'CANCELLED'),
    requirementChanged: Boolean(ctx?.state) && doc.lines.some((l) => gpoRequirementChange(l, ctx.state)),
  });
  return {
    can, draft: doc.status === S.DRAFT && can.edit && editMode, value: gpoValue(doc), flags, superuser, userId: user.id,
    buttons: gpoActionButtons({ doc, can, superuser, userId: user.id, issued, withVendor, editing: editMode, blocked: Boolean(checks?.blocking.length) }),
  };
}, [doc, ctx, checks, editing]);

export default useGpoView;
