import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the viewer asked the system for less motion: the factory then holds still. */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false));
  useEffect(() => {
    const query = window.matchMedia?.(QUERY);
    if (!query) return undefined;
    const onChange = (e) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
};
