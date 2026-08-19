import { memo, useMemo } from 'react';
import { Card, Col, Row, Table, Tag } from 'antd';
import { Link } from 'react-router-dom';
import RagBadge from '../components/RagBadge';
import FloatBar from '../components/FloatBar';

const Bar = ({ label, value, max, color }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
      <span>{label}</span><strong>{value}d</strong>
    </div>
    <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-tertiary)' }}>
      <div style={{ height: '100%', borderRadius: 4, width: `${max ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  </div>
);

/** Delay analysis by reason + critical path exposure — the queue of what to fix today (§15). */
const AnalyticsDelay = memo(function AnalyticsDelay({ data }) {
  const reasons = useMemo(() => Object.entries(data.delayByReason || {}).sort((a, b) => b[1] - a[1]), [data.delayByReason]);
  const maxReason = reasons.length ? reasons[0][1] : 0;
  const split = data.delaySplit;
  const splitMax = Math.max(split.buyerDependent, split.internal, 1);

  const exposureCols = useMemo(() => [
    { title: '', dataIndex: 'rag', width: 36, render: (v) => <RagBadge rag={v} showLabel={false} /> },
    { title: 'Order', dataIndex: 'orderNo', render: (v, r) => <div><Link to={`/tna/plan/${r.planId}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</Link><div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{r.buyer} · {r.styleNo}</div></div> },
    { title: 'Remaining float', dataIndex: 'minFloat', width: 160, render: (v) => <FloatBar floatDays={v} max={20} /> },
    { title: 'Overdue crit.', dataIndex: 'overdueCriticals', width: 100, align: 'center', render: (v) => (v ? <Tag color="red">{v}</Tag> : '0') },
  ], []);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card size="small" title="Delay days by re-plan reason" styles={{ body: { paddingTop: 12 } }}>
          {reasons.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>No re-plans raised yet</span>}
          {reasons.map(([r, v]) => <Bar key={r} label={r} value={v} max={maxReason} color="var(--warning-color)" />)}
        </Card>
        <Card size="small" title="Are we the constraint, or is the buyer?" style={{ marginTop: 16 }} styles={{ body: { paddingTop: 12 } }}>
          <Bar label="Buyer-dependent delay" value={split.buyerDependent} max={splitMax} color="var(--info-color)" />
          <Bar label="Internal delay" value={split.internal} max={splitMax} color="var(--error-color)" />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Buyer-dependent activities are excluded from internal efficiency reporting (activity master flag).
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        <Card size="small" title="Critical path exposure — least float first" styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="planId" size="small" columns={exposureCols} dataSource={data.criticalExposure} pagination={false} scroll={{ y: 460 }} />
        </Card>
      </Col>
    </Row>
  );
});

export default AnalyticsDelay;
