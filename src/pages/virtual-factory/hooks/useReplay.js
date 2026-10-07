import { useCallback, useEffect, useMemo, useState } from 'react';

const STEP_MS = 2600;

/**
 * "Replay today": today's transactions, one every few seconds in the order a garment order flows,
 * each as a fresh event so the floor animates it again. Stopping clears the replayed events.
 */
export const useReplay = (story) => {
  const [state, setState] = useState({ run: 0, index: -1 });
  const playing = state.index >= 0 && state.index < story.length - 1;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => setState((s) => ({ ...s, index: s.index + 1 })), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, state.index]);

  const events = useMemo(() => (state.index < 0 ? [] : story.slice(0, state.index + 1)
    .map((e) => ({ ...e, id: `replay-${state.run}-${e.id}`, replay: true }))), [story, state]);

  const start = useCallback(() => setState((s) => ({ run: s.run + 1, index: 0 })), []);
  const stop = useCallback(() => setState((s) => ({ ...s, index: -1 })), []);

  return { playing, active: state.index >= 0, events, start, stop, step: state.index + 1, total: story.length };
};
