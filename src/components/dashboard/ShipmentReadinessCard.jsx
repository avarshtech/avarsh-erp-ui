import { memo } from 'react';
import { Progress, Skeleton, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

/** How far off an ETD is, in words a reader can act on. */
const etdLabel = (days) => {
  if (days == null) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `${days}d`;
};

const etdColour = (days, atRisk) => {
  if (days == null) return 'default';
  if (days < 0) return 'red';
  if (atRisk) return 'orange';
  return 'default';
};

/**
 * Shipment readiness (PRD §11.1) — how close each open shipment is to having its
 * documents finished, soonest sailing first.
 *
 * Readiness is four steps rather than a percentage of cartons: cartons entered, a
 * packing list raised, every packing list approved, every invoice approved. A
 * shipment 95% packed but with nothing approved is not 95% documented.
 */
const ShipmentReadinessCard = memo(function ShipmentReadinessCard({ rows, total, loading }) {
  const navigate = useNavigate();
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  const columns = [
    {
      title: 'Shipment',
      dataIndex: 'shipmentNo',
      key: 'shipmentNo',
      width: 130,
      render: (v, r) => (
        <Text
          strong
          style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate(r.route)}
        >
          {v}
        </Text>
      ),
    },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 150, ellipsis: true },
    {
      title: 'ETD',
      key: 'etd',
      width: 150,
      render: (_, r) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatDate(r.etd)}
          {' '}
          <Tag color={etdColour(r.daysToEtd, r.atRisk)} style={{ marginInlineEnd: 0 }}>{etdLabel(r.daysToEtd)}</Tag>
        </span>
      ),
    },
    {
      title: 'Packing lists',
      key: 'pls',
      width: 120,
      render: (_, r) => (r.packingLists
        ? <Text>{`${r.packingListsApproved} of ${r.packingLists} approved`}</Text>
        : <Text type="secondary">None raised</Text>),
    },
    {
      title: 'Invoices',
      key: 'invoices',
      width: 120,
      render: (_, r) => (r.invoices
        ? <Text>{`${r.invoicesApproved} of ${r.invoices} approved`}</Text>
        : <Text type="secondary">None raised</Text>),
    },
    {
      title: 'Readiness',
      key: 'readiness',
      width: 130,
      render: (_, r) => (
        <Progress
          percent={r.readinessPercent}
          size="small"
          status={r.atRisk ? 'exception' : (r.readinessPercent === 100 ? 'success' : 'active')}
        />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={rows || []}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ x: 800 }}
      locale={{ emptyText: <Text type="secondary">No open shipments.</Text> }}
      footer={total > (rows || []).length
        ? () => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`Showing ${rows.length} of ${total} open shipments — the rest are in the Shipment Register.`}
          </Text>
        )
        : undefined}
    />
  );
});

export default ShipmentReadinessCard;
