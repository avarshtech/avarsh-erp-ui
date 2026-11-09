/**
 * The Export Documentation document store: packing lists, invoices, sticker runs, the audit
 * trail and the masters, kept by the API (/export-docs/documents, expDocDocumentApi) and held
 * here in memory for the modules that hold the documents' rules (expDocMock*.js).
 *
 * Those modules read and write one `db` object synchronously — `loadDb()`, change it,
 * `saveDb(db)` — and stay as they were. What changed is where `db` lives:
 *
 * - `syncDocuments()` loads every document the user may read, fresh within 30 s; a forced
 *   sync always reloads. Each record keeps a snapshot of its body and server version.
 * - `saveDb(db)` keeps the new state in memory. `flushDocuments()` diffs every record
 *   against its snapshot (new, changed, gone) and sends the changes as ONE batch, which the
 *   API saves whole or not at all; the saved bodies and versions are adopted. On any refusal
 *   the store reloads, so nothing half-done stays on screen, and the error is rethrown
 *   (a stale version opens the global ConflictDialog through axiosInstance).
 * - Writes go through `runWrite` (expDocService): one at a time, a forced sync first, the flush
 *   after. A record's `version` is the server's after every load and flush; the mock modules'
 *   own version checks keep working against it.
 * - Numbers (`docSeq`) are worked out from the numbers of the documents loaded, so the next
 *   number follows the last one anybody issued; two users racing for it collide on the API's
 *   unique number and the loser reloads.
 * - New records take a time-ordered random id (`newDocId`), unique across users; it is the
 *   document's key on the API.
 *
 * Shipments and Carton Packing entries are the API's own records: `db.shipments` and
 * `db.packingEntries` are the in-memory mirrors (expDocShipmentMirror, expDocPackingMirror),
 * laid over every load and never saved. The template preview's sample cartons are a local
 * constant. The notifications stay in this browser (they carry a reader's read/dismissed
 * state); nothing else is kept in localStorage.
 */
import { buildSampleEntries, buildSeedMasters } from './expDocMockData';
import { nextDocNo, EXPDOC_PREFIX } from './expDocDocNumbers';
import { mirroredShipments } from './expDocShipmentMirror';
import { mirroredPackingEntries } from './expDocPackingMirror';
import { listDocuments, saveDocuments, DOCUMENT_KIND } from './expDocDocumentApi';
import { EXPDOC_MODULE } from '../../utils/expDocConstants';
import { hasPermission } from '../../utils/permissions';

/** db table -> document kind. */
const TABLES = {
  packingLists: DOCUMENT_KIND.PACKING_LIST,
  invoices: DOCUMENT_KIND.INVOICE,
  stickerRuns: DOCUMENT_KIND.STICKER_RUN,
  audit: DOCUMENT_KIND.AUDIT,
};
/** The kinds whose body carries its own `version`, which must read as the server's. */
const VERSIONED = new Set([DOCUMENT_KIND.PACKING_LIST, DOCUMENT_KIND.INVOICE]);
const SETTINGS_KEY = 'settings';
const TTL_MS = 30 * 1000;
const NOTIFICATIONS_KEY = 'avarsh.expdoc.notifications.v1';
/** The screens whose users read documents; anyone else never asks. */
const READ_KEYS = [EXPDOC_MODULE.PACKING_LIST, EXPDOC_MODULE.INVOICE, EXPDOC_MODULE.STICKERS];

const clone = (v) => JSON.parse(JSON.stringify(v));

const emptyDocs = () => ({ packingLists: [], invoices: [], stickerRuns: [], audit: [], masters: buildSeedMasters() });

let docs = emptyDocs();
let docSeq = {};
/** key -> { kind, json, version }: each record as the API last returned it. */
let snapshots = new Map();
let syncedAt = 0;
// Bumped by every clear, so a load that started before a logout cannot put its rows back
let epoch = 0;
let queue = Promise.resolve();
let local = null;
let sampleEntries = null;

// ── Ids and numbers ─────────────────────────────────────────────────────────

let lastId = 0;

/**
 * A new record's id: time-ordered (lists sort newest first by id, as before) and random in
 * its last three digits, so two users creating at the same millisecond still differ. Stays
 * a number below 2^53, which every `Number(id)` comparison in the modules relies on.
 */
export const newDocId = () => {
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  lastId = Math.max(id, lastId + 1);
  return lastId;
};

/** "PKL/26-27/1004" and "EXP/26-27/1002-R1" -> ["PKL/26-27", 1004]. */
const seriesOf = (no) => {
  const m = /^(.+\/\d{2}-\d{2})\/(\d+)(?:-R\d+)?$/.exec(String(no ?? '').trim());
  return m ? [m[1], Number(m[2])] : null;
};

