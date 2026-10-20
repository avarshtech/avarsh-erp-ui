/**
 * Merges a finished load into the latest copy. Loads overlap (the 45 s tick, a feed nudge, Refresh)
 * and can finish out of order, so each key and each source state remembers the sequence number of
 * the load that last wrote it, and an older load never overwrites a newer one.
 */
export const mergeLoad = ({ raw, sources, written }, result, seq) => {
  const nextRaw = { ...raw };
  const nextSources = { ...sources };
  const newer = (key) => (written[key] || 0) > seq;
  Object.entries(result.patch).forEach(([key, value]) => {
    if (newer(key)) return;
    nextRaw[key] = value;
    written[key] = seq;
  });
  result.removed.forEach((key) => {
    if (newer(key)) return;
    delete nextRaw[key];
    written[key] = seq;
  });
  Object.entries(result.states).forEach(([id, state]) => {
    if (newer(`source:${id}`)) return;
    nextSources[id] = state;
    written[`source:${id}`] = seq;
  });
  return { raw: nextRaw, sources: nextSources };
};
