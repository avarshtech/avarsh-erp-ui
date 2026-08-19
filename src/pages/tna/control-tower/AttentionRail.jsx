import { memo, useMemo } from 'react';
import { Card, Tag, Empty } from 'antd';
import { FireOutlined, StopOutlined, AuditOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const Item = ({ onClick, title, meta, badge }) => (
  <div
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{meta}</div>
    </div>
    {badge}
    <RightOutlined style={{ fontSize: 10, color: 'var(--text-muted)' }} />
  </div>
);

const Section = ({ icon, title, color, count, children }) => (
  <Card
    size="small"
    style={{ marginBottom: 12 }}
    title={(
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color }}>{icon}</span>{title}
        <Tag style={{ marginLeft: 'auto' }} color={count ? 'red' : 'default'}>{count}</Tag>
      </span>
    )}
  >
    {count === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All clear" style={{ margin: '4px 0' }} /> : children}
  </Card>
);

/** "Needs attention today" — the queue of what to fix, in escalation order. */
const AttentionRail = memo(function AttentionRail({ plans, replans }) {
  const navigate = useNavigate();

  const criticals = useMemo(() => plans
    .filter((p) => p.planStatus === 'ACTIVE')
    .flatMap((p) => p.lines
      .filter((l) => l.status === 'OVERDUE_CRITICAL')
      .map((l) => ({ plan: p, line: l, daysOver: dayjs().diff(dayjs(l.plannedDate), 'day') })))
    .sort((a, b) => b.daysOver - a.daysOver)
    .slice(0, 6), [plans]);

  const infeasible = useMemo(() => plans.filter((p) => p.feasibility === 'INFEASIBLE'), [plans]);
  const pending = useMemo(() => replans.filter((r) => r.workflowStatus === 'PENDING_APPROVAL'), [replans]);

  return (
    <div>
      <Section icon={<FireOutlined />} title="Overdue on Critical Path" color="var(--error-color)" count={criticals.length}>
        {criticals.map(({ plan, line, daysOver }) => (
          <Item
            key={`${plan.id}-${line.code}`}
            onClick={() => navigate(`/tna/plan/${plan.id}`)}
            title={`${line.name}`}
            meta={`${plan.orderNo} · ${plan.buyer} · planned ${dayjs(line.plannedDate).format(DATE_FORMAT)}`}
            badge={<Tag color="red">{daysOver}d over</Tag>}
          />
        ))}
      </Section>
      <Section icon={<StopOutlined />} title="Infeasible Plans" color="var(--error-color)" count={infeasible.length}>
        {infeasible.map((p) => (
          <Item
            key={p.id}
            onClick={() => navigate(`/tna/plan/${p.id}`)}
            title={`${p.orderNo} · ${p.buyer}`}
            meta={`Leadtime ${p.leadtime}d — floor not met, needs ETD move or override`}
            badge={<Tag color="red">Short {p.shortfallDays}d</Tag>}
          />
        ))}
      </Section>
      <Section icon={<AuditOutlined />} title="Re-plans Awaiting Approval" color="var(--accent-color)" count={pending.length}>
        {pending.map((r) => (
          <Item
            key={r.id}
            onClick={() => navigate('/tna/replans')}
            title={`${r.activityName}`}
            meta={`${r.orderNo} · ${r.reasonCode} · by ${r.raisedBy}`}
            badge={<Tag color="gold">{dayjs(r.proposedDate).diff(dayjs(r.currentDate), 'day')}d shift</Tag>}
          />
        ))}
      </Section>
    </div>
  );
});

export default AttentionRail;
