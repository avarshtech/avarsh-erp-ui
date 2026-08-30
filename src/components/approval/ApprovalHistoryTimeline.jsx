import { useMemo } from 'react';
import { Timeline, Tag, Typography, Empty } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { APPROVAL_STATUS_CONFIG } from '../../utils/approvalFlowConstants';

const { Text } = Typography;

const ACTION_META = {
  APPROVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
  REJECT: { color: 'red', icon: <CloseCircleOutlined />, label: 'Rejected' },
  REFER_BACK: { color: 'orange', icon: <RollbackOutlined />, label: 'Referred Back' },
  CANCEL: { color: 'gray', icon: <StopOutlined />, label: 'Cancelled' },
};

const formatTs = (ts) => (ts ? new Date(ts).toLocaleString() : '');

/**
 * Renders the approval history of an entity from the centralized approval engine.
 * Accepts the request list returned by getApprovalHistory(entityType, entityId).
 */
const ApprovalHistoryTimeline = ({ requests = [] }) => {
  const items = useMemo(() => {
    const out = [];
    requests.forEach((req) => {
      const statusCfg = APPROVAL_STATUS_CONFIG[req.status] || {};
      out.push({
        key: `req-${req.id}`,
        color: 'blue',
        dot: <ClockCircleOutlined />,
        children: (
          <div>
            <Text strong>Submitted for approval</Text>{' '}
            <Tag color={statusCfg.color}>{statusCfg.label || req.status}</Tag>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {req.approvalFlowName ? `Flow: ${req.approvalFlowName} · ` : ''}
                {req.submittedByName ? `by ${req.submittedByName} · ` : ''}
                {formatTs(req.submittedAt)}
              </Text>
            </div>
          </div>
        ),
      });
      (req.actions || []).forEach((action) => {
        const meta = ACTION_META[action.actionType] || {};
        out.push({
          key: `act-${action.id}`,
          color: meta.color || 'gray',
          dot: meta.icon,
          children: (
            <div>
              <Text strong>{meta.label || action.actionType}</Text>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Level {action.levelNumber}
                {action.levelName ? ` · ${action.levelName}` : ''}
              </Text>
              <div>
                <Text style={{ fontSize: 12 }}>{action.actionByName}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}> · {formatTs(action.actionTimestamp)}</Text>
              </div>
              {action.comments && (
                <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                  “{action.comments}”
                </Text>
              )}
            </div>
          ),
        });
      });
    });
    return out;
  }, [requests]);

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approval history" />;
  }

  return <Timeline items={items} style={{ marginTop: 8 }} />;
};

export default ApprovalHistoryTimeline;
