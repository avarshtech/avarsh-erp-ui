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
// SR numbers follow the PRD format SRQ-YYYY-NNNN (per calendar year).
// NOTE: deviates from the backend DocumentNumberService convention
// (<PFX>/<FY>/<NNNN>) — reconcile at API phase.
export const nextSrNo = (db) => {
  const year = new Date().getFullYear();
  db.srSeq = db.srSeq || {};
  db.srSeq[year] = (db.srSeq[year] || 100) + 1;
  return `SRQ-${year}-${String(db.srSeq[year]).padStart(4, '0')}`;
};

// Indian fiscal year label, e.g. 2026-08 → "26-27"
export const fiscalYearLabel = (d = new Date()) => {
  const y = d.getFullYear() % 100;
  const startsThisYear = d.getMonth() + 1 >= 4; // Apr–Mar
  const from = startsThisYear ? y : y - 1;
  return `${String(from).padStart(2, '0')}-${String(from + 1).padStart(2, '0')}`;
};

// Invoice numbers are assigned ON ISSUE ONLY (PRD §10.8) so the series never
// gains gaps from abandoned drafts. e.g. EXSG0034/26-27
export const nextInvoiceNo = (db, series = 'EXSG') => {
  const fy = fiscalYearLabel();
  const key = `${series}/${fy}`;
  db.invSeq = db.invSeq || {};
  db.invSeq[key] = (db.invSeq[key] || 30) + 1;
  return `${series}${String(db.invSeq[key]).padStart(4, '0')}/${fy}`;
};

// Mock sample-PO numbers — clearly distinct from real supplier POs (PO/FY/NNNN);
// the real integration creates actual PO-module records flagged po_type=SAMPLE.
export const nextSamplePoNo = (db) => {
  db.poSeq = (db.poSeq || 1000) + 1;
  return `SPO/${fiscalYearLabel()}/${db.poSeq}`;
};

// Dispatch numbers — one dispatch groups many SRs to one customer (R2)
export const nextDispatchNo = (db) => {
  const year = new Date().getFullYear();
  db.dspSeq = db.dspSeq || {};
  db.dspSeq[year] = (db.dspSeq[year] || 0) + 1;
  return `DSP-${year}-${String(db.dspSeq[year]).padStart(4, '0')}`;
};

// Sample-issue numbers — material issued against an SR (Submitted → In Production)
export const nextSampleIssueNo = (db) => {
  const year = new Date().getFullYear();
  db.sriSeq = db.sriSeq || {};
  db.sriSeq[year] = (db.sriSeq[year] || 0) + 1;
  return `SRI-${year}-${String(db.sriSeq[year]).padStart(4, '0')}`;
};

export const isMemoryOnly = () => memoryDb != null;
