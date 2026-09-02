import { memo } from 'react';
import { Skeleton, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../StatusTag';
import { PL_STATUS_CONFIG } from '../../utils/statusConfig';
import { PL_STATUS_LABELS } from '../../utils/expDocConstants';

const { Text } = Typography;

const KIND_LABEL = { PACKING_LIST: 'Packing list', EXPORT_INVOICE: 'Invoice' };
const KIND_COLOUR = { PACKING_LIST: 'green', EXPORT_INVOICE: 'gold' };

/**
 * Export documents still in flight (PRD §11.1), oldest first.
 *
 * "Waiting on" is the column that makes this useful: a submitted document is an
 * approver's problem and a draft is its author's, and a reader should not have to
 * infer which from a status name.
 */
const ExportDocsPendingCard = memo(function ExportDocsPendingCard({ rows, total, loading }) {
  const navigate = useNavigate();
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  const columns = [
    {
      title: 'Document',
      dataIndex: 'docNo',
      key: 'docNo',
      width: 150,
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
    {
      title: 'Type',
      dataIndex: 'kind',
      key: 'kind',
      width: 120,
      render: (k) => <Tag color={KIND_COLOUR[k]} style={{ marginInlineEnd: 0 }}>{KIND_LABEL[k] || k}</Tag>,
    },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 150, ellipsis: true },
    { title: 'Shipment', dataIndex: 'shipmentNo', key: 'shipmentNo', width: 120 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      // Packing-list and invoice statuses share these five names and colours, so one
      // config renders both without pretending they are the same entity.
      render: (s) => <StatusTag status={s} config={PL_STATUS_CONFIG} getLabel={(x) => PL_STATUS_LABELS[x] || x} />,
    },
    {
      title: 'Waiting on',
      dataIndex: 'waitingOn',
      key: 'waitingOn',
      width: 150,
      ellipsis: true,
      render: (v) => <Text type="secondary">{v}</Text>,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={rows || []}
      rowKey={(r) => `${r.kind}-${r.id}`}
      size="small"
      pagination={false}
      scroll={{ x: 820 }}
      locale={{ emptyText: <Text type="secondary">Nothing is waiting — every export document is approved.</Text> }}
      footer={total > (rows || []).length
        ? () => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`Showing the ${rows.length} oldest of ${total} open documents.`}
          </Text>
        )
        : undefined}
    />
  );
});

export default ExportDocsPendingCard;
