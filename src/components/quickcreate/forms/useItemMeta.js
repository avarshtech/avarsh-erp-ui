import { useEffect, useState } from 'react';
import { getItemMetaData } from '../../../services/master/itemService';
import { getAllAttributes, getAllUOMs } from '../../../services/master/masterDataService';

const list = (res) => (Array.isArray(res) ? res : res?.data || res?.content || []);

/**
 * The classifier tree (category → sub-categories → item types with their attributes and UOMs)
 * plus every UOM and attribute, which a NEW item type chooses from.
 */
export default function useItemMeta() {
  const [meta, setMeta] = useState({ categories: [], uoms: [], attributes: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getItemMetaData(), getAllUOMs(), getAllAttributes()]).then(([cats, uoms, attrs]) => {
      if (cancelled) return;
      setMeta({
        categories: cats.status === 'fulfilled' ? list(cats.value) : [],
        uoms: uoms.status === 'fulfilled' ? list(uoms.value) : [],
        attributes: attrs.status === 'fulfilled' ? list(attrs.value) : [],
        loading: false,
      });
    });
    return () => { cancelled = true; };
  }, []);

  return meta;
}
