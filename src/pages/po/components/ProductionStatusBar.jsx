import { useState } from 'react';
import { App, Space } from 'antd';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import { PROD_PO_STATUS, PO_ACTION, PO_TYPE_META } from '../../../utils/productionConstants';
import { changeCuttingPoStatus } from '../../../services/po/production/cuttingPoService';
import { changeWorkOrderStatus } from '../../../services/po/production/workOrderService';
import { changeFinishingPoStatus } from '../../../services/po/production/finishingPoService';

const CHANGE_FN = {
  CUTTING: changeCuttingPoStatus,
  WORK_ORDER: changeWorkOrderStatus,
  FINISHING: changeFinishingPoStatus,
};

// Dialog config per action.
const DIALOGS = {
  [PO_ACTION.SUBMIT]:     { label: 'Submit', color: '#1677ff', icon: <SendOutlined />, title: 'Submit for Approval', subtitle: 'Sends this PO to the Production Manager for approval.', btnText: 'Submit', requiresReason: false },
  [PO_ACTION.APPROVE]:    { label: 'Approve', color: '#389e0d', icon: <CheckCircleOutlined />, title: 'Approve PO', subtitle: 'Approves the PO and soft-allocates material in Inventory.', btnText: 'Approve', requiresReason: false },
  [PO_ACTION.REFER_BACK]: { label: 'Refer Back', color: '#d48806', icon: <RollbackOutlined />, title: 'Refer Back to Draft', subtitle: 'Returns the PO to the creator for changes.', btnText: 'Refer Back', requiresReason: true, minChars: 10 },
  [PO_ACTION.REJECT]:     { label: 'Reject', color: '#cf1322', icon: <CloseCircleOutlined />, title: 'Reject PO', subtitle: 'Rejects this PO. This is terminal.', btnText: 'Reject', requiresReason: true, danger: true, minChars: 10 },
  [PO_ACTION.CANCEL]:     { label: 'Cancel', color: '#cf1322', icon: <StopOutlined />, title: 'Cancel PO', subtitle: 'Cancels the PO and reverses any inventory allocation.', btnText: 'Cancel PO', requiresReason: true, danger: true, minChars: 10 },
};

const actionsForStatus = (status) => {
  switch (status) {
    case PROD_PO_STATUS.DRAFT:            return [PO_ACTION.SUBMIT, PO_ACTION.CANCEL];
    case PROD_PO_STATUS.PENDING_APPROVAL: return [PO_ACTION.APPROVE, PO_ACTION.REFER_BACK, PO_ACTION.REJECT];
    case PROD_PO_STATUS.APPROVED:         return [PO_ACTION.CANCEL];
    default:                              return [];
  }
};

const BTN_ACTION = { SUBMIT: 'send', APPROVE: 'approve', REFER_BACK: 'refer-back', REJECT: 'reject', CANCEL: 'cancel' };

/** Status workflow action bar (PRD §7.1) + reason dialog. */
const ProductionStatusBar = ({ poType, record, onChanged, ppApproved = true }) => {
  const { message } = App.useApp();
  const [dialog, setDialog] = useState({ open: false, action: null });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!record) return null;
  const available = actionsForStatus(record.status);
  if (!available.length) return null;

  const docNumber = record[PO_TYPE_META[poType]?.noField];

  const open = (action) => { setReason(''); setDialog({ open: true, action }); };

  const confirm = async (reasonText) => {
    const { action } = dialog;
    setLoading(true);
    try {
      const updated = await CHANGE_FN[poType](record.id, action, { reason: reasonText });
      message.success(`${docNumber} — ${DIALOGS[action].label.toLowerCase()} done`);
      setDialog({ open: false, action: null });
      onChanged?.(updated);
    } catch (e) {
      message.error(e.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Space wrap>
        {available.map((a) => {
          const submitBlocked = a === PO_ACTION.SUBMIT && !ppApproved;
          return (
            <ActionButton
              key={a}
              action={BTN_ACTION[a]}
              text={DIALOGS[a].label}
              disabled={submitBlocked}
              tooltip={submitBlocked ? 'PP Sample not yet approved for this order' : undefined}
              onClick={() => open(a)}
            />
          );
        })}
      </Space>
      <ApprovalReasonDialog
        open={dialog.open}
        action={dialog.action ? { key: dialog.action, ...DIALOGS[dialog.action] } : null}
        docLabel={PO_TYPE_META[poType]?.label}
        docNumber={docNumber}
        reason={reason}
        onReasonChange={setReason}
        loading={loading}
        onCancel={() => setDialog({ open: false, action: null })}
        onConfirm={confirm}
      />
    </>
  );
};

export default ProductionStatusBar;
