import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchVariants } from '../../../../services/master/variantService';
import { unwrapList } from '../model/masterOptions';

// The server returns at most 50 variants per call: the newest 50 are preloaded, and typing
// searches the server, so every variant in a large category stays reachable.
const LIMIT = 50;

const fetchVariants = (category, q) =>
  searchVariants({ category, q, limit: LIMIT }).then(unwrapList).catch(() => []);

/** Picker options for one variant section, keyed by variant id so a variant is never listed twice. */
export default function useVariantOptions(category) {
  const [byId, setById] = useState(() => new Map());
  const timer = useRef(null);

  const register = useCallback((variants) => setById((prev) => {
    const next = new Map(prev);
    (Array.isArray(variants) ? variants : [variants]).filter(Boolean).forEach((v) => next.set(v.id, v));
    return next;
  }), []);

  useEffect(() => {
    if (!category) return undefined;
    let cancelled = false;
    fetchVariants(category, '').then((list) => { if (!cancelled) register(list); });
    return () => { cancelled = true; };
  }, [category, register]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = useCallback((text) => {
    clearTimeout(timer.current);
    const q = (text || '').trim();
    if (!category || q.length < 2) return;
    timer.current = setTimeout(() => fetchVariants(category, q).then(register), 300);
  }, [category, register]);

  const options = useMemo(() => [...byId.values()].map((v) => ({
    value: v.id, label: v.variantName || v.variantCode, variantCode: v.variantCode,
  })), [byId]);

  const get = useCallback((id) => byId.get(id), [byId]);

  return useMemo(() => ({ category, options, get, register, search }), [category, options, get, register, search]);
}
