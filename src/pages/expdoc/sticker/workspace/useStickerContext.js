import { useCallback, useEffect, useState } from 'react';
import { getStickerContext } from '../../../../services/expdoc/expDocService';

/**
 * Everything the workspace prints from, for one packing list, scope and layout choice.
 *
 * Only the latest request may land: an answer for an earlier scope or layout that
 * arrives late is dropped, never shown over a newer one. The skeleton is for the first
 * load only — a later one (another scope, another layout, a finished run) keeps the page
 * on screen and reports `reloading`. A failed load can be retried.
 */
const useStickerContext = (plId, scope, templateId) => {
  // Bumped to load again with the same inputs: after a run is recorded, or on Retry.
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState({ key: null, ctx: null, error: null });
  const key = JSON.stringify([plId, scope, templateId ?? null, attempt]);

  useEffect(() => {
    let latest = true;
    getStickerContext(plId, { scope, templateId })
      .then((ctx) => { if (latest) setLoaded({ key, ctx, error: null }); })
      .catch((e) => { if (latest) setLoaded((l) => ({ ...l, error: e.message || 'Failed to load' })); });
    return () => { latest = false; };
  }, [plId, scope, templateId, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = useCallback(() => {
    setLoaded((l) => ({ ...l, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return {
    ctx: loaded.ctx,
    error: loaded.error,
    loading: !loaded.ctx && !loaded.error,
    reloading: Boolean(loaded.ctx) && loaded.key !== key,
    reload,
    retry,
  };
};

export default useStickerContext;
