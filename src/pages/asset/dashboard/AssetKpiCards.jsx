import { memo } from 'react';
import { Col, Row } from 'antd';
import {
  CheckCircleOutlined, PauseCircleOutlined, SafetyCertificateOutlined,
  ToolOutlined, WarningOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import StatCard from '../../../components/StatCard';

/**
 * The six numbers somebody wants before they want anything else (PRD section L).
 *
 * Every one excludes disposed assets. A disposed machine is kept for ever for
 * the audit trail, so counting it would overstate the estate a little more
 * every year.
 *
 * Each card links to the register already filtered to what it counted - a
 * number nobody can drill into is a number nobody can act on.
 */
const CARDS = [
  {
    key: 'totalAssets', title: 'Assets Owned', icon: <DatabaseOutlined />,
    color: 'var(--primary-color)', to: '/assets',
  },
  {
    key: 'inUse', title: 'In Use or Spare', icon: <CheckCircleOutlined />,
    color: '#52c41a', to: '/assets?status=ACTIVE',
  },
  {
    key: 'idle', title: 'Idle', icon: <PauseCircleOutlined />,
    color: '#faad14', to: '/assets?status=IDLE',
  },
  {
    key: 'needingRepair', title: 'Damaged or In Repair', icon: <WarningOutlined />,
    color: 'var(--error-color)', to: '/assets?status=DAMAGED',
  },
  {
    key: 'underMaintenance', title: 'Under Maintenance', icon: <ToolOutlined />,
    color: '#fa8c16', to: '/assets?status=UNDER_MAINTENANCE',
  },
  {
    key: 'coverLapsingSoon', title: 'Cover Lapsing in 30 Days', icon: <SafetyCertificateOutlined />,
    color: '#722ed1', to: '/assets?expiringInDays=30',
  },
];

const AssetKpiCards = memo(function AssetKpiCards({ stats = {}, loading = false, onOpen }) {
  return (
    <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
      {CARDS.map((card) => (
        <Col xs={12} sm={8} md={4} key={card.key} style={{ display: 'flex' }}>
          <StatCard
            title={card.title}
            value={stats[card.key] ?? 0}
            icon={card.icon}
            color={card.color}
            loading={loading}
            onClick={() => onOpen(card.to)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </Col>
      ))}
    </Row>
  );
});

export default AssetKpiCards;
