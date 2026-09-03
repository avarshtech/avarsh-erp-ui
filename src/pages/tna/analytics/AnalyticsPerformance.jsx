import { memo, useMemo } from 'react';
import { Card, Col, Progress, Row, Table, Tag } from 'antd';
import { GROUP_COLORS } from '../../../utils/tnaConstants';

/** On-time performance + buyer approval turnaround (§15). */
const AnalyticsPerformance = memo(function AnalyticsPerformance({ data }) {
  const onTimeCols = useMemo(() => [
    { title: 'Activity', dataIndex: 'name', render: (v, r) => <span><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{r.code}</span> {v}</span> },
    { title: 'Group', dataIndex: 'group', width: 110, render: (v) => <Tag style={{ borderColor: GROUP_COLORS[v], color: GROUP_COLORS[v] }}>{v}</Tag> },
    { title: 'Completed', dataIndex: 'completed', width: 90, align: 'right' },
    {
      title: 'On-time vs baseline',
      dataIndex: 'onTimePct',
      width: 220,
      render: (v) => <Progress percent={v} size="small" status={v < 60 ? 'exception' : 'normal'} strokeColor={v < 60 ? 'var(--error-color)' : v < 85 ? 'var(--warning-color)' : 'var(--success-color)'} />,
    },
  ], []);

  const turnCols = useMemo(() => {
    const num = (v) => (v == null ? <span style={{ color: 'var(--text-muted)' }}>—</span> : <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{v}d</span>);
    return [
      { title: 'Buyer', dataIndex: 'buyer' },
      { title: 'Lab Dip / Strike-off', dataIndex: 'Lab Dip / Strike-off', align: 'right', render: num },
      { title: 'Fit sample', dataIndex: 'Fit sample', align: 'right', render: num },
      { title: 'PP sample', dataIndex: 'PP sample', align: 'right', render: num },
    ];
  }, []);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={13}>
        <Card size="small" title="On-time completion by activity" styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="code" size="small" columns={onTimeCols} dataSource={data.onTimeByActivity} pagination={false} scroll={{ y: 430 }} />
        </Card>
      </Col>
      <Col xs={24} lg={11}>
        <Card size="small" title="Buyer approval turnaround (avg days, submission → approval)" styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="buyer" size="small" columns={turnCols} dataSource={data.buyerTurnaround} pagination={false} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
            Direct input to buyer negotiation and to template durations — if a buyer consistently takes 11 days on a 7-day allowance, the template is wrong for that buyer.
          </div>
        </Card>
      </Col>
    </Row>
  );
});

export default AnalyticsPerformance;
