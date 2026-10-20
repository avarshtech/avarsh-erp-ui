/**
 * Shared helpers for every Export Documentation mock module.
 *
 * Deliberately its own file rather than living inside the API module: in
 * services/sr the siblings import `delay`/`clone`/`fail` FROM srMockApi.js, which
 * makes the API module a dependency of its own peers and risks an import cycle as
 * the module grows. Everything common lives here instead.
 *
 * The mocks mirror the future REST contract exactly, so the cutover is mechanical:
 * Spring page envelope {content, totalElements, totalPages, size, number},
 * camelCase fields, YYYY-MM-DD dates, and a `version` integer for optimistic
 * locking (the mock throws the same 409 shape axiosInstance already routes to the
 * global ConflictDialog).
 */
import { getCurrentUser } from '../../utils/permissions';

export const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

/** Deep copy on every read so callers can never mutate the store in place. */
export const clone = (v) => JSON.parse(JSON.stringify(v));

/** Throw with a typed `.code` so screens can branch, mirroring backend error codes. */
export const fail = (code, msg) => {
  const e = new Error(msg);
  e.code = code;
  throw e;
};

/** Optimistic-lock rejection in the exact shape axiosInstance detects. */
export const failConflict = (entity, expected, actual) => {
  const e = new Error(
    `${entity} was changed by someone else (expected version ${expected}, found ${actual}). Reload and reapply your changes.`,
  );
  e.code = 'OPTIMISTIC_LOCK_CONFLICT';
  e.isOptimisticLockConflict = true;
  throw e;
};

export const currentUserName = () => {
  const u = getCurrentUser();
  if (!u) return 'User';
  if (typeof u === 'string') return u;
  return u.name || u.fullName || u.username || u.email || 'User';
};

const pad = (n) => String(n).padStart(2, '0');

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const nowStamp = () => {
  const d = new Date();
  return `${todayStr()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Spring Page envelope, so list screens need no reshaping at cutover. */
export const pageOf = (rows, params = {}) => {
  const size = Number(params.size ?? 10);
  const page = Number(params.page ?? 0);
  const start = page * size;
  return {
    content: rows.slice(start, start + size),
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
    size,
    number: page,
  };
};

let auditSeq = 0;

/**
 * Append an audit entry. PRD §20 wants user, timestamp, document + version and
 * field-level before/after for edits, so `before`/`after` are first-class rather
 * than squeezed into the details string.
 */
export const pushAudit = (db, entry) => {
  auditSeq += 1;
  db.audit = db.audit || [];
  db.audit.push({
    id: `${Date.now()}-${auditSeq}`,
    at: nowStamp(),
    user: currentUserName(),
    before: null,
    after: null,
    reason: null,
    details: null,
    ...entry,
  });
  return db.audit[db.audit.length - 1];
};

/** Case-insensitive "contains" used by every list filter. */
export const matchesText = (haystack, needle) => {
  if (!needle) return true;
  return String(haystack ?? '').toLowerCase().includes(String(needle).toLowerCase());
};

/**
 * Pantone-aware colour key, so "Classic Blue 19-4052" and "19-4052" reconcile.
 * Mirrors the normalisation OrderView already applies when grouping order colours;
 * V-09 and the order-vs-packed comparison both depend on it.
 */
export const colourKey = (name) => {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  const pantone = raw.match(/(\d{2}-\d{3,4})/);
  if (pantone) return pantone[1];
  const pms = raw.match(/PMS\s*(\d+)/i);
  if (pms) return `pms${pms[1]}`;
  return raw.toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Field-level before/after for an edit (PRD §20).
 *
 * Only the keys that actually changed, and for a scalar the two values — an audit
 * entry holding the whole record before and after is technically complete and
 * practically unreadable, and §20 asks for the fields.
 *
 * A nested value (an array of invoice lines, a charges object) is summarised rather
 * than dumped: `summarise` may return a short human phrase for a key, and otherwise
 * the entry just records that the block changed.
 */
export const fieldDiff = (before, after, keys, summarise = () => null) => {
  const changes = [];
  (keys || []).forEach((k) => {
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const scalar = (v) => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
    if (scalar(a) && scalar(b)) {
      changes.push({ field: k, from: a ?? null, to: b ?? null });
      return;
    }
    changes.push({ field: k, note: summarise(k, a, b) || 'changed' });
  });
  return changes;
};

/** "rate 8.75 → 9.10 on line 2" and friends, for the audit detail line. */
export const describeChanges = (changes) => (changes || [])
  .map((c) => (c.note ? `${c.field}: ${c.note}` : `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`))
  .join(' · ');
