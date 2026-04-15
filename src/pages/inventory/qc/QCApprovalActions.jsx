import { useState } from 'react';
import { Space, App, Checkbox, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import { QC_STATUS } from '../../../utils/inventoryConstants';

const { Text } = Typography;
import {
  approveFabricQC,
  rejectFabricQC,
  requestFabricQCReferBack,
  approveFabricQCReferBack,
  rejectFabricQCReferBack,
  approveTrimsQC,
  rejectTrimsQC,
  requestTrimsQCReferBack,
  approveTrimsQCReferBack,
  rejectTrimsQCReferBack,
  closeGRNOnQCApproval,
} from '../../../services/inventory/inventoryService';
import {
  canApproveQC,
  canRejectQC,
  canRequestQCReferBack,
  canApproveQCReferBack,
} from '../../../utils/permissions';

/**
 * QC approval action buttons — renders in the QCViewModal footer.
 *
 * Uses the shared `ActionButton` component for triggers (non-primary tinted
 * styling) and `ApprovalReasonDialog` for the confirmation/reason dialogs —
 * the same polished PO-style dialog with header banner, doc info strip,
 * min-char reason textarea, and colour-themed action button.
 *
 * Fabric and Accessories share the same action vocabulary (E2 decision):
 * Approve · Reject · Request Refer Back · Approve Refer Back · Reject Refer Back.
 */

// Shared colour tokens used by the action configs below.
const SUCCESS = 'var(--success-color, #52c41a)';
const ERROR   = 'var(--error-color, #ff4d4f)';
const WARNING = 'var(--warning-color, #faad14)';
const CYAN    = '#13c2c2'; // Conditional Pass accent

const QCApprovalActions = ({ qc, type = 'fabric', onUpdated }) => {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [reason, setReason] = useState('');
  const [conditionalPass, setConditionalPass] = useState(false);

  if (!qc) return null;
  const status = qc.status;

  const isFabric = type === 'fabric';
  const approveFn           = isFabric ? approveFabricQC          : approveTrimsQC;
  const rejectFn            = isFabric ? rejectFabricQC           : rejectTrimsQC;
  const referBackRequestFn  = isFabric ? requestFabricQCReferBack : requestTrimsQCReferBack;
  const referBackApproveFn  = isFabric ? approveFabricQCReferBack : approveTrimsQCReferBack;
  const referBackRejectFn   = isFabric ? rejectFabricQCReferBack  : rejectTrimsQCReferBack;

  const openAction = (action) => {
    setReason('');
    setConditionalPass(false);
    setActiveAction(action);
  };
  const closeAction = () => setActiveAction(null);

  const performAction = async (enteredReason) => {
    if (!activeAction) return;
    setBusy(true);
    try {
      let updated;
      switch (activeAction.key) {
        case 'approve':
          updated = await approveFn(qc.id, enteredReason, { conditionalPass });
          // QC approval (incl. Conditional Pass) → close the linked GRN. When the
          // QC API phase lands, the backend owns this interlock inside
          // QCService.approve() — this client-side call becomes a no-op.
          if (updated?.grnId) await closeGRNOnQCApproval(updated.grnId);
          break;
        case 'reject':     updated = await rejectFn(qc.id, enteredReason); break;
        case 'request-rb': updated = await referBackRequestFn?.(qc.id, enteredReason); break;
        case 'approve-rb': updated = await referBackApproveFn?.(qc.id); break;
        case 'reject-rb':  updated = await referBackRejectFn?.(qc.id); break;
        default: break;
      }
      const successMsg = activeAction.key === 'approve' && conditionalPass
        ? 'QC approved with Conditional Pass'
        : activeAction.successMsg || 'Action completed';
      message.success(successMsg);
      onUpdated?.(updated);
      closeAction();
    } catch {
      message.error('Action failed');
    } finally { setBusy(false); }
  };

  const docLabel = isFabric ? 'Fabric QC Inspection' : 'Accessories QC Inspection';

  // ─── Action config catalogue ─────────────────────────────────────────
  // Keyed by `key`; each entry is a full config for ApprovalReasonDialog.
  const ACTION_CONFIGS = {
    approve: {
      key: 'approve',
      action: 'approve',
      label: 'Approve',
      title: conditionalPass ? `Conditional Pass ${docLabel}` : `Approve ${docLabel}`,
      subtitle: conditionalPass
        ? 'Sign off with qualifications — the GRN will be released but the approval remains flagged as Conditional Pass.'
        : 'Sign off on this quality-control inspection.',
      flowLabel: conditionalPass
        ? 'Pending Approval → Conditional Pass'
        : 'Pending Approval → Approved',
      btnText: conditionalPass ? 'Conditional Pass' : 'Approve',
      icon: conditionalPass ? <WarningOutlined /> : <CheckCircleOutlined />,
      color: conditionalPass ? CYAN : SUCCESS,
      danger: false,
      requiresReason: false,
      successMsg: 'QC approved',
    },
    reject: {
      key: 'reject',
      action: 'reject',
      label: 'Reject',
      title: `Reject ${docLabel}`,
      subtitle: 'Return this inspection to the creator for revision.',
      flowLabel: 'Pending Approval → Rejected',
      btnText: 'Reject Inspection',
      icon: <CloseCircleOutlined />,
      color: ERROR,
      danger: true,
      requiresReason: true,
      minChars: 50,
      placeholder: 'Explain why this QC inspection is being rejected. Be specific about the parameters, rolls or criteria that failed...',
      successMsg: 'QC rejected',
    },
    'request-rb': {
      key: 'request-rb',
      action: 'refer-back',
      label: 'Request Refer Back',
      title: 'Request Refer Back',
      subtitle: 'Reopen the approved / conditional-pass inspection so the creator can re-inspect.',
      flowLabel: `${status === QC_STATUS.CONDITIONAL_PASS ? 'Conditional Pass' : 'Approved'} → Refer Back Pending`,
      btnText: 'Request Refer Back',
      icon: <RollbackOutlined />,
      color: WARNING,
      danger: false,
      requiresReason: true,
      minChars: 50,
      placeholder: 'Describe what needs to be re-verified — specific rolls, defects, or parameters that triggered the re-check...',
      successMsg: 'Refer-back requested',
    },
    'approve-rb': {
      key: 'approve-rb',
      action: 'refer-back',
      label: 'Approve Refer Back',
      title: 'Approve Refer Back Request',
      subtitle: 'Reopen the inspection so the creator can re-inspect and re-submit.',
      flowLabel: 'Refer Back Pending → Referred Back',
      btnText: 'Approve Refer Back',
      icon: <CheckCircleOutlined />,
      color: WARNING,
      danger: false,
      requiresReason: false,
      successMsg: 'Refer-back approved — QC editable',
    },
    'reject-rb': {
      key: 'reject-rb',
      action: 'reject',
      label: 'Reject Refer Back',
      title: 'Reject Refer Back Request',
      subtitle: 'Decline the refer-back request. The QC stays Approved.',
      flowLabel: 'Refer Back Pending → Approved',
      btnText: 'Reject Refer Back',
      icon: <CloseCircleOutlined />,
      color: ERROR,
      danger: true,
      requiresReason: false,
      successMsg: 'Refer-back rejected',
    },
  };

  // ─── Which buttons to show for current status ────────────────────────
  const availableKeys = [];
  if (status === QC_STATUS.PENDING_APPROVAL) {
    if (canApproveQC()) availableKeys.push('approve');
    if (canRejectQC())  availableKeys.push('reject');
  }
  // Refer-back flow is shared between Approved and Conditional Pass
  if ((status === QC_STATUS.APPROVED || status === QC_STATUS.CONDITIONAL_PASS) && canRequestQCReferBack()) {
    availableKeys.push('request-rb');
  }
  if (status === QC_STATUS.REFERRED_BACK_PENDING && canApproveQCReferBack()) {
    availableKeys.push('approve-rb', 'reject-rb');
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
        docLabel={docLabel}
        docNumber={qc?.qcNumber}
        reason={reason}
        onReasonChange={setReason}
        extraContent={
          activeAction?.key === 'approve' ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1px solid ${conditionalPass ? CYAN : 'var(--border-color, #e5e7eb)'}`,
                borderLeft: `4px solid ${conditionalPass ? CYAN : 'var(--border-color, #d9d9d9)'}`,
                background: conditionalPass ? 'rgba(19, 194, 194, 0.06)' : 'transparent',
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
            >
              <Checkbox
                checked={conditionalPass}
                onChange={(e) => setConditionalPass(e.target.checked)}
              >
                <Text strong style={{ fontSize: 13, color: conditionalPass ? CYAN : undefined }}>
                  Mark as Conditional Pass
                </Text>
              </Checkbox>
              <div style={{ marginTop: 4, marginLeft: 24 }}>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  Approve with qualifications — use when the lot is acceptable but some parameters
                  or criteria are borderline. The GRN still closes; the approval is flagged distinctly.
                </Text>
              </div>
            </div>
          ) : null
        }
      />
    </>
  );
};

export default QCApprovalActions;
