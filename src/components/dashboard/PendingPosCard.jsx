import { memo, useMemo } from 'react';
import { Card, Table, Tag, Typography } from 'antd';

const { Text } = Typography;

// PO status (backend POStatus enum) → AntD tag color
const PO_STATUS_COLORS = {
  Draft: 'default',
  Pending_Approval: 'processing',
  Rejected: 'red',
  Referred_Back: 'gold',
  Sent_To_Supplier: 'blue',
  Partially_Received: 'orange',
  Completed: 'green',
  Cancelled: 'red',
};

const humanize = (s) => (s || '').replace(/_/g, ' ');

const formatAmount = (amount) =>
  amount != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    : '—';

const PendingPosCard = memo(function PendingPosCard({ pos = [], loading = false }) {
  const columns = useMemo(() => [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      render: (text) => <Text strong>{text}</Text>,
    },
    { title: 'Supplier', dataIndex: 'supplier', key: 'supplier', ellipsis: true },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => <Text strong style={{ color: 'var(--success-color)' }}>{formatAmount(amount)}</Text>,
    },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', render: (d) => d || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => <Tag color={PO_STATUS_COLORS[status] || 'default'}>{humanize(status)}</Tag>,
    },
  ], []);

  return (
    <Card title="Pending Supplier PO" extra={<a href="/purchase-orders/supplier-po/list">View All</a>}>
      <Table
        rowKey={(r) => r.poNumber}
        columns={columns}
        dataSource={pos}
        loading={loading}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
});

export default PendingPosCard;
