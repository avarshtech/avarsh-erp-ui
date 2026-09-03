import { Card, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../../components/StatusTag';
import { PO_STATUS_CONFIG } from '../../utils/statusConfig';
import { getStatusLabel } from '../../utils/poStatusConstants';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

/**
 * The purchase orders whose delivery date has been re-agreed since this order was placed, worst
 * slip first — so a "Supplier Delay" figure on the order can be traced to the PO that caused it.
 *
 * Renders nothing when there is no slipped PO, which is the common case: Order View is unchanged
 * for every order that is running to plan.
 */
const OrderPoDelayCard = ({ pos }) => {
  const navigate = useNavigate();

  if (!pos || pos.length === 0) return null;

  const columns = [
    {
      title: 'PO Number', dataIndex: 'poNumber', key: 'poNumber', width: 160,
      render: (v, r) => (
        <Text
          strong style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate(`/purchase-orders/supplier-po/list?viewId=${r.poId}`)}
        >
          {v}
        </Text>
      ),
    },
    { title: 'Supplier', dataIndex: 'supplierName', key: 'supplierName', ellipsis: true },
    {
      title: 'Original', dataIndex: 'deliveryDate', key: 'deliveryDate', width: 130,
      render: (v) => (
        <Text type="secondary" style={{ textDecoration: 'line-through' }}>{formatDate(v)}</Text>
      ),
    },
    {
      title: 'Revised', dataIndex: 'revisedDeliveryDate', key: 'revisedDeliveryDate', width: 130,
      render: (v) => <Text strong>{formatDate(v)}</Text>,
    },
    {
      title: 'Slip', dataIndex: 'delayDays', key: 'delayDays', width: 110,
      render: (days) => (
        <Tag color="error" style={{ margin: 0 }}>+{days} day{days === 1 ? '' : 's'}</Tag>
      ),
    },
    {
      title: 'PO Status', dataIndex: 'status', key: 'status', width: 165,
      render: (s) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <StatusTag status={s} config={PO_STATUS_CONFIG} getLabel={getStatusLabel} />
        </span>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title="Supplier Delays"
      style={{ marginTop: 16 }}
      extra={(
        <Text type="secondary" style={{ fontSize: 12 }}>
          Delivery dates re-agreed after these POs were sent
        </Text>
      )}
    >
      <Table
        rowKey="poId"
        size="small"
        bordered
        columns={columns}
        dataSource={pos}
        pagination={false}
        scroll={{ x: 850 }}
      />
    </Card>
  );
};

export default OrderPoDelayCard;
