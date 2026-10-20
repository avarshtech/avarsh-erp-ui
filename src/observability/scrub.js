/**
 * What is sent to Sentry, cut down to what diagnosing an error needs:
 * - no request bodies, cookies or query strings (a query string carries search text and record ids);
 * - no Authorization, Cookie or token headers;
 * - the user as a numeric id only, never a name, username or email.
 *
 * Pure functions with no SDK import, so they are unit-tested on their own (scrub.test.js).
 */

/** The URL without its query string or fragment. Anything that is not a string comes back as is. */
export const stripQuery = (url) => (typeof url === 'string' ? url.split(/[?#]/)[0] : url);

const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-[a-z0-9-]*(token|auth|session|key)[a-z0-9-]*)$/i;

/** event.request without its body, cookies, query string or secret headers. */
export const scrubRequest = (request) => {
  if (!request || typeof request !== 'object') return request;
  const { data, cookies, query_string, ...kept } = request;
  if (kept.url) kept.url = stripQuery(kept.url);
  if (kept.headers && typeof kept.headers === 'object') {
    kept.headers = Object.fromEntries(
      Object.entries(kept.headers)
        .filter(([name]) => !SECRET_HEADER.test(name))
        .map(([name, value]) => [name, /^referer$/i.test(name) ? stripQuery(value) : value]),
    );
  }
  return kept;
};

const BREADCRUMB_URL_KEYS = ['url', 'from', 'to'];

/** A breadcrumb with the query strings cut off the URLs it records (fetch, xhr, navigation). */
export const scrubBreadcrumb = (crumb) => {
  if (!crumb?.data || typeof crumb.data !== 'object') return crumb;
  const data = { ...crumb.data };
  BREADCRUMB_URL_KEYS.forEach((key) => {
    if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
  });
  return { ...crumb, data };
};

/**
 * The user as Sentry sees them: { id } for a positive whole-number id, otherwise nobody. The cached
 * session falls back to the username when a token carries no userId, and a username must not go.
 */
export const userById = (id) => {
  const n = typeof id === 'number' || typeof id === 'string' ? Number(id) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? { id: String(n) } : undefined;
};

/** An error or transaction event, scrubbed, with the user set to `userId` alone (or removed). */
export const scrubEvent = (event, userId) => {
  if (!event || typeof event !== 'object') return event;
  const out = { ...event };
  if (out.request) out.request = scrubRequest(out.request);
  if (Array.isArray(out.breadcrumbs)) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  const user = userById(userId);
  if (user) out.user = user;
  else delete out.user;
  return out;
};

const SPAN_URL_KEYS = ['url', 'http.url', 'url.full'];
const SPAN_QUERY_KEYS = ['http.query', 'http.fragment', 'url.query', 'url.fragment'];

/** A tracing span with the query string cut out of a request's description and attributes. */
export const scrubSpan = (span) => {
  if (!span || typeof span !== 'object') return span;
  const out = { ...span };
  // "GET https://api.../orders?search=..." on request spans; other spans' descriptions are not URLs
  if (typeof out.description === 'string' && /^(http|resource)/.test(out.op || '')) {
    out.description = stripQuery(out.description);
  }
  if (out.data && typeof out.data === 'object') {
    const data = { ...out.data };
    SPAN_QUERY_KEYS.forEach((key) => { delete data[key]; });
    SPAN_URL_KEYS.forEach((key) => {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
    });
    out.data = data;
  }
  return out;
};
