import { useEffect, useState } from 'react';
import { useStore } from '../../../context/StoreContext';
import { getBuyers } from '../../../services/master/buyerService';

/**
 * The buyer master, for the template screens: cached in StoreContext like everywhere
 * else (fetch-or-reuse, the ShipmentForm pattern). Packing-list and invoice templates
 * belong to one of these buyers.
 */
const useExportBuyers = () => {
  const { buyers: storeBuyers, setData, isCacheValid, setLoading: setStoreLoading } = useStore();
  const [buyers, setBuyers] = useState(storeBuyers || []);
  const [loading, setLoading] = useState(!(storeBuyers || []).length);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isCacheValid('buyers') && storeBuyers.length) {
        setBuyers(storeBuyers);
        setLoading(false);
        return;
      }
      setStoreLoading('buyers', true);
      try {
        const data = await getBuyers();
        const list = Array.isArray(data) ? data : data?.content || [];
        if (cancelled) return;
        setBuyers(list);
        setData('buyers', list);
      } catch {
        if (!cancelled) setBuyers([]);
      } finally {
        setStoreLoading('buyers', false);
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // Loaded once per mount; the store keeps it fresh for the other screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { buyers, loading };
};

export default useExportBuyers;
