/**
 * localStorage persistence engine for the Export Documentation mock layer.
 *
 * Key: avarsh.expdoc.mockStore.v1 — write-through after every mutation, so demo
 * data survives reloads. Bumping SEED_VERSION discards the stored copy and reseeds
 * — the documented demo-reset path (user-entered demo data is lost on bump), so
 * always read the current SEED_VERSION rather than trusting a remembered one.
 * Multi-tab is last-write-wins; acceptable for a mock phase.
 *
 * Deliberately unlike the old srMockStore.js, which wrote to `memoryDb` when
 * localStorage threw but never read it back, so in a private window every call
 * silently reseeded and all edits were lost. `loadDb` here checks `memoryDb`
 * first.
 *
 * Quota note: carton data is stored as RANGES, never as one row per carton, so a
 * shipment of any size costs a handful of rows. That is what keeps an unbounded
 * carton count inside the browser's ~5 MB budget.
 *
 * Shipments are the API's: `db.shipments` is the in-memory mirror
 * (expDocShipmentMirror), laid over every load and stripped from every save. So are
 * the Carton Packing entries: `db.packingEntries` is expDocPackingMirror.
 */
import { buildSeedDb, SEED_VERSION } from './expDocMockData';
import { nextDocNo, EXPDOC_PREFIX } from './expDocDocNumbers';
import { mirroredShipments } from './expDocShipmentMirror';
import { mirroredPackingEntries } from './expDocPackingMirror';

const STORAGE_KEY = 'avarsh.expdoc.mockStore.v1';

let memoryDb = null; // fallback when localStorage is unavailable or full

// The API's shipments and Carton Packing entries, laid over every load and never stored
const withShipments = (db) => ({ ...db, shipments: mirroredShipments(), packingEntries: mirroredPackingEntries() });

export const loadDb = () => {
  if (memoryDb && memoryDb.seedVersion === SEED_VERSION) return withShipments(memoryDb);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db.seedVersion === SEED_VERSION) return withShipments(db);
    }
  } catch { /* fall through to reseed */ }
  const fresh = buildSeedDb();
  saveDb(fresh);
  return withShipments(fresh);
};

export const saveDb = (db) => {
  // Never stored: the API holds the only shipment and Carton Packing records
  const { shipments: _apiShipments, packingEntries: _apiEntries, ...stored } = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    memoryDb = null; // localStorage is authoritative again
  } catch {
    memoryDb = stored;
  }
};

export const resetExpDocMockStore = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  memoryDb = null;
};

export const isMemoryOnly = () => memoryDb != null;

// ── Numbering ──────────────────────────────────────────────────────────────
// Every series follows the ERP standard <PREFIX>/<FY>/<NNNN> handed out by the
// backend DocumentNumberService — see expDocDocNumbers.js. Shipments are numbered
// by the API itself.

/**
 * Packing list, e.g. PKL/26-27/1001. Allocated at CREATE, unlike the invoice:
 * packing lists are referenced by production while still drafts, and a gap in an
 * internal series is harmless.
 */
export const nextPackingListNo = (db) => nextDocNo(db, EXPDOC_PREFIX.PACKING_LIST);

/**
 * Export invoice, e.g. EXP/26-27/1001. Assigned ON FINALISE ONLY so the
 * buyer-facing series never gains gaps from abandoned drafts (PRD BR-02); a
 * cancelled invoice keeps its number. `series` comes from the buyer template.
 */
export const nextInvoiceNo = (db, series = EXPDOC_PREFIX.INVOICE) => nextDocNo(db, series);

/** Sticker run, e.g. STK/26-27/1001. */
export const nextStickerRunNo = (db) => nextDocNo(db, EXPDOC_PREFIX.STICKER_RUN);
