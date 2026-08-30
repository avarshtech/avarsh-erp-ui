import { Row, Col } from 'antd';
import {
  ExperimentOutlined, WarningOutlined, CommentOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import StatCard from '../StatCard';

/**
 * Sample KPI card row (PRD v3 §12.1) — built once, placed twice: the main
 * Dashboard second row AND the SR List module strip (§8.1). Each card filters
 * the SR list on click.
 */
const CARDS = [
  { key: 'activeSamples', title: 'Active Samples', color: '#8b5cf6', icon: <ExperimentOutlined />, query: '' },
  { key: 'overdueSamples', title: 'Overdue Samples', color: 'var(--error-color)', icon: <WarningOutlined />, query: '?overdue=1' },
  { key: 'awaitingBuyerFeedback', title: 'Awaiting Buyer Feedback', color: '#fa8c16', icon: <CommentOutlined />, query: '?status=DISPATCHED' },
  { key: 'pendingApprovals', title: 'Pending Approvals', color: '#14b8a6', icon: <AuditOutlined />, query: '?pendingApproval=1' },
];

const SampleKpiRow = ({ kpis, loading = false, onFilter, style }) => {
  const navigate = useNavigate();
  return (
    <Row gutter={[16, 16]} style={style}>
      {CARDS.map((card) => (
        <Col xs={24} sm={12} lg={6} key={card.key}>
          <StatCard
            title={card.title}
            value={kpis?.[card.key] ?? 0}
            icon={card.icon}
            color={card.color}
            loading={loading}
            hoverable
            onClick={() => {
              // In-module strip filters in place; the Dashboard navigates across.
              if (onFilter) onFilter(card.query);
              else navigate(`/sample-requests/list${card.query}`);
            }}
            style={{ cursor: 'pointer' }}
          />
        </Col>
      ))}
    </Row>
  );
};

export default SampleKpiRow;
