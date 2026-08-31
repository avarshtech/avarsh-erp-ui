/**
 * localStorage persistence engine for the Bill Passing mock layer.
 *
 * Key: avarsh.billPassing.mockStore.v1 — write-through after every mutation, so
 * demo data survives reloads. Bumping SEED_VERSION discards the stored copy and
 * reseeds — the documented demo-reset path (user-entered demo data is lost on
 * bump). Multi-tab is last-write-wins; acceptable for a mock phase.
 *
 * Mirrors src/services/sr/srMockStore.js, with one deliberate difference: the
 * SR store writes to `memoryDb` when localStorage throws but never reads it
 * back, so in a private window every call silently reseeds and all edits are
 * lost. `loadDb` here checks `memoryDb` first.
 */
import { buildSeedDb, SEED_VERSION } from './billPassingMockData';
import { nextDocNo, BP_DOC_PREFIX } from './billPassingDocNumbers';

const STORAGE_KEY = 'avarsh.billPassing.mockStore.v1';

let memoryDb = null; // fallback when localStorage is unavailable

export const loadDb = () => {
  if (memoryDb && memoryDb.seedVersion === SEED_VERSION) return memoryDb;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db.seedVersion === SEED_VERSION) return db;
    }
  } catch { /* fall through to reseed */ }
  const fresh = buildSeedDb();
  saveDb(fresh);
  return fresh;
};

export const saveDb = (db) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    memoryDb = null; // localStorage is authoritative again
  } catch {
    memoryDb = db;
  }
};

export const resetBillPassingMockStore = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  memoryDb = null;
};

// ── Numbering ──────────────────────────────────────────────────────────────
// Bills follow the ERP standard <PREFIX>/<FY>/<NNNN> handed out by the backend
// DocumentNumberService — see billPassingDocNumbers.js.

/** Bill Passing number, e.g. BP/26-27/1001. */
export const nextBillNo = (db) => nextDocNo(db, BP_DOC_PREFIX.BILL);

export const isMemoryOnly = () => memoryDb != null;
