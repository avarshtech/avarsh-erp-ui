import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Space, Spin, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ApprovalReasonDialog from '../ApprovalReasonDialog';
import { getApprovalHistory, processApprovalAction } from '../../services/core/approvalFlowService';
import { getCurrentUser } from '../../services/auth/authService';
import { APPROVAL_STATUS } from '../../utils/approvalFlowConstants';

const { Text } = Typography;

const ACTION_CONFIGS = {
  APPROVE: {
    key: 'APPROVE',
    label: 'Approve',
    color: 'var(--success-color, #52c41a)',
    icon: <CheckCircleOutlined />,
    title: 'Approve',
    subtitle: 'Approve this document at your level',
    btnText: 'Approve',
    requiresReason: false,
  },
  REJECT: {
    key: 'REJECT',
    label: 'Reject',
    color: 'var(--error-color, #ff4d4f)',
    icon: <CloseCircleOutlined />,
    title: 'Reject',
    subtitle: 'Reject this document — the submitter will be notified',
    btnText: 'Reject',
    danger: true,
    requiresReason: true,
    minChars: 20,
  },
  REFER_BACK: {
    key: 'REFER_BACK',
    label: 'Refer Back',
    color: 'var(--warning-color, #fa8c16)',
    icon: <RollbackOutlined />,
    title: 'Refer Back',
    subtitle: 'Send back to the submitter for revision',
    btnText: 'Refer Back',
    requiresReason: true,
    minChars: 20,
  },
};

/**
 * Centralized approval action bar.
 * Fetches the entity's PENDING approval request from the approval engine and renders
 * level-aware Approve / Reject / Refer Back actions (visibility only — the server
 * re-validates the approver on every action).
 *
 * Props:
 *  - entityType / entityId  — engine identifiers (e.g. "PURCHASE_ORDER", 42)
 *  - docLabel / docNumber   — display info for the confirm dialog
 *  - extraContent           — node (or function of action key) rendered inside the
 *                             confirm dialog (e.g. QC checkboxes)
 *  - buildActionData(key)   — returns module-specific actionData payload per action
 *  - onActionComplete(req)  — called after a successful action with the updated request
 *  - fallback               — rendered when NO pending engine request exists (legacy buttons)
 */
const ApprovalActionBar = ({
  entityType,
  entityId,
  docLabel,
  docNumber,
  extraContent = null,
  buildActionData,
  onActionComplete,
  fallback = null,
}) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);

  const loadRequest = useCallback(async () => {
    if (!entityType || !entityId) {
      setRequest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const history = await getApprovalHistory(entityType, entityId);
      setRequest((history || []).find((r) => r.status === APPROVAL_STATUS.PENDING) || null);
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const level = request?.currentLevelDetail;

  const userCanAct = useMemo(() => {
    if (!level || !currentUser) return false;
    if (level.approverUserId != null) {
      return String(level.approverUserId) === String(currentUser.id);
    }
    if (level.approverRoleName) {
      return level.approverRoleName === currentUser.role;
    }
    return false;
  }, [level, currentUser]);

  const visibleActions = useMemo(() => {
    if (!level) return [];
    const actions = [ACTION_CONFIGS.APPROVE];
    if (level.allowReject) actions.push(ACTION_CONFIGS.REJECT);
    if (level.allowReferBack) actions.push(ACTION_CONFIGS.REFER_BACK);
    return actions;
  }, [level]);

  const openDialog = useCallback((action) => {
    setReason('');
    setActiveAction(action);
  }, []);

  const handleConfirm = useCallback(async (reasonText) => {
    if (!request || !activeAction) return;
    setSubmitting(true);
    try {
      const updated = await processApprovalAction(request.id, {
        actionType: activeAction.key,
        comments: reasonText || undefined,
        actionData: buildActionData ? buildActionData(activeAction.key) : undefined,
      });
      message.success(`${activeAction.label} recorded for ${docNumber || 'document'}`);
      setActiveAction(null);
      await loadRequest();
      onActionComplete?.(updated);
    } catch (error) {
      message.error(error?.response?.data?.message || `Failed to ${activeAction.label.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }, [request, activeAction, buildActionData, docNumber, message, loadRequest, onActionComplete]);

  if (loading) return <Spin size="small" />;

  // No engine request pending → legacy / no-flow mode
  if (!request) return fallback;

  const levelStrip = (
    <Tag icon={<ClockCircleOutlined />} color="processing" style={{ marginInlineEnd: 0 }}>
      Approval level {request.currentLevel} of {request.totalLevels}
      {request.currentLevelName ? ` — ${request.currentLevelName}` : ''}
    </Tag>
  );

  return (
    <Space wrap size={8} align="center">
      {levelStrip}
      {userCanAct ? (
        visibleActions.map((action) => (
          <Button
            key={action.key}
            type={action.key === 'APPROVE' ? 'primary' : 'default'}
            danger={action.danger}
            icon={action.icon}
            onClick={() => openDialog(action)}
            style={action.key === 'APPROVE'
              ? { backgroundColor: action.color, borderColor: action.color }
              : undefined}
          >
            {action.label}
          </Button>
        ))
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Waiting on {request.currentLevelName || `level ${request.currentLevel}`} approver
        </Text>
      )}

      <ApprovalReasonDialog
        open={!!activeAction}
        onCancel={() => setActiveAction(null)}
        onConfirm={handleConfirm}
        loading={submitting}
        action={activeAction}
        docLabel={docLabel}
        docNumber={docNumber}
        reason={reason}
        onReasonChange={setReason}
        extraContent={typeof extraContent === 'function' ? extraContent(activeAction?.key) : extraContent}
      />
    </Space>
  );
};

export default ApprovalActionBar;
