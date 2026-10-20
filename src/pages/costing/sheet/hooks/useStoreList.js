import { useCallback, useEffect } from 'react';
import { useStore } from '../../../../context/StoreContext';
import { unwrapList } from '../model/masterOptions';

/**
 * A StoreContext master list (buyers, suppliers, size presets): served from the store while
 * its cache is fresh, fetched once otherwise. `add` puts a quick-created record in the store,
 * so every screen that reads the key sees it without a refetch.
 */
export default function useStoreList(key, fetcher) {
  const { [key]: list, isCacheValid, setData, addItem } = useStore();
  const fresh = isCacheValid(key);

  useEffect(() => {
    if (fresh) return undefined;
    let cancelled = false;
    fetcher()
      .then((res) => { if (!cancelled) setData(key, unwrapList(res)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fresh, key, fetcher, setData]);

  const add = useCallback((item) => addItem(key, item), [addItem, key]);
  return [list || [], add];
}
