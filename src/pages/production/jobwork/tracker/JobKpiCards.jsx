import { memo } from 'react';
import { Col, Row } from 'antd';
import {
  ClockCircleOutlined, ExclamationCircleOutlined, InboxOutlined, QuestionCircleOutlined, SafetyCertificateOutlined, WarningOutlined,
} from '@ant-design/icons';
import StatCard from '../../../../components/StatCard';

const CARDS = [
  { key: 'open', title: 'Open jobs', icon: <InboxOutlined />, color: 'var(--primary-color)' },
  { key: 'inProcess', title: 'Pieces in process', icon: <ClockCircleOutlined />, color: '#1677ff' },
  { key: 'overdue', title: 'Overdue', icon: <ExclamationCircleOutlined />, color: '#cf1322', filter: { risk: 'OVERDUE' } },
  { key: 'atRisk', title: 'At risk', icon: <WarningOutlined />, color: '#d46b08', filter: { risk: 'AT_RISK' } },
  { key: 'stale', title: 'No update', icon: <QuestionCircleOutlined />, color: '#d4b106', filter: { stale: true } },
  { key: 'readyToClose', title: 'Ready to close', icon: <SafetyCertificateOutlined />, color: '#08979c', filter: { readyToClose: true } },
];

/** KPI strip; a card with a filter applies it to the table when clicked. `cards` defaults to the tracker's. */
const JobKpiCards = memo(function JobKpiCards({ kpis, loading, onFilter, cards = CARDS }) {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {cards.map((c) => (
        <Col key={c.key} xs={12} sm={8} lg={4}>
          <StatCard
            title={c.title}
            value={kpis?.[c.key] ?? 0}
            icon={c.icon}
            color={c.color}
            loading={loading && !kpis}
            onClick={c.filter ? () => onFilter(c.filter) : undefined}
            style={{ cursor: c.filter ? 'pointer' : 'default' }}
          />
        </Col>
      ))}
    </Row>
  );
});

export default JobKpiCards;