/**
 * The last number used per (prefix, FY), from every number the documents carry — the audit
 * trail too, so a deleted draft's number is not issued again.
 */
const deriveDocSeq = () => {
  const seq = {};
  const note = (no) => {
    const s = seriesOf(no);
    if (s && s[1] > (seq[s[0]] || 0)) seq[s[0]] = s[1];
  };
  docs.packingLists.forEach((p) => note(p.plNo));
  docs.invoices.forEach((i) => note(i.invoiceNo));
  docs.stickerRuns.forEach((r) => note(r.runNo));
  docs.audit.forEach((a) => note(a.entityNo));
  return seq;
};

// ── Snapshots ───────────────────────────────────────────────────────────────

/** A record as the API returned it, its `version` the server's. */
const bodyOf = (doc) => (VERSIONED.has(doc.kind) ? { ...doc.body, version: doc.version } : doc.body);

const remember = (doc, body) => {
  snapshots.set(doc.key, { kind: doc.kind, json: JSON.stringify(body), version: doc.version });
};

const adopt = (list) => {
  const next = emptyDocs();
  const byKind = Object.fromEntries(Object.entries(TABLES).map(([table, kind]) => [kind, table]));
  snapshots = new Map();
  list.forEach((doc) => {
    if (doc.kind === DOCUMENT_KIND.SETTINGS) {
      // A key the saved masters lack (added since they were seeded) reads from the seed
      next.masters = { ...next.masters, ...clone(doc.body) };
      remember(doc, next.masters);
      return;
    }
    const body = bodyOf(doc);
    // A record is tracked by its id; one whose body does not carry its own key was not written by
    // these screens and is left alone, or every save would try to delete it
    if (String(body?.id) !== doc.key) return;
    remember(doc, body);
    if (byKind[doc.kind]) next[byKind[doc.kind]].push(clone(body));
  });
  docs = next;
  docSeq = deriveDocSeq();
};

/** Every change since the last load: new and changed records, and the ones gone. */
const pendingChanges = () => {
  const upserts = [];
  const present = new Set();
  Object.entries(TABLES).forEach(([table, kind]) => {
    docs[table].forEach((record) => {
      const key = String(record.id);
      present.add(key);
      const snap = snapshots.get(key);
      if (snap?.json === JSON.stringify(record)) return;
      upserts.push({ key, kind, version: snap ? snap.version : null, body: record });
    });
  });
  // The masters are saved once, when seeded (seedSettings); a change after that goes out like any other
  const settings = snapshots.get(SETTINGS_KEY);
  if (settings) {
    present.add(SETTINGS_KEY);
    if (settings.json !== JSON.stringify(docs.masters)) {
      upserts.push({ key: SETTINGS_KEY, kind: DOCUMENT_KIND.SETTINGS, version: settings.version, body: docs.masters });
    }
  }
  const deletes = [...snapshots.entries()]
    .filter(([key]) => !present.has(key))
    .map(([key, s]) => ({ key, version: s.version }));
  return { upserts, deletes };
};

// ── Load ────────────────────────────────────────────────────────────────────

const canRead = () => READ_KEYS.some((key) => hasPermission(key, 'view'));

/**
 * No masters on the API yet: the first user who may write them saves the seed, so every
 * user prints the same HS codes and buyer terms. Anyone else reads the seed from memory.
 */
const seedSettings = async () => {
  if (snapshots.has(SETTINGS_KEY) || !hasPermission(EXPDOC_MODULE.INVOICE, 'update')) return;
  try {
    const [saved] = await saveDocuments({
      upserts: [{ key: SETTINGS_KEY, kind: DOCUMENT_KIND.SETTINGS, version: null, body: docs.masters }],
    }, { silent: true });
    if (saved) remember(saved, docs.masters);
  } catch {
    // Someone else seeded them first, or the API refused: the next load reads theirs
  }
};

const load = async ({ silent }) => {
  const started = epoch;
  const list = await listDocuments(undefined, { silent });
  if (started !== epoch) return;
  adopt(list || []);
  syncedAt = Date.now();
  await seedSettings();
};

const RETRY_MS = 5 * 1000;
let failedAt = 0;

/** The load itself, unqueued: `runWrite` calls it while it holds the queue. */
const syncNow = async ({ force = false, silent = true } = {}) => {
  if (!canRead()) return;
  if (!force && (Date.now() - syncedAt < TTL_MS || Date.now() - failedAt < RETRY_MS)) return;
  try {
    await load({ silent });
    failedAt = 0;
  } catch (e) {
    failedAt = Date.now();
    throw e;
  }
};

/** One write at a time, and no load in the middle of one. */
const exclusive = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

/**
 * Makes the documents fresh (30 s) for a read. Never throws: when the API cannot be
 * reached the modules read the last good copy. Waits for a write in progress.
 */
