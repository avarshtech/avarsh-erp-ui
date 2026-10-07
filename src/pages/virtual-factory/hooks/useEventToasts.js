import { useCallback, useEffect, useMemo, useState } from 'react';

const SHOW_MS = 9000;
const MAX = 3;

/**
 * High-priority business events as toasts: only events that arrive while the screen is open (the
 * ones already listed are history), at most three at a time, gone after a few seconds or on close.
 */
export const useEventToasts = (events) => {
  const [initial] = useState(() => new Set(events.map((e) => e.id)));
  const [dismissed, setDismissed] = useState(() => new Set());

  const toasts = useMemo(() => events
    .filter((e) => e.priority === 'high' && !initial.has(e.id) && !dismissed.has(e.id))
    .slice(-MAX), [events, initial, dismissed]);

  const dismiss = useCallback((id) => setDismissed((set) => new Set(set).add(id)), []);

  const ids = JSON.stringify(toasts.map((t) => t.id));
  useEffect(() => {
    const shown = JSON.parse(ids);
    if (!shown.length) return undefined;
    const timer = setTimeout(() => shown.forEach(dismiss), SHOW_MS);
    return () => clearTimeout(timer);
  }, [ids, dismiss]);

  return { toasts, dismiss };
};
