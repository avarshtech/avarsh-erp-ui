/**
 * Browser home of the inward job-work demo (UI mock round 2). It is seeded from the Outward demo's
 * date, so the order both demos share agrees on its dates. Never reaches the API.
 */
import { createDemoStore } from './demoStore';
import { buildInwardSeed, INWARD_SEED_VERSION } from './inwardSeed';
import { loadTrackerDb } from './jobWorkTrackerStore';

export const INWARD_STORAGE_KEY = 'avarsh.production.jobWorkInward.mockStore.v1';

const store = createDemoStore({
  storageKey: INWARD_STORAGE_KEY,
  seedVersion: INWARD_SEED_VERSION,
  buildSeed: (today) => buildInwardSeed(loadTrackerDb().seededOn || today),
});

export const loadInwardDb = store.load;
export const resetInwardDb = store.reset;
/** Run `fn(db)` against a copy and commit only if it returns (see createDemoStore). */
export const mutateInwardDb = store.mutate;
