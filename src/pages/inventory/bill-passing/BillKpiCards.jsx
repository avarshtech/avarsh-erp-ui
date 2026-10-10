import { Col, Row } from 'antd';
import {
  FileSearchOutlined,
  AuditOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import StatCard from '../../../components/StatCard';

const KPI_CARDS = [
  { key: 'pendingVerification', title: 'Pending Verification', icon: <FileSearchOutlined />, color: 'var(--primary-color)' },
  { key: 'pendingApproval', title: 'Pending Approval', icon: <AuditOutlined />, color: 'var(--warning-color)' },
  { key: 'onHoldOrQuery', title: 'On Hold / Query / Referred', icon: <PauseCircleOutlined />, color: 'var(--error-color)' },
  { key: 'passedThisMonth', title: 'Passed This Month', icon: <CheckCircleOutlined />, color: 'var(--success-color)' },
  { key: 'totalDebitMtd', title: 'Total Debit (MTD)', icon: <MinusCircleOutlined />, color: 'var(--warning-color)', currency: true },
  { key: 'sentToAccountsMtd', title: 'Sent to Accounts (MTD)', icon: <SendOutlined />, color: 'var(--success-color)', currency: true },
];

/** The six Bill Passing KPIs, over every bill of the selected source(s) — not the page, not the filters. */
const BillKpiCards = ({ stats, loading }) => (
  // Card height is pinned to the stretched Col so a two-line title does not leave its neighbours short.
  <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
    {KPI_CARDS.map((c) => (
      <Col xs={24} sm={12} lg={4} key={c.key}>
        <StatCard
          title={c.title}
          value={stats?.[c.key] || 0}
          prefix={c.currency ? '₹' : undefined}
          precision={c.currency ? 2 : undefined}
          loading={loading && !stats}
          icon={c.icon}
          color={c.color}
          style={{ height: '100%' }}
        />
      </Col>
    ))}
  </Row>
);

export default BillKpiCards;
