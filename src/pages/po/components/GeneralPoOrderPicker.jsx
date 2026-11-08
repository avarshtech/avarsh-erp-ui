import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select, Spin } from 'antd';
import { searchOrders } from '../../../services/orders/orderService';

/** An order from /orders/search as the PO's order reference ({orderId, orderNo, styleName, ...}). */
const toRef = (order) => ({
  orderId: order.id,
  orderNo: order.orderNo,
  styleId: order.styleId ?? null,
  styleName: order.styleNo || order.garmentName || null,
  season: order.season || null,
  buyerName: order.buyerName || null,
});

const labelOf = (ref) => [ref.orderNo, ref.styleName, ref.buyerName].filter(Boolean).join(' · ');

/**
 * The order(s) a General PO buys for ("if General PO then it should be associated to an order").
 * A Form.Item control: its value is the PO's order references, so a saved PO's references load back
 * as they are, and its label shows even when that order is not on the current search page.
 */
export default function GeneralPoOrderPicker({ id, value, onChange, disabled }) {
  const refs = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const latest = useRef(0);

  const search = useCallback((text) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++latest.current;
      setLoading(true);
      try {
        const page = await searchOrders({ search: text?.trim() || undefined, size: 20, sort: 'id', direction: 'desc' });
        if (mine !== latest.current) return; // a later search answered first
        setFound(page.content.filter((o) => o.status !== 'CANCELLED').map(toRef));
      } catch {
        if (mine === latest.current) setFound([]);
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
  }, [search]);

  const options = useMemo(() => {
    const byId = new Map();
    [...refs, ...found].forEach((ref) => {
      if (ref?.orderId != null && !byId.has(ref.orderId)) byId.set(ref.orderId, ref);
    });
    return [...byId.values()].map((ref) => ({ value: ref.orderId, label: labelOf(ref) }));
  }, [refs, found]);

  const handleChange = (ids) => {
    // a reference already on the PO keeps what it was saved with
    const pool = new Map([...found, ...refs].filter((r) => r?.orderId != null).map((r) => [r.orderId, r]));
    onChange?.(ids.map((orderId) => pool.get(orderId)).filter(Boolean));
  };

  return (
    <Select
      id={id}
      mode="multiple"
      placeholder="Search order no, style or buyer"
      value={refs.map((r) => r.orderId).filter((v) => v != null)}
      onChange={handleChange}
      options={options}
      showSearch={{ filterOption: false, onSearch: search }}
      onOpenChange={(open) => { if (open && found.length === 0) search(''); }}
      notFoundContent={loading ? <Spin size="small" /> : 'No orders found'}
      loading={loading}
      disabled={disabled}
      allowClear
    />
  );
}
