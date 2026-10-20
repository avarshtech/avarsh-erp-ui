import { lazy } from 'react';

/**
 * Recovery from screen code that a newer deploy removed.
 *
 * Every build gives each screen's code file a new hashed name, and a deploy removes the old files.
 * A tab opened before the deploy still asks for the old names, so the next screen it opens fails to
 * load and lands in the error boundary. Vite reports that failure as a `vite:preloadError` window
 * event; reloading the page fetches the new index.html, and with it the new names.
 *
 * The page reloads itself ONCE. A sessionStorage key, written just before the reload, holds the path
 * that failed and stops a second automatic reload: if the screen still cannot load afterwards (the
 * file really is missing, or the connection is down), the error boundary shows it with a Reload
 * button instead of the page reloading forever.
 *
 * The key is cleared after a successful load: when the reloaded page opens the code of a screen on a
 * different path. That proves the new build works and re-arms the reload for the next deploy.
 * Clearing it when the page loads would loop: the reloaded page loads, clears the key, asks for the
 * same missing file and reloads again. Clearing on time alone would loop too, whenever the screen
 * is slower to ask for its file than the timer. A different path needs the user to move on, or a
 * redirect; every redirect in App.jsx lands on a route that does not redirect again, so a redirect
 * can cost one extra reload, never a loop.
 *
 * The handler does not call `event.preventDefault()`. Vite would then resolve the import to
 * `undefined`, and React.lazy would fail with a TypeError the error boundary cannot recognise.
 * Letting the error through costs, at most, a glimpse of the boundary's reload notice while the page
 * unloads.
 */

const GUARD_KEY = 'erp:chunk-reload';

// Chrome, Firefox and Safari word a failed dynamic import differently; Vite adds its own message
// for a stylesheet it could not preload, and webpack-style loaders throw a ChunkLoadError.
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i;

/** True when `error` says a code file of the app could not be loaded. */
export const isChunkLoadError = (error) => {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const text = typeof error === 'string' ? error : error.message;
  return typeof text === 'string' && CHUNK_ERROR_PATTERN.test(text);
};

/** The path the tab reloaded itself for, or null. Unreadable storage counts as no guard. */
const readGuard = () => {
  try {
    return window.sessionStorage.getItem(GUARD_KEY);
  } catch {
    return null;
  }
};

/** Writes the guard and reads it back. False means no guard can be kept, so no reload either. */
const armGuard = (path) => {
  try {
    window.sessionStorage.setItem(GUARD_KEY, path);
    return window.sessionStorage.getItem(GUARD_KEY) === path;
  } catch {
    return false;
  }
};

const clearGuard = () => {
  try {
    window.sessionStorage.removeItem(GUARD_KEY);
  } catch {
    // Storage is unavailable, so there is no guard to clear.
  }
};

const reloadOnce = () => {
  if (readGuard() !== null) return;
  if (!armGuard(window.location.pathname)) return;
  window.location.reload();
};

const noteScreenLoaded = () => {
  const reloadedFor = readGuard();
  if (reloadedFor !== null && reloadedFor !== window.location.pathname) clearGuard();
};

/**
 * React.lazy for a routed screen. It returns the same module React.lazy would; it also tells the
 * reload guard that a screen's code loaded.
 */
export const lazyRoute = (factory) =>
  lazy(() =>
    factory().then((module) => {
      noteScreenLoaded();
      return module;
    }),
  );

let installed = false;

/** Starts listening for Vite's preload errors. Safe to call more than once. */
export const installChunkReload = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('vite:preloadError', reloadOnce);
};
