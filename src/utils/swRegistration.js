import { registerSW } from 'virtual:pwa-register';

let updateSW = null;

/**
 * Register service worker and set up update callback.
 * @param {Function} onNeedRefresh - Called when a new SW version is available
 * @param {Function} onOfflineReady - Called when the app is cached for offline use
 */
export const registerServiceWorker = (onNeedRefresh, onOfflineReady) => {
  updateSW = registerSW({
    onNeedRefresh() {
      onNeedRefresh?.();
    },
    onOfflineReady() {
      onOfflineReady?.();
    },
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 30 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });
};

/**
 * Apply the waiting SW update (triggers page reload)
 */
export const applyUpdate = () => {
  updateSW?.(true);
};
