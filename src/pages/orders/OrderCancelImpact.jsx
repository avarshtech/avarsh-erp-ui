import { useEffect, useMemo, useState } from 'react';
import { Alert, Table, Tag, Typography } from 'antd';
import { getOrderCancelImpact } from '../../services/orders/orderService';

const { Text } = Typography;

const ACTION = {
  AUTO_CANCEL: { color: 'orange', label: 'Cancelled with the order' },
  BLOCKS: { color: 'red', label: 'Clear it first' },
  INFO: { color: 'default', label: 'Stays as it is' },
};

const KIND = {
  SUPPLIER_PO: 'Supplier PO', CUTTING_PO: 'Cutting PO', WORK_ORDER: 'Work Order', FINISHING_PO: 'Finishing PO',
  CUT_PANEL_PO: 'Cut Panel PO', GARMENT_PROCESS_PO: 'Garment Process PO', SHIPMENT: 'Shipment', SAMPLE_REQUEST: 'Sample request',
};

/**
 * What cancelling the order does to the documents raised against it, shown before the request is sent.
 * Reports whether the cancellation may be requested through onCancellable (false while anything blocks).
 */
const OrderCancelImpact = ({ orderId, onCancellable }) => {
  const [impact, setImpact] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getOrderCancelImpact(orderId)
      .then((data) => { if (live) { setImpact(data); onCancellable(data.cancellable); } })
      .catch(() => { if (live) { setFailed(true); onCancellable(true); } });
    return () => { live = false; };
  }, [orderId, onCancellable]);

  const columns = useMemo(() => [
    { title: 'Document', dataIndex: 'number', render: (v, r) => <><Text code>{v}</Text> <Text type="secondary">{KIND[r.kind] || r.kind}</Text></> },
    { title: 'Status', dataIndex: 'status', width: 140, render: (v) => v?.replace(/_/g, ' ') },
    { title: 'On cancellation', dataIndex: 'action', width: 190,
      render: (v, r) => <><Tag color={ACTION[v]?.color}>{ACTION[v]?.label || v}</Tag><div><Text type="secondary" style={{ fontSize: 12 }}>{r.note}</Text></div></> },
  ], []);

  if (failed) return <Alert type="warning" showIcon title="Could not check the documents raised against this order." />;
  if (!impact) return null;
  if (!impact.items.length) return <Text type="secondary">No purchase, production or shipping documents are raised against this order.</Text>;
  return (
    <>
      {!impact.cancellable && (
        <Alert type="error" showIcon style={{ marginBottom: 8 }}
          title="This order cannot be cancelled yet: clear the documents marked 'Clear it first'." />
      )}
      <Table size="small" rowKey={(r) => `${r.kind}-${r.id}`} columns={columns} dataSource={impact.items} pagination={false} />
    </>
  );
};

export default OrderCancelImpact;
