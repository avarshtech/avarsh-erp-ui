/**
 * Browser home of the Job Work Tracker demo data (UI mock round 1). One localStorage key holds the
 * whole demo so a reload keeps the reviewer's changes; a seed version bump or "Reset demo data"
 * re-seeds it relative to today. Never reaches the API.
 */
import dayjs from 'dayjs';
import { buildTrackerSeed, TRACKER_SEED_VERSION } from './jobWorkTrackerSeed';
import { iso } from '../../../utils/jobWorkTracker/workingDays';

export const TRACKER_STORAGE_KEY = 'avarsh.production.jobWorkTracker.mockStore.v1';

let memory = null;

const persist = (db) => {
  memory = db;
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(db));
  } catch { /* storage full or blocked: keep it in memory for this tab */ }
};

export const loadTrackerDb = () => {
  if (memory?.seedVersion === TRACKER_SEED_VERSION) return memory;
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.seedVersion === TRACKER_SEED_VERSION) {
        memory = parsed;
        return memory;
      }
    }
  } catch { /* unreadable: fall through to a fresh seed */ }
  const fresh = buildTrackerSeed(iso(dayjs()));
  persist(fresh);
  return fresh;
};

export const saveTrackerDb = (db) => persist(db);

export const resetTrackerDb = () => {
  const fresh = buildTrackerSeed(iso(dayjs()));
  persist(fresh);
  return fresh;
};

/**
 * Run `fn(db)` against a copy of the demo and commit it only if `fn` returns, so a refused write
 * (fn throws) leaves nothing half-applied — the way a rolled-back transaction would.
 */
export const mutateTrackerDb = (fn) => {
  const db = JSON.parse(JSON.stringify(loadTrackerDb()));
  const result = fn(db);
  persist(db);
  return result;
};

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
