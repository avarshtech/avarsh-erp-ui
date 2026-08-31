/**
 * localStorage persistence engine for the Sample Request mock layer.
 *
 * Key: avarsh.sr.mockStore.v1 — write-through after every mutation, so demo
 * data survives reloads (deliberate extension over the in-memory TNA mock).
 * Bumping SEED_VERSION discards the stored copy and reseeds — the documented
 * demo-reset path (user-entered demo data is lost on bump).
 * Multi-tab is last-write-wins; acceptable for a mock phase.
 */
import { buildSeedDb, SEED_VERSION } from './srMockData';
import { nextDocNo, SR_DOC_PREFIX } from './srDocNumbers';

const STORAGE_KEY = 'avarsh.sr.mockStore.v1';

let memoryDb = null; // fallback when localStorage is unavailable

export const loadDb = () => {
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
  } catch {
    memoryDb = db;
  }
};

export const resetSrMockStore = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  memoryDb = null;
};

// ── Numbering ──────────────────────────────────────────────────────────────
// Every sampling document follows the ERP standard <PREFIX>/<FY>/<NNNN> handed
// out by the backend DocumentNumberService — see srDocNumbers.js.

/** Sample Request, e.g. SRQ/26-27/1001 */
export const nextSrNo = (db) => nextDocNo(db, SR_DOC_PREFIX.REQUEST);

/**
 * Invoice numbers are assigned ON ISSUE ONLY (PRD §10.8) so the series never
 * gains gaps from abandoned drafts. The prefix is the buyer-facing invoice
 * series, e.g. EXSG/26-27/1001 (commercial) or SA/26-27/1001 (sample charge).
 */
export const nextInvoiceNo = (db, series = 'EXSG') => nextDocNo(db, series);

// Mock sample-PO numbers — clearly distinct from real supplier POs (PO/FY/NNNN);
// the real integration creates actual PO-module records flagged po_type=SAMPLE.
export const nextSamplePoNo = (db) => nextDocNo(db, SR_DOC_PREFIX.SAMPLE_PO);

/** Dispatch — one dispatch groups many SRs to one customer (R2) */
export const nextDispatchNo = (db) => nextDocNo(db, SR_DOC_PREFIX.DISPATCH);

/** Sample issue — material issued against an SR (Submitted → In Production) */
export const nextSampleIssueNo = (db) => nextDocNo(db, SR_DOC_PREFIX.ISSUE);

export const isMemoryOnly = () => memoryDb != null;
