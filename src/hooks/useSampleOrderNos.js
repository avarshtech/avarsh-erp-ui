import { useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { searchOrders } from '../services/orders/orderService';

/**
 * Cached set of SAMPLE-order numbers (StoreContext, 5-min TTL) so any screen
 * showing an orderNo can badge sample records without extra API calls.
 * OrderForm invalidates the 'sampleOrderNos' cache key on save.
 */
const useSampleOrderNos = () => {
  const { sampleOrderNos, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('sampleOrderNos') || loading.sampleOrderNos) return;
    setLoading('sampleOrderNos', true);
    searchOrders({ orderType: 'SAMPLE', page: 0, size: 500 })
      .then(({ content }) => setData('sampleOrderNos', content.map((o) => o.orderNo)))
      .catch(() => setData('sampleOrderNos', []))
      .finally(() => setLoading('sampleOrderNos', false));
  }, [isCacheValid, loading.sampleOrderNos, setData, setLoading]);

  const sampleSet = useMemo(() => new Set(sampleOrderNos), [sampleOrderNos]);
  const isSampleOrder = useCallback((orderNo) => sampleSet.has(orderNo), [sampleSet]);

  return { isSampleOrder };
};

export default useSampleOrderNos;
