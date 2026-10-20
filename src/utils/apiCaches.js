/**
 * The service worker's API caches, and how to drop them.
 *
 * src/sw.js keeps runtime caches of API responses (network first, so they are what a user sees
 * offline). Their entries hold the data of whoever was signed in, for whichever working branch was
 * selected — the cache key is the URL alone — so they are dropped on logout, on session expiry and
 * when the working branch changes, and the next person on a shared PC starts empty.
 */

/** The runtime cache names src/sw.js uses for API responses; keep the two in step. */
export const API_CACHE_NAMES = ['erp-api-data', 'erp-master-data'];

/** Delete the service worker's API caches. `caches` is absent outside secure contexts (plain-http LAN hosts). */
export const clearApiCaches = () => {
  if (!globalThis.caches) return Promise.resolve();
  return Promise.all(API_CACHE_NAMES.map((name) => globalThis.caches.delete(name))).catch(() => {});
};
