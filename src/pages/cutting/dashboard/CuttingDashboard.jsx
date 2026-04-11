import { useState, useEffect, useMemo } from 'react';
import { App, Card, Row, Col, Statistic, Table, Tag, Skeleton } from 'antd';
import {
  ScissorOutlined, FileTextOutlined, AppstoreOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getCuttingDashboard } from '../../../services/cuttingService';
import PageHeader from '../../../components/PageHeader';
import { getCutPlanStatusLabel, getCutPlanStatusColor, getCutReportLabel, getCutReportColor } from '../../../utils/cuttingConstants';

const CuttingDashboard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getCuttingDashboard()
      .then(setData)
      .catch(() => message.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const planColumns = useMemo(() => [
    {
      title: 'Plan No', dataIndex: 'refNo', key: 'refNo', width: 140,
      render: (text, record) => (
        <a onClick={() => navigate(`/cutting/order-plan/edit/${record.id}`)}
          style={{ fontFamily: 'monospace', cursor: 'pointer' }}>{text}</a>
      ),
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 120, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 80 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => <Tag color={getCutPlanStatusColor(s)}>{getCutPlanStatusLabel(s)}</Tag>,
    },
  ], [navigate]);

  const reportColumns = useMemo(() => [
    {
      title: 'Report No', dataIndex: 'refNo', key: 'refNo', width: 140,
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 120, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 80 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => <Tag color={getCutReportColor(s)}>{getCutReportLabel(s)}</Tag>,
    },
  ], []);

  if (loading) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <>
      <PageHeader title="Cutting Dashboard" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Plans"
              value={data?.totalPlans || 0}
              prefix={<ScissorOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Active Cutting"
              value={data?.activePlans || 0}
              prefix={<ScissorOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Reports"
              value={data?.totalReports || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Avg Wastage %"
              value={data?.avgWastagePct || 0}
              precision={2}
              suffix="%"
              prefix={<WarningOutlined />}
              valueStyle={{ color: (data?.avgWastagePct || 0) > 5 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Bundles"
              value={data?.totalBundles || 0}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Bundles Issued"
              value={data?.bundlesIssued || 0}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Completed Plans"
              value={data?.completedPlans || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Today Output"
              value={data?.todayOutput || 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Recent Plans" size="small">
            <Table
              rowKey="id"
              columns={planColumns}
              dataSource={data?.recentPlans || []}
              pagination={false}
              size="small"
              scroll={{ x: 450 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Recent Reports" size="small">
            <Table
              rowKey="id"
              columns={reportColumns}
              dataSource={data?.recentReports || []}
              pagination={false}
              size="small"
              scroll={{ x: 450 }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default CuttingDashboard;
