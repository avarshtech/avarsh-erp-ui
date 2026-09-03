/**
 * localStorage persistence engine for the PO–Order Mapping mock layer.
 *
 * Key: avarsh.poOrderMapping.mockStore.v1 — write-through after every mutation so
 * demo data survives reloads. Bumping SEED_VERSION discards the stored copy and
 * reseeds (the documented demo-reset path). Modelled on expDocMockStore.js:
 * `memoryDb` is read back when localStorage is unavailable, so a private window
 * keeps its edits for the life of the tab instead of silently reseeding.
 */
import { buildSeedDb, SEED_VERSION } from './poOrderMappingMockData';

const STORAGE_KEY = 'avarsh.poOrderMapping.mockStore.v1';

let memoryDb = null;

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
    memoryDb = null;
  } catch {
    memoryDb = db;
  }
};

export const resetPoOrderMappingMockStore = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  memoryDb = null;
};

export const nextId = (db) => {
  db.nextId += 1;
  return db.nextId;
};
