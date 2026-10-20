/**
 * A browser home for one Job Work demo (mock rounds 1 and 2). One localStorage key holds the whole
 * demo so a reload keeps the reviewer's changes; a seed version bump or "Reset demo data" re-seeds it
 * relative to today. Never reaches the API.
 */
import dayjs from 'dayjs';
import { iso } from '../../../utils/jobWorkTracker/workingDays';

export const createDemoStore = ({ storageKey, seedVersion, buildSeed }) => {
  let memory = null;

  const persist = (db) => {
    memory = db;
    try {
      localStorage.setItem(storageKey, JSON.stringify(db));
    } catch { /* storage full or blocked: keep it in memory for this tab */ }
  };

  const reset = () => {
    const fresh = buildSeed(iso(dayjs()));
    persist(fresh);
    return fresh;
  };

  const load = () => {
    if (memory?.seedVersion === seedVersion) return memory;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.seedVersion === seedVersion) {
          memory = parsed;
          return memory;
        }
      }
    } catch { /* unreadable: fall through to a fresh seed */ }
    return reset();
  };

  /**
   * Run `fn(db)` against a copy of the demo and commit it only if `fn` returns, so a refused write
   * (fn throws) leaves nothing half-applied — the way a rolled-back transaction would.
   */
  const mutate = (fn) => {
    const db = JSON.parse(JSON.stringify(load()));
    const result = fn(db);
    persist(db);
    return result;
  };

  return { load, save: persist, reset, mutate };
};
