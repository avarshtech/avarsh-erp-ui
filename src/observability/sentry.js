/**
 * Production error reporting through Sentry, off unless the build has a DSN.
 *
 * Off (no VITE_SENTRY_DSN, or the e2e build): `sentryEnabled` is a build-time constant, so the
 * bundler drops everything below together with the SDK import. The app starts and behaves exactly
 * as it did before this file existed, and makes no request to Sentry.
 *
 * On: the SDK loads in a chunk of its own after the app has started, so it never delays the first
 * render, and React's root error handlers (main.jsx) report through it. Errors React reports
 * before the SDK has loaded are held and sent once it has.
 *
 * What is sent is cut down in scrub.js: no request bodies, cookies, auth headers or query strings,
 * and the user as an id only. Tracing is sampled at 5% (it carries the web vitals). There is no
 * session replay, and no tracing header is ever added to an API call.
 */
import { getCachedUserDisplay } from '../services/auth/sessionStore';
import { scrubEvent, scrubSpan } from './scrub';

export const sentryEnabled = !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_APP_ENV !== 'e2e';

const EARLY_LIMIT = 20;
let reactErrorHandler = null;
let early = [];

const currentUserId = () => getCachedUserDisplay()?.id;

// reactErrorHandler marks an event handled exactly when it is given a callback. An uncaught error
// is a crash, so it gets none; one an error boundary caught, or that React recovered from, was handled.
const wasHandled = () => {};
const report = (kind, error, errorInfo) => {
  const handler = kind === 'onUncaughtError' ? reactErrorHandler() : reactErrorHandler(wasHandled);
  handler(error, errorInfo);
};

/** Load and start the SDK. Resolves to true once it runs, false when it is off or failed to load. */
export function initSentry() {
  if (!sentryEnabled) return Promise.resolve(false);
  // The SDK is taken export by export, so the bundler keeps only these four: the whole module
  // would also bring Session Replay and the feedback widget, which this app does not use.
  return import('@sentry/react')
    .then(({ init, browserTracingIntegration, breadcrumbsIntegration, reactErrorHandler: handlerFor }) => {
      init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        release: `${__APP_VERSION__}+${__BUILD_ID__}`,
        environment: import.meta.env.VITE_APP_ENV,
        sendDefaultPii: false,
        tracesSampleRate: 0.05,
        // The API's CORS rules do not allow the tracing headers, so none is ever added to a call.
        tracePropagationTargets: [],
        integrations: [
          browserTracingIntegration(),
          // Console messages can carry what a user typed, so they are not kept as breadcrumbs.
          breadcrumbsIntegration({ console: false }),
        ],
        beforeSend: (event) => scrubEvent(event, currentUserId()),
        beforeSendTransaction: (event) => scrubEvent(event, currentUserId()),
        beforeSendSpan: scrubSpan,
      });
      reactErrorHandler = handlerFor;
      early.forEach(([kind, error, errorInfo]) => report(kind, error, errorInfo));
      early = [];
      return true;
    })
    .catch(() => {
      // Blocked or failed to load: the app carries on without error reporting.
      early = [];
      return false;
    });
}

/**
 * createRoot options while Sentry is on. React 19 calls these instead of reporting the error
 * itself, so each one logs the error to the console first, as React would have, then reports it.
 */
export const rootErrorOptions = () => Object.fromEntries(
  ['onUncaughtError', 'onCaughtError', 'onRecoverableError'].map((kind) => [kind, (error, errorInfo) => {
    console.error(error);
    if (reactErrorHandler) report(kind, error, errorInfo);
    else if (early.length < EARLY_LIMIT) early.push([kind, error, errorInfo]);
  }]),
);
