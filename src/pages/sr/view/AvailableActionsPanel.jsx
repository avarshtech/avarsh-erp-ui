import { Card, Button, Space, Typography } from 'antd';
import {
  EditOutlined, SendOutlined, ToolOutlined, RollbackOutlined, CommentOutlined,
  DeleteOutlined, CarOutlined, RetweetOutlined,
} from '@ant-design/icons';
import { SR_STATUS } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

/**
 * Available Actions. Status- and role-gated; unavailable actions stay
 * visible but DISABLED with the reason beneath the label. Production starts
 * via material issue (inventory), dispatching via the Dispatches screen, and
 * feedback on the Customer Comments page — those rows NAVIGATE there. A
 * rejected sample is re-made from here as a linked revision.
 */

const revisionReason = (sr, canAdd) => {
  if (!canAdd) return 'Needs add permission';
  if (sr.status === SR_STATUS.APPROVED) return 'Approved — there is nothing to re-make';
  if ([SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED].includes(sr.status)) {
    return 'A revision has already been raised from this request';
  }
  return 'Available once the buyer rejects the sample or asks for a revision';
};
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

const AvailableActionsPanel = ({ sr, canAdd, canUpdate, canDelete, canIssue, handlers }) => {
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
          reason="Available only while Submitted — returned for edits"
          icon={<RollbackOutlined />} label="Return to Draft" onClick={handlers.onReturnToDraft}
        />
        <ActionRow
          // Gated on the issue screen's own permission — the route it opens is
          // wrapped in PermissionRoute, so an ungated button dead-ends on a 403.
          // Still offered In Production: fabric and trims are separate documents
          // and are rarely issued the same day, so the second one has to be
          // reachable from here and not only from the issue register.
          enabled={(s === SR_STATUS.SUBMITTED || s === SR_STATUS.IN_PRODUCTION) && canIssue}
          reason={!canIssue
            ? 'Needs Material Issue (add) permission'
            : 'Production starts when material is issued — available from Submitted until dispatch'}
          icon={<ToolOutlined />} primary={s === SR_STATUS.SUBMITTED}
          label={s === SR_STATUS.IN_PRODUCTION ? 'Issue More Materials' : 'Issue Materials & Start Production'}
          onClick={handlers.onGoMaterialIssue}
        />
        <ActionRow
          enabled={s === SR_STATUS.IN_PRODUCTION}
          reason="Available while In Production — several SRs of one customer ship together"
          icon={<CarOutlined />} primary
          label="Add to a Dispatch"
          onClick={handlers.onGoDispatches}
        />
        <ActionRow
          enabled={[SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(s)}
          reason={terminal ? 'Feedback recorded — SR is closed' : 'Available once the sample is Dispatched'}
          icon={<CommentOutlined />} primary
          label={s === SR_STATUS.FEEDBACK_RECEIVED ? 'Record Customer Decision' : 'Record Customer Feedback'}
          onClick={handlers.onGoComments}
        />
        <ActionRow
          enabled={Boolean(sr.canRaiseRevision) && canAdd}
          reason={revisionReason(sr, canAdd)}
          icon={<RetweetOutlined />} primary
          label={`Raise Revision${sr.revisionNo > 0 ? ` ${sr.revisionNo + 1}` : ''}`}
          onClick={handlers.onRaiseRevision}
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
