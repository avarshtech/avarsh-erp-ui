import { useEffect, useState } from 'react';
import { Collapse } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { getApprovalHistory } from '../../services/core/approvalFlowService';
import ApprovalHistoryTimeline from './ApprovalHistoryTimeline';

/**
 * Self-fetching, collapsible approval history for a single entity.
 * Renders nothing when the entity has no approval-engine history,
 * so it is safe to drop into any view modal.
 */
const ApprovalHistoryPanel = ({ entityType, entityId, style }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!entityType || !entityId) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    getApprovalHistory(entityType, entityId)
      .then((data) => { if (!cancelled) setRequests(data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (!requests.length) return null;

  return (
    <Collapse
      size="small"
      style={style}
      items={[{
        key: 'approval-history',
        label: (
          <span>
            <HistoryOutlined style={{ marginRight: 8 }} />
            Approval History
          </span>
        ),
        children: <ApprovalHistoryTimeline requests={requests} />,
      }]}
    />
  );
};

export default ApprovalHistoryPanel;
