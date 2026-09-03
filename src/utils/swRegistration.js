// The service worker is registered directly rather than through
// `virtual:pwa-register`. That helper arms its own
// `controlling -> window.location.reload()` listener the instant it reports an
// update, and skipWaiting() claims every client of the registration — so
// applying an update in ANY tab would reload all the others mid-session, which
// is the exact interruption this module exists to prevent. The URL, scope and
// type below are the ones the helper itself used.
const SW_URL = '/sw.js';
const SW_SCOPE = '/';
const SW_TYPE = 'classic';

// How often a long-lived tab re-checks the server for a new build.
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
// Cap on an on-demand check, so logout can never hang on a dead network.
const UPDATE_CHECK_TIMEOUT_MS = 4000;
// Cap on waiting for the new worker to take over before falling back.
const ACTIVATION_TIMEOUT_MS = 8000;
// Cap on the unregister escape hatch itself.
const UNREGISTER_TIMEOUT_MS = 1500;
// How long to wait for a navigation to actually take the page away.
const NAVIGATION_GRACE_MS = 3500;

/** Fired when an update was started but the navigation never happened. */
export const UPDATE_CANCELLED_EVENT = 'pwa-update-cancelled';

let swRegistration = null;
let updateReady = false;
let registered = false;
let reloading = false;

const listeners = new Set();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const notify = () => {
  listeners.forEach((fn) => fn(updateReady));
};

const markUpdateReady = () => {
  if (updateReady) return;
  updateReady = true;
  notify();
};

/**
 * A waiting worker only means "a new build is ready" when this page is already
 * controlled by an older one. On a first-ever install there is no controller
 * and nothing to update to.
 */
const hasWaitingUpdate = () =>
  !!swRegistration?.waiting && !!navigator.serviceWorker?.controller;

/** Resolve once `worker` is no longer installing, or after `timeoutMs`. */
const settleWorker = (worker, timeoutMs) =>
  new Promise((resolve) => {
    if (!worker || worker.state !== 'installing') return resolve();
    const finish = () => {
      worker.removeEventListener('statechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (worker.state !== 'installing') finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    worker.addEventListener('statechange', onChange);
  });

/**
 * Subscribe to update-availability changes. The callback fires immediately with
 * the current state, then again whenever it changes.
 * @param {(ready: boolean) => void} fn
 * @returns {() => void} unsubscribe
 */
export const subscribeToUpdates = (fn) => {
  listeners.add(fn);
  fn(updateReady);
  return () => listeners.delete(fn);
};

/** @returns {boolean} True if a new build is installed and waiting to activate. */
export const isUpdateReady = () => updateReady;

/**
 * Ask the server whether a new build exists, right now.
 * Safe to call when offline or before registration — resolves false.
 * @returns {Promise<boolean>} True if a new build is installed and waiting.
 */
export const checkForUpdate = async () => {
  if (!swRegistration) return updateReady;

  try {
    await Promise.race([swRegistration.update(), delay(UPDATE_CHECK_TIMEOUT_MS)]);
    // update() can resolve while the newly found worker is still precaching,
    // and a build is only usable once it reaches `waiting`.
    await settleWorker(swRegistration.installing, UPDATE_CHECK_TIMEOUT_MS);
  } catch {
    // Offline or the SW script is unreachable — keep whatever state we had.
  }

  if (hasWaitingUpdate()) markUpdateReady();
  return updateReady;
};

/**
 * Activate the waiting service worker and load the new build.
 *
 * Without this the waiting worker never activates and the old precached
 * index.html keeps being served — a plain reload does NOT release a
 * controlling service worker.
 *
 * If the navigation is refused — an unsaved-changes `beforeunload` guard where
 * the user chooses to stay — everything is released and UPDATE_CANCELLED_EVENT
 * is dispatched so the UI can recover. Without that the user would be stranded
 * behind the update overlay with no way out.
 *
 * @param {string} [destination] - URL to land on. Omit to reload in place.
 */
export const applyUpdate = (destination) => {
  if (reloading) return;
  reloading = true;

  let settled = false;
  let graceTimer = null;
  let fallbackTimer = null;

  const release = () => {
    clearTimeout(graceTimer);
    clearTimeout(fallbackTimer);
    navigator.serviceWorker?.removeEventListener('controllerchange', go);
    reloading = false;
    window.dispatchEvent(new Event(UPDATE_CANCELLED_EVENT));
  };

  function go() {
    if (settled) return;
    settled = true;
    clearTimeout(fallbackTimer);

    if (destination) window.location.replace(destination);
    else window.location.reload();

    // Still here? The navigation was blocked — give the app back to the user.
    graceTimer = setTimeout(release, NAVIGATION_GRACE_MS);
  }

  // Nothing waiting — just go where we were asked to go.
  if (!hasWaitingUpdate()) {
    go();
    return;
  }

  // The new worker takes control, then we load into it.
  navigator.serviceWorker.addEventListener('controllerchange', go, { once: true });
  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });

  // If the handover never happens, the old worker is still serving the old app
  // shell, so reloading alone would silently strand the user on the old build.
  // Dropping the registration forces the next load to come from the network;
  // the app re-registers on that load, so offline support returns with it.
  fallbackTimer = setTimeout(async () => {
    if (settled) return;
    try {
      await Promise.race([swRegistration.unregister(), delay(UNREGISTER_TIMEOUT_MS)]);
    } catch {
      // Nothing left to try — load anyway.
    }
    go();
  }, ACTIVATION_TIMEOUT_MS);
};

/** Watch a registration for newly installed builds. */
const watchRegistration = (registration, onOfflineReady) => {
  // A build installed during an earlier visit may already be waiting.
  if (hasWaitingUpdate()) markUpdateReady();

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
      if (installing.state !== 'installed') return;
      // An existing controller means this replaces a running build; otherwise
      // it is the first install and the app has just become offline-capable.
      if (navigator.serviceWorker.controller) markUpdateReady();
      else onOfflineReady?.();
    });
  });

  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

  // Catch up as soon as the user returns to the tab or regains network,
  // so the check isn't stuck behind the interval.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
};

/**
 * Register the service worker and start watching for new builds.
 * Idempotent — repeat calls (StrictMode double-invoke) are ignored.
 * @param {Function} [onOfflineReady] - Called once the app is cached for offline use.
 */
export const registerServiceWorker = (onOfflineReady) => {
  if (registered) return;
  if (!('serviceWorker' in navigator)) return;
  registered = true;

  const start = () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE, type: SW_TYPE })
      .then((registration) => {
        // Assigned before anything can report an update, so applyUpdate() is
        // never reachable with a null registration.
        swRegistration = registration;
        watchRegistration(registration, onOfflineReady);
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  };

  // Registering during startup competes with the app's own first paint.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
};
