import { memo } from 'react';
import { Card, Space, Typography, Skeleton, Divider } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, InboxOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const QuickStatItem = ({ icon, label, value, unit, background }) => (
  <Card size="small" style={{ background }}>
    <Space>
      {icon}
      <div>
        <Text type="secondary">{label}</Text>
        <Title level={4} style={{ margin: 0 }}>{value} {unit}</Title>
      </div>
    </Space>
  </Card>
);

// extraItems: optional additional QuickStatItems appended after a divider
// (used by the Sample Request module — default [] keeps this card unchanged).
const QuickStatsCard = memo(function QuickStatsCard({ quickStats, isDarkMode, loading = false, extraItems = [] }) {
  return (
    <Card title="Quick Stats">
      {loading || !quickStats ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <QuickStatItem
            icon={<CheckCircleOutlined style={{ fontSize: 24, color: 'var(--success-color)' }} />}
            label="Completed Today"
            value={quickStats.completedToday}
            unit="Orders"
            background={isDarkMode ? '#14532d' : '#f0fdf4'}
          />
          <QuickStatItem
            icon={<ClockCircleOutlined style={{ fontSize: 24, color: 'var(--warning-color)' }} />}
            label="Pending Approval"
            value={quickStats.pendingApproval}
            unit="POs"
            background={isDarkMode ? '#78350f' : '#fef3c7'}
          />
          <QuickStatItem
            icon={<InboxOutlined style={{ fontSize: 24, color: 'var(--primary-color)' }} />}
            label="Expected Deliveries"
            value={quickStats.expectedDeliveries}
            unit="POs"
            background={isDarkMode ? '#312e81' : '#e0e7ff'}
          />
          {extraItems.length > 0 && <Divider style={{ margin: '4px 0' }} />}
          {extraItems.map((item) => (
            <QuickStatItem key={item.label} {...item} />
          ))}
        </Space>
      )}
    </Card>
  );
});

export default QuickStatsCard;
