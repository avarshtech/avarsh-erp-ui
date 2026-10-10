import { useState, useEffect, useMemo, useCallback } from 'react';
import { listConsigneeOrders } from '../../../services/expdoc/expDocService';
import { getStatusLabel } from '../../../utils/orderConstants';

const optionOf = ({ orderId, orderNo, styleNo, status }) => ({
  value: orderId,
  label: [orderNo, styleNo].filter(Boolean).join(' — ') + (status ? ` · ${getStatusLabel(status)}` : ''),
  order: { orderId, orderNo, styleNo: styleNo ?? null },
});

/**
 * The consignee's orders a shipment may carry, from GET /export-docs/shipments/order-options:
 * every one but Cancelled, at any stage (a shipment is often booked before its order
 * completes), at the working branch.
 *
 * Every order seen stays in the list, and `savedOrders` are merged in, so a selection
 * never turns into a bare id when a later search does not return it.
 */
const useConsigneeOrders = (buyerId, savedOrders) => {
  // Typed text is kept WITH its consignee: antd clears the box on select and on blur
  // without calling onSearch, so text typed for one must not become the next one's search.
  const [typed, setTyped] = useState({ buyerId: null, text: '' });
  const [settled, setSettled] = useState(typed);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const search = settled.buyerId === buyerId ? settled.text.trim() : '';
  const requestKey = buyerId != null ? `${buyerId}|${search}` : null;

  const [seen, setSeen] = useState({ buyerId: null, rows: [] });
  // Which request last answered, and how; loading is "the current one has not yet".
  const [answered, setAnswered] = useState({ requestKey: null, failed: false });

  useEffect(() => {
    if (buyerId == null) return undefined;
    let cancelled = false;
    listConsigneeOrders(buyerId, search)
      .then((rows) => {
        if (cancelled) return;
        setSeen((prev) => {
          const kept = prev.buyerId === buyerId ? [...prev.rows] : [];
          rows.forEach((o) => { if (!kept.some((r) => r.orderId === o.orderId)) kept.push(o); });
          return { buyerId, rows: kept };
        });
        setAnswered({ requestKey, failed: false });
      })
      // The interceptor has already toasted; the dropdown says so in place.
      .catch(() => { if (!cancelled) setAnswered({ requestKey, failed: true }); });
    return () => { cancelled = true; };
  }, [buyerId, search, requestKey]);

  const options = useMemo(() => {
    const out = (seen.buyerId === buyerId ? seen.rows : []).map(optionOf);
    (savedOrders || []).forEach((o) => {
      if (!out.some((x) => x.value === o.orderId)) out.push(optionOf(o));
    });
    return out;
  }, [seen, buyerId, savedOrders]);

  const onSearch = useCallback((text) => setTyped({ buyerId, text }), [buyerId]);
  const loading = Boolean(requestKey) && answered.requestKey !== requestKey;
  const failed = answered.requestKey === requestKey && answered.failed;
  return { options, loading, failed, onSearch };
};

export default useConsigneeOrders;
