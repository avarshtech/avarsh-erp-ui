import { useEffect, useMemo, useState } from 'react';
import { Select, Space, Tag, Typography } from 'antd';
import { listMappableOrders } from '../../../services/po/poOrderMappingService';
import { ORDER_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getStatusLabel } from '../../../utils/orderConstants';
import StatusTag from '../../../components/StatusTag';

const { Text } = Typography;

/**
 * Picker for the customer order that will receive stock. Only confirmed /
 * in-production orders are offered; each option shows buyer, style and how
 * many POs already feed it so a wrong pick is easy to spot.
 */
const OrderSelect = ({ value, onChange, disabled, placeholder = 'Select customer order', style }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listMappableOrders()
      .then((rows) => { if (alive) setOrders(rows); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const options = useMemo(() => orders.map((o) => ({
    value: o.id,
    label: `${o.orderNo} ${o.buyerName} ${o.styleNo} ${o.garmentName}`,
    order: o,
  })), [orders]);

  return (
    <Select
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
      labelRender={({ value: v }) => {
        const o = orders.find((x) => x.id === v);
        return o ? `${o.orderNo} · ${o.buyerName} · ${o.styleNo}` : v;
      }}
      optionRender={({ data }) => {
        const o = data.order;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
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
