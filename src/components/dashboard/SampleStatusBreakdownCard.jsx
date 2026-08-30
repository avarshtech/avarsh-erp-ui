import { memo, useMemo } from 'react';
import { Card, Progress, Typography, Skeleton, Divider } from 'antd';
import { SR_STATUS, getSrStatusLabel } from '../../utils/sampleRequestConstants';

const { Text } = Typography;

const BAR_STATUSES = [SR_STATUS.IN_PRODUCTION, SR_STATUS.DISPATCHED];
const STATUS_COLORS = { IN_PRODUCTION: '#1677ff', DISPATCHED: '#13c2c2' };
const TYPE_CAP = 5; // user-defined types can grow — cap with an "Other" roll-up (PRD §12.4)

const BarRow = ({ label, count, total, color }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12 }}>{label}</Text>
      <Text strong style={{ fontSize: 12 }}>{count}</Text>
    </div>
    <Progress percent={total ? Math.round((count / total) * 100) : 0} showInfo={false} strokeColor={color} size="small" />
  </div>
);

/**
 * Sample Status Breakdown (PRD §12.4): count by status + count by sample type.
 * "Awaiting Approval" is derived (dispatched w/ comment draft) — a feedback
 * decision routes the SR status immediately, so FEEDBACK_RECEIVED never rests.
 */
const SampleStatusBreakdownCard = memo(function SampleStatusBreakdownCard({ byStatus, byType, pendingApprovals = 0, loading }) {
  const typeRows = useMemo(() => {
    const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
    if (entries.length <= TYPE_CAP) return entries;
    const top = entries.slice(0, TYPE_CAP - 1);
    const other = entries.slice(TYPE_CAP - 1).reduce((s, [, n]) => s + n, 0);
    return [...top, ['Other', other]];
  }, [byType]);

  const statusTotal = BAR_STATUSES.reduce((s, k) => s + (byStatus?.[k] || 0), 0) + pendingApprovals;
  const typeTotal = typeRows.reduce((s, [, n]) => s + n, 0);

  return (
    <Card title="Sample Status Breakdown">
      {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>BY STATUS</Text>
          {BAR_STATUSES.map((s) => (
            <BarRow
              key={s}
              label={getSrStatusLabel(s)}
              count={byStatus?.[s] || 0}
              total={statusTotal}
              color={STATUS_COLORS[s]}
            />
          ))}
          <BarRow label="Awaiting Approval" count={pendingApprovals} total={statusTotal} color="#2f54eb" />
          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>BY SAMPLE TYPE (active)</Text>
          {typeRows.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No active samples</Text>}
          {typeRows.map(([name, count]) => (
            <BarRow key={name} label={name} count={count} total={typeTotal} color="#8b5cf6" />
          ))}
        </>
      )}
    </Card>
  );
});

export default SampleStatusBreakdownCard;
