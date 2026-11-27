/**
 * Ring buffers of the most recent frontend errors and failed API calls, attached to a bug report so the
 * developer sees what went wrong just before the user clicked "Report a problem".
 *
 * Pure state + helpers; installDiagnostics.js wires them to console, window and axios. What is kept is
 * deliberately small: for an API failure only the method, the path with ids replaced, status, timing
 * and trace id — never headers, request bodies or response bodies.
 */
import { redactText } from './redaction';

export const MAX_CONSOLE_ENTRIES = 20;
export const MAX_API_FAILURES = 30;
const MAX_MESSAGE = 1000;
const MAX_STACK = 2000;

const state = { consoleErrors: [], apiFailures: [] };

export function pushBounded(list, entry, max) {
  list.push(entry);
  if (list.length > max) list.splice(0, list.length - max);
  return list;
}

const truncate = (text, max) => (text && text.length > max ? `${text.slice(0, max)}…` : text);

/** console.error arguments → one message (and the first Error's stack). */
export function formatConsoleArgs(args) {
  let stack;
  const parts = args.map((arg) => {
    if (arg instanceof Error) {
      stack = stack || arg.stack;
      return `${arg.name}: ${arg.message}`;
    }
    if (typeof arg === 'string') return arg;
    if (arg === undefined) return 'undefined';
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  });
  return {
    message: truncate(redactText(parts.join(' ')), MAX_MESSAGE),
    stack: stack ? truncate(redactText(stack), MAX_STACK) : undefined,
  };
}

export function recordConsoleError(level, args, now = new Date()) {
  const { message, stack } = formatConsoleArgs(args);
  if (!message) return;
  const last = state.consoleErrors[state.consoleErrors.length - 1];
  if (last && last.message === message && last.level === level) {
    last.count = (last.count || 1) + 1;
    last.timestamp = now.toISOString();
    return;
  }
  pushBounded(state.consoleErrors, { level, message, stack, timestamp: now.toISOString() }, MAX_CONSOLE_ENTRIES);
}

const ID_SEGMENT = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=.*\d)[A-Za-z0-9_-]{16,})$/i;

/**
 * '/purchase-orders/42?x=1' (+ baseURL 'http://host/api/v1') → '/api/v1/purchase-orders/:id'.
 * Ids, UUIDs and long opaque tokens become ':id', so no record identifiers or secrets are kept.
 */
export function toPathTemplate(url, baseURL = '') {
  if (!url) return '';
  let full = url;
  if (!/^https?:\/\//i.test(url)) {
    const base = (baseURL || '').replace(/\/+$/, '');
    full = `${base}/${url.replace(/^\/+/, '')}`;
  }
  let path = full;
  try {
    path = new URL(full, 'http://placeholder').pathname;
  } catch {
    path = full.split(/[?#]/)[0];
  }
  return path
    .split('/')
    .map((segment) => (ID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
}

export function recordApiFailure({ method, url, baseURL, status, statusText, durationMs, traceId, errorCode }, now = new Date()) {
  pushBounded(state.apiFailures, {
    method: (method || 'get').toUpperCase(),
    path: toPathTemplate(url, baseURL),
    status: status ?? 0,
    statusText: statusText || (status ? undefined : 'Network error'),
    durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : undefined,
    traceId: typeof traceId === 'string' ? traceId.slice(0, 64) : undefined,
    errorCode: typeof errorCode === 'string' ? errorCode.slice(0, 64) : undefined,
    timestamp: now.toISOString(),
  }, MAX_API_FAILURES);
}

/** A copy of what is buffered now, without undefined fields. */
export function getDiagnostics() {
  const clean = (entry) => Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
  return {
    consoleErrors: state.consoleErrors.map(clean),
    apiFailures: state.apiFailures.map(clean),
  };
}

export function resetDiagnostics() {
  state.consoleErrors.length = 0;
  state.apiFailures.length = 0;
}
