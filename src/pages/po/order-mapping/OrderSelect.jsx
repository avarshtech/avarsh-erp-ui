import { useEffect, useMemo, useState } from 'react';
import { Empty, Select, Space, Tag, Typography } from 'antd';
import { listMappableOrdersForLine } from '../../../services/po/poOrderMappingService';
import { ORDER_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getStatusLabel } from '../../../utils/orderConstants';
import StatusTag from '../../../components/StatusTag';

const { Text } = Typography;

/**
 * Picker for the customer order that will receive stock.
 *
 * Only orders whose BOM actually consumes this line's variant are offered. Asking per
 * line rather than once for the drawer is the point: two lines of the same PO buying
 * different colours of one fabric belong to different orders, and the old unfiltered
 * list offered every confirmed bulk order to both.
 */
// `id` is injected by Form.Item and has to reach the Select: antd renders the
// item's <label for> from the same value, and without it the label points at
// nothing.
const OrderSelect = ({ id, value, onChange, disabled, placeholder = 'Select customer order', style, poLineItemId, lineLabel }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Resolved rather than returned early, so every state change happens in a callback:
    // setting state straight from an effect body cascades renders.
    const fetchOrders = poLineItemId
      ? listMappableOrdersForLine(poLineItemId)
      : Promise.resolve([]);
    fetchOrders
      .then((rows) => { if (alive) setOrders(rows || []); })
      // Without this the rejection escapes unhandled: the interceptor toasts the failure
      // but nothing here was ever catching it, because under the mock it could not reject.
      .catch(() => { if (alive) setOrders([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [poLineItemId]);

  const options = useMemo(() => orders.map((o) => ({
    value: o.id,
    label: `${o.orderNo} ${o.buyerName} ${o.styleNo} ${o.garmentName}`,
    order: o,
  })), [orders]);

  return (
    <Select
      id={id}
      showSearch
      allowClear
      loading={loading}
      disabled={disabled}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      optionFilterProp="label"
      options={options}
      style={{ minWidth: 320, ...style }}
      popupMatchSelectWidth={420}
      // An empty list is a normal answer — a General PO is often raised before the
      // order's BOM exists — so say which variant found nothing and what to do about
      // it. antd's bare "No data" reads as a broken screen.
      notFoundContent={loading ? null : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          styles={{ image: { height: 40 } }}
          description={
            <Space orientation="vertical" size={2}>
              <Text style={{ fontSize: 13 }}>
                No confirmed order uses {lineLabel || 'this variant'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Add it to the order&apos;s BOM, then map this line.
              </Text>
            </Space>
          }
        />
      )}
      labelRender={({ value: v }) => {
        const o = orders.find((x) => x.id === v);
        return o ? `${o.orderNo} · ${o.buyerName} · ${o.styleNo}` : v;
      }}
      optionRender={({ data }) => {
        const o = data.order;
        return (
          <Space orientation="vertical" size={0} style={{ width: '100%' }}>
            <Space size={8}>
              <Text strong>{o.orderNo}</Text>
              <StatusTag status={o.status} config={ORDER_STATUS_CONFIG} getLabel={getStatusLabel} size="small" />
              {o.linkedPoCount > 0 && <Tag style={{ fontSize: 11 }}>{o.linkedPoCount} PO{o.linkedPoCount > 1 ? 's' : ''} linked</Tag>}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {o.buyerName} · {o.styleNo} · {o.garmentName} · {o.season}
            </Text>
          </Space>
        );
      }}
    />
  );
};

export default OrderSelect;
