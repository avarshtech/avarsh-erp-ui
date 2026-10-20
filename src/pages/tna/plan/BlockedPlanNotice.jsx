import { memo } from 'react';
import {
  Alert, Button, Card, Table, Tag,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  EXCEPTION_TYPE, fmtDate, fmtDateTime, fmtText,
} from '../../../utils/tnaConstants';

const columns = [
  { title: 'Received', dataIndex: 'at', width: 150, render: fmtDateTime },
  { title: 'Event', dataIndex: 'event', width: 200, render: (v) => <code>{v}</code> },
  { title: 'Module', dataIndex: 'module', width: 120 },
  { title: 'Source record', dataIndex: 'sourceRecord', width: 160 },
  { title: 'State', key: 's', width: 160, render: () => <Tag color="gold">Held — order blocked</Tag> },
];

/**
 * BR-18 / FR-10.6 — an order whose identity or mandatory input does not resolve gets no plan.
 * It is shown as blocked, never omitted and never planned against a guessed link.
 */
const BlockedPlanNotice = memo(function BlockedPlanNotice({ plan }) {
  const navigate = useNavigate();
  const h = plan.header;
  const open = plan.exceptions.filter((x) => x.status === 'OPEN' && x.severity === 'BLOCK');
  return (
    <Card size="small">
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        title="Plan not generated — this order is blocked"
        description={(
          <div>
            {open.map((x) => <div key={x.id}><strong>{EXCEPTION_TYPE[x.type]}:</strong> {fmtText(x.detail)}{x.unresolvedValue ? ` (unresolved value ${x.unresolvedValue})` : ''}</div>)}
            <div style={{ marginTop: 6 }}>Commitment {fmtDate(h.originalCommitment)}. No default or inferred date is substituted (FR-1.5).</div>
          </div>
        )}
        action={<Button size="small" onClick={() => navigate('/tna/exceptions')}>Open in Exceptions</Button>}
      />
      <Table
        size="small"
        bordered
        rowKey="id"
        pagination={false}
        columns={columns}
        dataSource={plan.heldEvents}
        title={() => 'Source events received while blocked — applied when the plan generates'}
        locale={{ emptyText: 'No source events received yet' }}
      />
    </Card>
  );
});

export default BlockedPlanNotice;
