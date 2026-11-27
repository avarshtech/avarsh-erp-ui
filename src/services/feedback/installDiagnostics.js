/**
 * Starts the diagnostics buffers once, at app boot (main.jsx), so errors that happen before the user opens
 * the feedback dialog are still there when they report the problem.
 */
import axiosInstance from '../core/axiosInstance';
import { recordApiFailure, recordConsoleError } from './diagnostics';

let installed = false;

export function installDiagnostics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Wrapped, not replaced: every call still reaches the real console.
  // eslint-disable-next-line no-console -- keeps the last errors for bug reports; does not log anything itself
  const originalError = console.error;
  // eslint-disable-next-line no-console -- see above
  console.error = (...args) => {
    try {
      recordConsoleError('error', args);
    } catch {
      // capturing must never break logging
    }
    originalError.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    recordConsoleError('error', [event.error || event.message]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordConsoleError('unhandledrejection', [event.reason]);
  });

  axiosInstance.interceptors.request.use((config) => {
    config.feedbackStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return config;
  });
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      try {
        const config = error?.config || {};
        if (!error?.isOfflineError && !config.feedbackIgnore) {
          const started = config.feedbackStartedAt;
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const data = error.response?.data;
          recordApiFailure({
            method: config.method,
            url: config.url,
            baseURL: config.baseURL,
            status: error.response?.status,
            statusText: error.response?.statusText,
            durationMs: started ? now - started : undefined,
            traceId: error.response?.headers?.['x-trace-id'],
            errorCode: data && typeof data === 'object' ? data.error : undefined,
          });
        }
      } catch {
        // never interfere with the app's own error handling
      }
      return Promise.reject(error);
    },
  );
}
