import { useState, useEffect } from 'react';
import { Card, Select, Typography, Alert } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { searchOrders } from '../../../services/orders/orderService';

const { Text, Title } = Typography;

/**
 * Bare "/sample-requests/new" entry: pick a SAMPLE order to raise the SR
 * against. After a pick the dropdown itself carries the inline loading state
 * (spinner + "Loading order & BOM…") and the form page renders only once all
 * data has resolved — no skeleton flash in between.
 */
const SampleOrderPicker = ({ onPick, resolving = false, pickedOrderNo = null }) => {
  const [listLoading, setListLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    searchOrders({ orderType: 'SAMPLE', page: 0, size: 200 })
      .then(({ content }) => setOrders(content))
      .catch(() => setOrders([]))
      .finally(() => setListLoading(false));
  }, []);

  return (
    <Card style={{ maxWidth: 640, margin: '40px auto' }}>
      <Title level={5} style={{ marginTop: 0 }}>Select the sample order</Title>
      <Text type="secondary">
        A Sample Request tracks a SAMPLE-type order through dispatch and buyer approval.
        Its materials auto-populate from the order&apos;s BOM.
      </Text>
      <div style={{ marginTop: 16 }}>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Search sample orders…"
          style={{ width: '100%' }}
          value={pickedOrderNo || undefined}
          loading={listLoading || resolving}
          disabled={resolving}
          suffixIcon={resolving ? <LoadingOutlined spin /> : undefined}
          options={orders.map((o) => ({
            value: o.orderNo,
            label: `${o.orderNo} · ${o.styleNo || '—'} · ${o.buyerName || '—'} · ${o.totalOrderQty || 0} pcs`,
          }))}
          onChange={(orderNo) => onPick(orderNo)}
        />
        {resolving && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            <LoadingOutlined spin style={{ marginInlineEnd: 6 }} />
            Loading order &amp; BOM — auto-populating the sample request…
          </Text>
        )}
      </div>
      {!listLoading && !resolving && orders.length === 0 && (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="No sample orders yet"
          description='Create an order with Order Type = "Sample" first (Orders → New Order), give it a BOM, then raise the Sample Request from the BOM screen.'
        />
      )}
    </Card>
  );
};

export default SampleOrderPicker;
