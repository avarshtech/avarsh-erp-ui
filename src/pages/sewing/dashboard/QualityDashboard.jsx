import { useState, useEffect, useMemo } from 'react';
import { App, Card, Row, Col, Table, Statistic, Spin } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { getSewingQualityDashboard } from '../../../services/sewingService';
import { DHU_THRESHOLD } from '../../../utils/sewingConstants';
import { formatPercentage } from '../../../utils/formatters';
import EmptyState from '../../../components/EmptyState';

const QualityDashboard = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getSewingQualityDashboard()
      .then((res) => setData(res))
      .catch(() => message.error('Failed to load quality dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const defectColumns = useMemo(() => [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Defect Name',
      dataIndex: 'defectName',
      key: 'defectName',
      width: 250,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a.count || 0) - (b.count || 0),
      defaultSortOrder: 'descend',
      render: (val) => <strong>{val || 0}</strong>,
    },
  ], []);

  const avgDhu = data?.avgDhuPct ?? 0;

  return (
    <>
      <PageHeader title="Sewing Quality Dashboard" />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Avg DHU %"
                value={avgDhu}
                suffix="%"
                valueStyle={{ color: avgDhu > DHU_THRESHOLD ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="Total Inspected" value={data?.totalInspected ?? 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="Total Defects" value={data?.totalDefects ?? 0} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Pass Rate %"
                value={formatPercentage(data?.passRatePct ?? 0)}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Top Defects">
          <Table
            rowKey="defectName"
            columns={defectColumns}
            dataSource={data?.topDefects || []}
            pagination={false}
            size="small"
            scroll={{ x: 400 }}
            locale={{ emptyText: <EmptyState description="No defect data available" /> }}
          />
        </Card>
      </Spin>
    </>
  );
};

export default QualityDashboard;
