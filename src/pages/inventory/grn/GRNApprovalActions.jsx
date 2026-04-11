import { useState } from 'react';
import { Space, App } from 'antd';
import {
  UndoOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import { GRN_STATUS } from '../../../utils/inventoryConstants';
import {
  requestGRNReversal,
  approveGRNReversal,
  rejectGRNReversal,
} from '../../../services/inventory/inventoryService';
import {
  canRequestGRNReversal,
  canApproveGRNReversal,
} from '../../../utils/permissions';

/**
 * GRN approval action buttons — renders in the GRN view modal footer.
 *
 * Reverse workflow on the 5-state GRN lifecycle:
 *   QC_Pending       → (Request Reversal / creator) → Pending_Reversal
 *   Pending_Reversal → (Approve Reversal / manager) → Reversed (editable)
 *   Pending_Reversal → (Reject Reversal  / manager) → QC_Pending
 */

const WARNING = 'var(--warning-color, #faad14)';
const ERROR   = 'var(--error-color, #ff4d4f)';

const GRNApprovalActions = ({ grn, onUpdated }) => {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [reason, setReason] = useState('');

  if (!grn) return null;
  const status = grn.status;
  const type = grn.type;

  const openAction = (action) => { setReason(''); setActiveAction(action); };
  const closeAction = () => setActiveAction(null);

  const performAction = async (enteredReason) => {
    if (!activeAction) return;
    setBusy(true);
    try {
      let updated;
      switch (activeAction.key) {
        case 'request-reversal':
          updated = await requestGRNReversal(grn.id, type, enteredReason); break;
        case 'approve-reversal':
          updated = await approveGRNReversal(grn.id, type, enteredReason); break;
        case 'reject-reversal':
          updated = await rejectGRNReversal(grn.id, type, enteredReason); break;
        default: break;
      }
      message.success(activeAction.successMsg || 'Action completed');
      onUpdated?.(updated);
      closeAction();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Action failed');
    } finally { setBusy(false); }
  };

  // ─── Action config catalogue ─────────────────────────────────────────
  const ACTION_CONFIGS = {
    'request-reversal': {
      key: 'request-reversal',
      action: 'custom',
      label: 'Request Reversal',
      title: 'Request GRN Reversal',
      subtitle: 'Request to reverse this GRN. A manager will need to approve the reversal before you can edit it again.',
      flowLabel: 'QC Pending → Pending Reversal',
      btnText: 'Request Reversal',
      icon: <UndoOutlined />,
      color: WARNING,
      danger: false,
      requiresReason: true,
      minChars: 50,
      placeholder: 'Explain why this GRN needs to be reversed — specific rolls, quantities, dates, or supplier/transporter details that need correction...',
      successMsg: 'Reversal request submitted — awaiting manager approval',
    },
    'approve-reversal': {
      key: 'approve-reversal',
      action: 'custom',
      label: 'Approve Reversal',
      title: 'Approve GRN Reversal',
      subtitle: 'Reopen this GRN for editing. The status will move to Reversed and the creator can make changes before re-submitting.',
      flowLabel: 'Pending Reversal → Reversed',
      btnText: 'Approve Reversal',
      icon: <CheckCircleOutlined />,
      color: WARNING,
      danger: false,
      requiresReason: false,
      successMsg: 'Reversal approved — GRN is editable',
    },
    'reject-reversal': {
      key: 'reject-reversal',
      action: 'reject',
      label: 'Reject Reversal',
      title: 'Reject Reversal Request',
      subtitle: 'Decline the reversal request. The GRN stays in QC Pending awaiting inspection.',
      flowLabel: 'Pending Reversal → QC Pending',
      btnText: 'Reject Reversal',
      icon: <CloseCircleOutlined />,
      color: ERROR,
      danger: true,
      requiresReason: false,
      successMsg: 'Reversal request rejected',
    },
  };

  // ─── Which buttons to show for current status ────────────────────────
  const availableKeys = [];
  if (status === GRN_STATUS.QC_PENDING && canRequestGRNReversal()) {
    availableKeys.push('request-reversal');
  }
  if (status === GRN_STATUS.PENDING_REVERSAL && canApproveGRNReversal()) {
    availableKeys.push('approve-reversal', 'reject-reversal');
  }

  if (availableKeys.length === 0) return null;

  return (
    <>
      <Space wrap>
        {availableKeys.map((k) => {
          const cfg = ACTION_CONFIGS[k];
          return (
            <ActionButton
              key={cfg.key}
              action={cfg.action}
              text={cfg.label}
              icon={cfg.icon}
              color={cfg.action === 'custom' ? cfg.color : undefined}
              onClick={() => openAction(cfg)}
              loading={busy && activeAction?.key === cfg.key}
            />
          );
        })}
      </Space>

      <ApprovalReasonDialog
        open={!!activeAction}
        onCancel={closeAction}
        onConfirm={performAction}
        loading={busy}
        action={activeAction}
        docLabel="Goods Received Note"
        docNumber={grn?.grnNumber}
        reason={reason}
        onReasonChange={setReason}
      />
    </>
  );
};

export default GRNApprovalActions;
