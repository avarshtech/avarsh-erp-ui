import { useCallback, useRef, useState } from 'react';
import { getLastPrices, getVariantPastPrices } from '../../../../services/costing/costingPriceService';
import { unwrapList } from '../model/masterOptions';

/**
 * What each variant was last bought at (recent PO prices) and last costed at (its latest cost
 * sheet), fetched once per variant when its rate cell asks. prices[variantId] is undefined until
 * loaded, then { po: [...], costing: { price, currency, costingId, date } | null }.
 */
export default function usePastPrices() {
  const [prices, setPrices] = useState({});
  const requested = useRef(new Set());

  const load = useCallback((variantId) => {
    if (!variantId || requested.current.has(variantId)) return;
    requested.current.add(variantId);
    Promise.allSettled([getVariantPastPrices(variantId), getLastPrices([variantId])]).then(([po, last]) => {
      const latest = last.status === 'fulfilled' ? unwrapList(last.value).find((l) => l.variantId === variantId) : null;
      setPrices((p) => ({
        ...p,
        [variantId]: {
          po: po.status === 'fulfilled' ? unwrapList(po.value) : [],
          costing: latest?.costingPrice != null ? {
            price: Number(latest.costingPrice), currency: latest.costingCurrency || 'INR', costingId: latest.costingId, date: latest.costingDate,
          } : null,
        },
      }));
    });
  }, []);

  return { prices, load };
}
