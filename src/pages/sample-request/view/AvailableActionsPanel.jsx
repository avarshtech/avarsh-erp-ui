import { Card, Button, Space, Typography } from 'antd';
import {
  EditOutlined, SendOutlined, ToolOutlined, RollbackOutlined, CommentOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { SR_STATUS } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

/**
 * Available Actions (PRD §8.3): status- and role-gated. Unavailable actions
 * stay visible but DISABLED, with the reason on its own line beneath the
 * label — full-width and wrap-safe, so long reasons never get cut off.
 */
const ActionRow = ({ enabled, reason, icon, label, onClick, danger, primary }) => (
  <Button
    block
    danger={danger}
    type={primary && enabled ? 'primary' : 'default'}
    disabled={!enabled}
    onClick={onClick}
    style={{ height: 'auto', padding: '8px 12px', textAlign: 'left', whiteSpace: 'normal' }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500 }}>{label}</span>
        {!enabled && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.4 }}>
            {reason}
          </Text>
        )}
      </span>
    </div>
  </Button>
);

const AvailableActionsPanel = ({ sr, canUpdate, canDelete, handlers }) => {
  const s = sr.status;
  const terminal = [SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED].includes(s);
  return (
    <Card size="small" title="Available Actions">
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <ActionRow
          enabled={s === SR_STATUS.DRAFT && canUpdate}
          reason={!canUpdate ? 'Needs update permission' : 'Available while the SR is a Draft'}
          icon={<EditOutlined />} label="Edit Sample Request" onClick={handlers.onEdit}
        />
        <ActionRow
          enabled={s === SR_STATUS.DRAFT && canUpdate}
          reason={!canUpdate ? 'Needs update permission' : 'Available while the SR is a Draft'}
          icon={<SendOutlined />} label="Submit" primary onClick={handlers.onSubmit}
        />
        <ActionRow
          enabled={s === SR_STATUS.SUBMITTED && canUpdate}
          reason={!canUpdate ? 'Needs update permission' : 'Available once Submitted — Production team accepts the SR'}
          icon={<ToolOutlined />} label="Start Production" primary onClick={handlers.onStartProduction}
        />
        <ActionRow
          enabled={s === SR_STATUS.SUBMITTED && canUpdate}
          reason="Available only while Submitted — returned for edits"
          icon={<RollbackOutlined />} label="Return to Draft" onClick={handlers.onReturnToDraft}
        />
        <ActionRow
          enabled={s === SR_STATUS.IN_PRODUCTION && canUpdate}
          reason={!canUpdate ? 'Needs update permission' : 'Available while In Production — Dispatch / QC role'}
          icon={<SendOutlined />} label="Update Dispatch Details" primary onClick={handlers.onGoDispatch}
        />
        <ActionRow
          enabled={[SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(s) && canUpdate}
          reason={!canUpdate ? 'Needs update permission' : 'Available once the sample is Dispatched'}
          icon={<CommentOutlined />}
          label={s === SR_STATUS.FEEDBACK_RECEIVED ? 'Record Buyer Decision' : 'Log Buyer Comments'}
          primary onClick={handlers.onGoComments}
        />
        <ActionRow
          enabled={s === SR_STATUS.DRAFT && canDelete}
          reason={terminal || s !== SR_STATUS.DRAFT ? 'SR records are not deletable once status moves beyond Draft' : 'Needs delete permission'}
          icon={<DeleteOutlined />} label="Delete" danger onClick={handlers.onDelete}
        />
      </Space>
    </Card>
  );
};

export default AvailableActionsPanel;
