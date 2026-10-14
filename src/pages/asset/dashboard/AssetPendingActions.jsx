import { memo } from 'react';
import { Badge, Card, Empty } from 'antd';
import { RightOutlined } from '@ant-design/icons';

/**
 * What is waiting on a person (PRD section L).
 *
 * Counted separately from the status tallies because they answer different
 * questions: "nine assets are idle" is a fact about the floor, "nine transfers
 * await approval" is a queue somebody is holding up.
 *
 * Rows that are clear stay on the list, dimmed. A zero here is worth reading -
 * hiding it would leave somebody unsure whether the queue is empty or the panel
 * simply does not track it.
 */
const ROWS = [
  { key: 'transfersAwaitingApproval', label: 'Transfers awaiting approval', to: '/assets/transfers?status=SUBMITTED' },
  { key: 'transfersAwaitingDispatch', label: 'Approved, not yet dispatched', to: '/assets/transfers?status=APPROVED' },
  { key: 'transfersInTransit', label: 'In transit, awaiting receipt', to: '/assets/transfers?status=IN_TRANSIT' },
  { key: 'disposalsAwaitingApproval', label: 'Disposals awaiting approval', to: '/assets/disposals?status=SUBMITTED' },
  { key: 'maintenanceOpen', label: 'Maintenance jobs still open', to: '/assets?status=UNDER_MAINTENANCE' },
  { key: 'maintenanceOverdue', label: 'Service overdue', to: '/assets', urgent: true },
  { key: 'verificationRunsOpen', label: 'Verification runs being walked', to: '/assets/verification?status=OPEN' },
  { key: 'notVerifiedInSixMonths', label: 'Not counted in six months', to: '/assets/verification' },
];

const AssetPendingActions = memo(function AssetPendingActions({ pending, loading = false, onOpen }) {
  const waiting = ROWS.filter((row) => (pending?.[row.key] ?? 0) > 0);

  return (
    <Card title="Pending actions" loading={loading} style={{ height: '100%' }}>
      {!loading && waiting.length === 0 && (
        <Empty description="Nothing is waiting on anybody" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {ROWS.map((row) => {
        const count = pending?.[row.key] ?? 0;
        return (
          <div
            key={row.key}
            className="asset-pending-row"
            onClick={() => onOpen(row.to)}
            style={{ opacity: count === 0 ? 0.45 : 1 }}
          >
            <Badge
              count={count}
              showZero
              color={count === 0 ? '#bfbfbf' : (row.urgent ? '#cf1322' : '#1677ff')}
              overflowCount={999}
            />
            <span style={{ flex: 1 }}>{row.label}</span>
            <RightOutlined style={{ fontSize: 11, opacity: 0.5 }} />
          </div>
        );
      })}
    </Card>
  );
});

export default AssetPendingActions;
