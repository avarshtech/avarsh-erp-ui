/**
 * Browser home of the job-work bill demo (Stage 1 mock — the screens are reviewed before the API is built).
 * One localStorage key holds the whole demo so a reload keeps the reviewer's work; "Reset demo data" or a seed
 * version bump re-seeds it relative to today. Never reaches the API.
 */
import dayjs from 'dayjs';
import { createDemoStore } from '../../production/jobwork/demoStore';
import { buildJwbSeed, JWB_SEED_VERSION } from './jwbDemoSeed';

export const JWB_STORAGE_KEY = 'avarsh.inventory.jobWorkBill.mockStore.v1';

const store = createDemoStore({ storageKey: JWB_STORAGE_KEY, seedVersion: JWB_SEED_VERSION, buildSeed: buildJwbSeed });

export const loadJwbDb = store.load;
export const resetJwbDb = store.reset;
/** Run `fn(db)` against a copy and commit only if it returns (see createDemoStore). */
export const mutateJwbDb = store.mutate;

/** Next number in a demo series: `JWB/26-27/1004`. */
export const nextDocNo = (db, prefix, date = dayjs()) => {
  db.counters[prefix] = (db.counters[prefix] || 1000) + 1;
  const d = dayjs(date);
  const y = d.month() >= 3 ? d.year() : d.year() - 1;
  return `${prefix}/${String(y).slice(2)}-${String(y + 1).slice(2)}/${db.counters[prefix]}`;
};

export const nextId = (db, key) => {
  db.seq[key] = (db.seq[key] || 0) + 1;
  return db.seq[key];
};

/**
 * A refusal in the shape axios gives the screens (`e.response.data.error/message`), so their real error handling
 * runs — e.g. a DUPLICATE_INVOICE opens the override prompt exactly as it will against the API.
 */
export const refuse = (message, { error = 'BUSINESS_RULE_VIOLATION', status = 409, details = [] } = {}) => {
  const e = new Error(message);
  e.response = { status, data: { error, message, details } };
  return e;
};

export const notFound = (what, id) => refuse(`${what} ${id} not found`, { error: 'NOT_FOUND', status: 404 });
