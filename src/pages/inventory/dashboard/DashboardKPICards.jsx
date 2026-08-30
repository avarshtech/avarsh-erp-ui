import { memo } from 'react';
import { Row, Col } from 'antd';
import {
  DollarOutlined,
  InboxOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  TagOutlined,
  SendOutlined,
} from '@ant-design/icons';
import StatCard from '../../../components/StatCard';

const KPI_DEFS = [
  { key: 'totalInwardValue', title: 'Total Inward Value', icon: <DollarOutlined />, color: 'var(--primary-color)', prefix: '₹' },
  { key: 'fabricRolls', title: 'Fabric Rolls Received', icon: <InboxOutlined />, color: '#1677ff' },
  { key: 'accessoryItems', title: 'Accessories Received', icon: <AppstoreOutlined />, color: '#722ed1' },
  { key: 'pendingQC', title: 'Pending QC', icon: <ExperimentOutlined />, color: 'var(--warning-color)' },
  { key: 'activeStyles', title: 'Active Styles', icon: <TagOutlined />, color: '#52c41a' },
  { key: 'pendingIssues', title: 'Pending Issues', icon: <SendOutlined />, color: '#13c2c2' },
];

const DashboardKPICards = memo(function DashboardKPICards({ stats = {}, loading = false }) {
  return (
    <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
      {KPI_DEFS.map((kpi) => (
        <Col xs={12} sm={8} md={4} key={kpi.key} style={{ display: 'flex' }}>
          <StatCard
            title={kpi.title}
            value={stats[kpi.key] ?? 0}
            prefix={kpi.prefix}
            icon={kpi.icon}
            color={kpi.color}
            loading={loading}
            style={{ width: '100%' }}
          />
        </Col>
      ))}
    </Row>
  );
});

export default DashboardKPICards;
