import { useEffect, useState } from 'react';
import { getItemById, searchItems } from '../../../services/master/itemService';

const firstItem = (res) => res?.data?.content?.[0] || res?.content?.[0] || null;

/**
 * The item already saved for this Category / Sub-category / Item Type — a new variant is then
 * added to it rather than a twin item created — and, failing that, any item in the same
 * sub-category, whose HSN and allowance make a good default for a new one.
 */
export default function useExistingItem(categoryId, subCategoryId, itemTypeId) {
  const key = `${categoryId}|${subCategoryId}|${itemTypeId}`;
  const [found, setFound] = useState({ key: null, existing: null, sibling: null });

  useEffect(() => {
    if (typeof subCategoryId !== 'number') return undefined;
    const complete = typeof categoryId === 'number' && typeof itemTypeId === 'number';
    let cancelled = false;
    (async () => {
      const hit = complete
        ? firstItem(await searchItems({ categoryId, subCategoryId, itemTypeId, page: 0, size: 1 }))
        : null;
      // The full item, so its variants come with their attribute values.
      const full = hit ? await getItemById(hit.id).catch(() => null) : null;
      const existing = hit ? (full?.data || full || hit) : null;
      const sibling = existing || firstItem(await searchItems({ subCategoryId, page: 0, size: 1 }));
      if (!cancelled) setFound({ key, existing, sibling });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [key, categoryId, subCategoryId, itemTypeId]);

  return found.key === key ? found : { existing: null, sibling: null };
}
