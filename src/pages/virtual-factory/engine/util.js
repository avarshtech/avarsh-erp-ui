/**
 * Small, dependency-free helpers shared by the Virtual Factory engine. The engine never touches the
 * DOM or React, so these modules also run under plain Node for the scratchpad checks.
 */

export const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

export const sum = (list, pick = (x) => x) => (list || []).reduce((total, item) => total + num(pick(item)), 0);

/** part / whole as a percentage, or null when there is nothing to divide by. */
export const pct = (part, whole) => (num(whole) > 0 ? (num(part) / num(whole)) * 100 : null);

export const round = (value, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(num(value) * f) / f;
};

export const unique = (list) => [...new Set((list || []).filter((x) => x != null && x !== ''))];

export const groupBy = (list, keyOf) => {
  const map = new Map();
  (list || []).forEach((item) => {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

export const text = (value) => (value == null ? '' : String(value).trim());

/** The first non-empty value. */
export const first = (...values) => values.find((v) => v != null && v !== '');

// ─── Days ('YYYY-MM-DD', local calendar) ─────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

export const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 'YYYY-MM-DD' (or an ISO date-time) → 'YYYY-MM-DD'; anything else → null. */
export const dayOf = (value) => {
  const s = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const utc = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from `a` to `b` (positive when b is later); null when either is missing. */
export const dayDiff = (a, b) => {
  const da = dayOf(a);
  const db = dayOf(b);
  return da && db ? Math.round((utc(db) - utc(da)) / 86400000) : null;
};

export const addDays = (day, n) => {
  const d = new Date(utc(dayOf(day)) + Math.round(n) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Earliest of a list of days (strings), ignoring blanks. */
export const minDay = (days) => (days || []).map(dayOf).filter(Boolean).sort()[0] || null;

// ─── Deterministic variety ────────────────────────────────────────────────────

/** Stable 32-bit hash so a station or a worker looks the same on every refresh. */
export const hashString = (value) => {
  const s = text(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: a tiny seeded PRNG returning [0, 1). */
export const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

export const formatQty = (value) => Math.round(num(value)).toLocaleString('en-IN');
