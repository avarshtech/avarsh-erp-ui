/**
 * Browser home of the Job Work Tracker demo data (UI mock round 1). One localStorage key holds the
 * whole demo so a reload keeps the reviewer's changes; a seed version bump or "Reset demo data"
 * re-seeds it relative to today. Never reaches the API.
 */
import dayjs from 'dayjs';
import { buildTrackerSeed, TRACKER_SEED_VERSION } from './jobWorkTrackerSeed';
import { createDemoStore } from './demoStore';
import { iso } from '../../../utils/jobWorkTracker/workingDays';

export const TRACKER_STORAGE_KEY = 'avarsh.production.jobWorkTracker.mockStore.v1';

const store = createDemoStore({ storageKey: TRACKER_STORAGE_KEY, seedVersion: TRACKER_SEED_VERSION, buildSeed: buildTrackerSeed });

export const loadTrackerDb = store.load;
export const saveTrackerDb = store.save;
export const resetTrackerDb = store.reset;
/** Run `fn(db)` against a copy and commit only if it returns (see createDemoStore). */
export const mutateTrackerDb = store.mutate;

/** Next number in a demo series: `JPB/26-27/1004`. */
export const nextDocNo = (db, prefix) => {
  db.counters[prefix] = (db.counters[prefix] || 1000) + 1;
  const d = dayjs();
  const y = d.month() >= 3 ? d.year() : d.year() - 1;
  return `${prefix}/${String(y).slice(2)}-${String(y + 1).slice(2)}/${db.counters[prefix]}`;
};

export const nextId = (db, key) => {
  db.seq[key] = (db.seq[key] || 0) + 1;
  return db.seq[key];
};

/** A refusal the screens read the way they will read the API's: `message`, plus `code` and `details`. */
export const mockError = (message, { code = 'VALIDATION_FAILED', details = [], status = 400 } = {}) => {
  const e = new Error(message);
  e.code = code;
  e.details = details;
  e.status = status;
  return e;
};

/** Network-like latency so loading states show during review. */
export const latency = (value, ms = 180) => new Promise((resolve) => { setTimeout(() => resolve(value), ms); });

export const clone = (value) => JSON.parse(JSON.stringify(value));

export const todayIso = () => iso(dayjs());