export const syncDocuments = ({ force = false } = {}) =>
  exclusive(() => syncNow({ force, silent: true })).catch(() => {});

// ── Save ────────────────────────────────────────────────────────────────────

/** Puts the saved versions on whatever the call returned, so the screen's next save sends them. */
const stampVersions = (result, versions) => {
  const stamp = (o) => {
    if (o && typeof o === 'object' && o.id != null && 'version' in o && versions.has(String(o.id))) {
      o.version = versions.get(String(o.id));
    }
  };
  stamp(result);
  if (result && typeof result === 'object') Object.values(result).forEach(stamp);
  return result;
};

/** Sends every pending change as one batch; returns key -> saved version. */
const flushNow = async () => {
  const { upserts, deletes } = pendingChanges();
  const versions = new Map();
  if (!upserts.length && !deletes.length) return versions;
  const saved = await saveDocuments({ upserts, deletes });
  deletes.forEach(({ key }) => snapshots.delete(key));
  (saved || []).forEach((doc) => {
    versions.set(doc.key, doc.version);
    if (doc.kind === DOCUMENT_KIND.SETTINGS) {
      docs.masters = { ...docs.masters, ...clone(doc.body) };
      remember(doc, docs.masters);
      return;
    }
    const body = bodyOf(doc);
    remember(doc, body);
    const table = Object.keys(TABLES).find((t) => TABLES[t] === doc.kind);
    const rows = docs[table];
    const at = rows.findIndex((r) => String(r.id) === doc.key);
    if (at >= 0) rows[at] = clone(body);
  });
  docSeq = deriveDocSeq();
  return versions;
};

/**
 * Sends what the last write changed, for the rare write outside `runWrite`. A refusal (a stale
 * version, a number just taken) reloads the documents, then is rethrown for the screen.
 */
export const flushDocuments = () => exclusive(async () => {
  try {
    return await flushNow();
  } catch (e) {
    await syncNow({ force: true, silent: true }).catch(() => {});
    throw e;
  }
});

/**
 * One document action: the documents are reloaded first (forced, so the numbers and versions
 * are the latest), `fn` runs and saves into memory, and its changes go to the API as one batch.
 * If anything fails, the store reloads before the error reaches the screen.
 */
export const runWrite = (fn) => exclusive(async () => {
  await syncNow({ force: true, silent: false });
  try {
    const result = await fn();
    return stampVersions(result, await flushNow());
  } catch (e) {
    await syncNow({ force: true, silent: true }).catch(() => {});
    throw e;
  }
});

// ── The db the modules read ─────────────────────────────────────────────────

const loadLocal = () => {
  if (local) return local;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || 'null');
  } catch { /* none kept, or storage unavailable */ }
  local = { notifications: stored?.notifications || [], dismissedNotifications: stored?.dismissedNotifications || {} };
  return local;
};

const saveLocal = (db) => {
  local = {
    notifications: clone(db.notifications || []),
    dismissedNotifications: clone(db.dismissedNotifications || {}),
  };
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(local));
  } catch { /* kept in memory for this session */ }
};

/** A fresh copy of everything, so a module can change it freely until it calls saveDb. */
export const loadDb = () => {
  const { notifications, dismissedNotifications } = loadLocal();
  if (!sampleEntries) sampleEntries = buildSampleEntries();
  return {
    ...clone(docs),
    docSeq: { ...docSeq },
    notifications: clone(notifications),
    dismissedNotifications: clone(dismissedNotifications),
    sampleEntries: clone(sampleEntries),
    shipments: mirroredShipments(),
    packingEntries: mirroredPackingEntries(),
  };
};

/** Keeps `db` as the new state; `flushDocuments` / `runWrite` sends it to the API. */
export const saveDb = (db) => {
  docs = clone({
    packingLists: db.packingLists || [],
    invoices: db.invoices || [],
    stickerRuns: db.stickerRuns || [],
    audit: db.audit || [],
    masters: db.masters || docs.masters,
  });
  if (db.docSeq) docSeq = { ...db.docSeq };
  saveLocal(db);
};

/** Forgets every document: a new session starts empty and loads its own. */
export const clearDocuments = () => {
  epoch += 1;
  docs = emptyDocs();
  docSeq = {};
  snapshots = new Map();
  syncedAt = 0;
  failedAt = 0;
};

if (typeof window !== 'undefined') {
  window.addEventListener('authChange', clearDocuments);
}

// ── Numbering ──────────────────────────────────────────────────────────────
// Every series follows the ERP standard <PREFIX>/<FY>/<NNNN> handed out by the
// backend DocumentNumberService — see expDocDocNumbers.js. Shipments are numbered
// by the API itself. The caller runs inside `runWrite`, so the documents are fresh.

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
