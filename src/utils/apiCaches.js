/**
 * Browser-side data that outlives a session on a shared PC, and how to drop it.
 *
 * The service worker (src/sw.js) keeps runtime caches of API responses. Their entries hold the data
 * of whoever was signed in, for whichever working branch was selected — the cache key is the URL
 * alone — so they are dropped on logout, on session expiry and when the working branch changes; a
 * newly activated worker drops them too, for installs that never log out.
 *
 * The Preview modules keep their data in localStorage (avarsh.<module>.mockStore.vN); it is the
 * signed-in user's work, so it goes on logout and session expiry as well.
 */

/** Runtime cache names used, or formerly used, by src/sw.js for API responses. */
export const API_CACHE_NAMES = ['erp-api-data', 'erp-master-data'];

/** Delete the service worker's API caches. `caches` is absent outside secure contexts (plain-http LAN hosts). */
export const clearApiCaches = () => {
  if (!globalThis.caches) return Promise.resolve();
  return Promise.all(API_CACHE_NAMES.map((name) => globalThis.caches.delete(name))).catch(() => {});
};

const PREVIEW_STORE_KEY = /^avarsh\..+\.mockStore\.v\d+$/;

/** Remove the Preview modules' browser-only stores. */
export const clearPreviewStores = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => PREVIEW_STORE_KEY.test(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable — nothing was stored to remove
  }
};
