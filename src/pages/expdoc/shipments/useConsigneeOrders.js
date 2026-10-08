import { useState, useEffect, useMemo, useCallback } from 'react';
import { searchOrders } from '../../../services/orders/orderService';
import { ORDER_STATUS, getStatusLabel } from '../../../utils/orderConstants';

const optionOf = ({ orderId, orderNo, styleNo, status }) => ({
  value: orderNo,
  label: [orderNo, styleNo].filter(Boolean).join(' — ') + (status ? ` · ${getStatusLabel(status)}` : ''),
  order: { orderId: orderId ?? null, orderNo, styleNo: styleNo ?? null },
});

/**
 * The consignee's orders a shipment may carry: every one except Cancelled, at any
 * stage — a shipment is often booked before its order completes.
 *
 * `/orders/search` has no buyer filter, so it is asked for the buyer's name (or what
 * the user types) and narrowed here by buyer id. Every order seen stays in the list,
 * and `savedOrders` are merged in, so a selection never turns into a bare order
 * number when a later search does not return it.
 */
const useConsigneeOrders = (buyer, savedOrders) => {
  const buyerId = buyer?.id ?? null;
  const buyerName = buyer?.name ?? null;
  const buyerKey = buyerId ?? buyerName;
  // Typed text is kept WITH its consignee: antd clears the box on select and on blur
  // without calling onSearch, so text typed for one must not become the next one's search.
  const [typed, setTyped] = useState({ buyerKey: null, text: '' });
  const [settled, setSettled] = useState(typed);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const search = settled.buyerKey === buyerKey ? settled.text : '';
  const requestKey = buyerName ? `${buyerKey}|${search}` : null;

  const [seen, setSeen] = useState({ buyerKey: null, rows: [] });
  // Which request last answered, and how; loading is "the current one has not yet".
  const [answered, setAnswered] = useState({ requestKey: null, error: null });

  useEffect(() => {
    if (!buyerName) return undefined;
    let cancelled = false;
    searchOrders({ search: search || buyerName, page: 0, size: 100 })
      .then(({ content }) => {
        if (cancelled) return;
        const mine = content.filter((o) => o.status !== ORDER_STATUS.CANCELLED
          && (buyerId != null ? o.buyerId === buyerId : o.buyerName === buyerName));
        setSeen((prev) => {
          const rows = prev.buyerKey === buyerKey ? [...prev.rows] : [];
          mine.forEach((o) => { if (!rows.some((r) => r.orderNo === o.orderNo)) rows.push(o); });
          return { buyerKey, rows };
        });
        setAnswered({ requestKey, error: null });
      })
      // The interceptor has already toasted; the dropdown names the cause in place.
      .catch((e) => {
        if (!cancelled) setAnswered({ requestKey, error: e?.response?.status === 403 ? 'FORBIDDEN' : 'FAILED' });
      });
    return () => { cancelled = true; };
  }, [buyerId, buyerName, buyerKey, search, requestKey]);

  const options = useMemo(() => {
    const rows = seen.buyerKey === buyerKey ? seen.rows : [];
    const out = rows.map((o) => optionOf({ orderId: o.id, orderNo: o.orderNo, styleNo: o.styleNo, status: o.status }));
    (savedOrders || []).forEach((o) => {
      if (!out.some((x) => x.value === o.orderNo)) out.push(optionOf(o));
    });
    return out;
  }, [seen, buyerKey, savedOrders]);

  const onSearch = useCallback((text) => setTyped({ buyerKey, text }), [buyerKey]);
  const loading = Boolean(requestKey) && answered.requestKey !== requestKey;
  const error = answered.requestKey === requestKey ? answered.error : null;
  return { options, loading, error, onSearch };
};

export default useConsigneeOrders;
