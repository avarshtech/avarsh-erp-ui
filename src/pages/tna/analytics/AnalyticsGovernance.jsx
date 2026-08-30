import { memo, useMemo } from 'react';
import { Card, Col, Row, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../../../utils/uiConstants';

/** Governance pack (§15): re-plan register, infeasible orders, template effectiveness. */
const AnalyticsGovernance = memo(function AnalyticsGovernance({ data }) {
  const replanCols = useMemo(() => [
    { title: 'Order', dataIndex: 'orderNo', width: 120, render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span> },
    { title: 'Activity', dataIndex: 'activityName' },
    { title: 'Moved', key: 'moved', width: 90, align: 'right', render: (_, r) => <Tag color="orange">+{dayjs(r.proposedDate).diff(dayjs(r.currentDate), 'day')}d</Tag> },
    { title: 'Reason', dataIndex: 'reasonCode', width: 150 },
    { title: 'Approver', dataIndex: 'approverId', width: 120, render: (v) => v || '—' },
  ], []);

  const infeasibleCols = useMemo(() => [
    { title: 'Order', dataIndex: 'orderNo', width: 120, render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span> },
    { title: 'Buyer', dataIndex: 'buyer' },
    { title: 'Leadtime', dataIndex: 'leadtime', width: 90, align: 'right', render: (v) => `${v}d` },
    { title: 'Shortfall', dataIndex: 'shortfallDays', width: 90, align: 'right', render: (v) => <Tag color="red">{v}d</Tag> },
    { title: 'ETD', dataIndex: 'etd', width: 110, render: (v) => dayjs(v).format(DATE_FORMAT) },
  ], []);

  const effectivenessCols = useMemo(() => [
    { title: 'Activity', dataIndex: 'name', render: (v, r) => <span><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{r.code}</span> {v}</span> },
    { title: 'Planned avg', dataIndex: 'plannedAvg', width: 100, align: 'right', render: (v) => `${v}d` },
    { title: 'Actual avg', dataIndex: 'actualAvg', width: 100, align: 'right', render: (v, r) => <strong style={{ color: v > r.plannedAvg ? 'var(--error-color)' : 'var(--success-color)' }}>{v}d</strong> },
    {
      title: 'Verdict',
      key: 'verdict',
      width: 160,
      render: (_, r) => {
        const diff = Math.round((r.actualAvg - r.plannedAvg) * 10) / 10;
        if (Math.abs(diff) < 1) return <Tag color="green">Calibrated</Tag>;
        return <Tag color={diff > 0 ? 'red' : 'gold'}>{diff > 0 ? `Optimistic by ${diff}d` : `Generous by ${-diff}d`}</Tag>;
      },
    },
    { title: 'Samples', dataIndex: 'samples', width: 80, align: 'right' },
  ], []);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title={`Re-plan register (${data.replanRegister.length} approved)`} styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="id" size="small" columns={replanCols} dataSource={data.replanRegister} pagination={false} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            The count per order is unrestricted but reported — an order on its fifth re-plan is itself a finding.
          </div>
        </Card>
        <Card size="small" title="Infeasible orders" style={{ marginTop: 16 }} styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="orderNo" size="small" columns={infeasibleCols} dataSource={data.infeasibleOrders} pagination={false} />
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card size="small" title="Template effectiveness — planned vs actual duration" styles={{ body: { paddingTop: 8 } }}>
          <Table rowKey="code" size="small" columns={effectivenessCols} dataSource={data.templateEffectiveness} pagination={false} scroll={{ y: 420 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            This report keeps the module honest: if an activity is planned at 7 days and averages 11 across completed orders, every plan built on the template is wrong in the same direction. Review quarterly.
          </div>
        </Card>
      </Col>
    </Row>
  );
});

export default AnalyticsGovernance;
