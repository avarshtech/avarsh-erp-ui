import { hasModuleAccess } from '../../../utils/permissions';

const canRead = (source) => [].concat(source.perm).some((key) => hasModuleAccess(key));

/**
 * Reads the given sources in parallel. A source the user may not open is 'locked' (its keys are
 * removed); one that fails is 'error' (its last good data stays, marked stale); a module still on
 * mock data reads as 'demo'. Returns a patch so the caller merges it into the latest copy.
 */
export const loadSources = async (sources, ctx) => {
  const results = await Promise.all(sources.map(async (source) => {
    if (!canRead(source)) return { source, state: 'locked' };
    try {
      return { source, state: source.demo ? 'demo' : 'ok', value: await source.load(ctx) };
    } catch (error) {
      return { source, state: 'error', error: error?.errorMessage || error?.message || 'Could not load' };
    }
  }));

  const patch = {};
  const removed = [];
  const states = {};
  results.forEach(({ source, state, value, error }) => {
    states[source.id] = { state, label: source.label, error: error || null, at: ctx.at };
    if (state === 'locked') removed.push(...source.keys);
    if (state === 'ok' || state === 'demo') Object.assign(patch, value);
  });
  return { patch, removed, states };
};
