import { useState, useEffect, useMemo } from 'react';
import { App, Card, Row, Col, Table, Statistic, Spin } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { getSewingFloorDashboard } from '../../../services/sewing/sewingService';
import { EFFICIENCY_THRESHOLDS } from '../../../utils/sewingConstants';
import { formatPercentage } from '../../../utils/formatters';
import EmptyState from '../../../components/EmptyState';

const getEfficiencyColor = (pct) => {
  if (pct >= EFFICIENCY_THRESHOLDS.GREEN) return '#52c41a';
  if (pct >= EFFICIENCY_THRESHOLDS.YELLOW) return '#faad14';
  return '#ff4d4f';
};

const SewingDashboard = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getSewingFloorDashboard()
      .then((res) => setData(res))
      .catch(() => message.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const lineColumns = useMemo(() => [
    {
      title: 'Line Code',
      dataIndex: 'lineCode',
      key: 'lineCode',
      width: 120,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Output', dataIndex: 'output', key: 'output', width: 100, align: 'right' },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 100, align: 'right' },
    {
      title: 'Efficiency %',
      dataIndex: 'efficiencyPct',
      key: 'efficiencyPct',
      width: 120,
      align: 'right',
      render: (val) => (
        <span style={{ color: getEfficiencyColor(val), fontWeight: 600 }}>
          {formatPercentage(val)}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <span style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: getEfficiencyColor(record.efficiencyPct),
        }} />
      ),
    },
  ], []);

  return (
    <>
      <PageHeader title="Sewing Floor Dashboard" />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="Active Plans" value={data?.activePlans ?? 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="Total Lines" value={data?.totalLines ?? 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="Today's Output" value={data?.todayOutput ?? 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Avg Efficiency %"
                value={data?.avgEfficiencyPct ?? 0}
                suffix="%"
                valueStyle={{ color: getEfficiencyColor(data?.avgEfficiencyPct ?? 0) }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Lines Summary">
          <Table
            rowKey="lineId"
            columns={lineColumns}
            dataSource={data?.lines || []}
            pagination={false}
            size="small"
            scroll={{ x: 700 }}
            locale={{ emptyText: <EmptyState description="No active lines" /> }}
          />
        </Card>
      </Spin>
    </>
  );
};

export default SewingDashboard;
