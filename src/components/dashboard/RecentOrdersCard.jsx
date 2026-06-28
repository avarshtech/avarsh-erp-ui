import { memo, useMemo } from 'react';
import { Card, Table, Tag, Typography } from 'antd';

const { Text } = Typography;

// Order status (backend OrderStatus enum) → AntD tag color
const ORDER_STATUS_COLORS = {
  DRAFT: 'default',
  CONFIRMED: 'processing',
  IN_PRODUCTION: 'blue',
  REFER_BACK_REQUESTED: 'gold',
  REFERRED_BACK: 'gold',
  CANCEL_REQUESTED: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const humanize = (s) =>
  (s || '').toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const RecentOrdersCard = memo(function RecentOrdersCard({ orders = [], loading = false }) {
  const columns = useMemo(() => [
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (text) => <Text strong style={{ color: 'var(--primary-color)' }}>{text}</Text>,
    },
    { title: 'Customer', dataIndex: 'customer', key: 'customer', ellipsis: true },
    { title: 'Product', dataIndex: 'product', key: 'product', ellipsis: true },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (qty) => (qty != null ? qty.toLocaleString() : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => <Tag color={ORDER_STATUS_COLORS[status] || 'default'}>{humanize(status)}</Tag>,
    },
    { title: 'Date', dataIndex: 'date', key: 'date' },
  ], []);

  return (
    <Card title="Recent Orders" extra={<a href="/orders/list">View All</a>}>
      <Table
        rowKey={(r) => r.orderId}
        columns={columns}
        dataSource={orders}
        loading={loading}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
});

export default RecentOrdersCard;
