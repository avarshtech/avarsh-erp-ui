/**
 * Error text helpers for screens that talk to both the mock layer and the real API.
 *
 * The axios response interceptor already toasts every non-401 API error and
 * stamps the server's text on `error.errorMessage`; mock-layer failures are
 * plain `Error`s carrying only `message`. Reading through `errorText` keeps the
 * wording identical either way, and `toastUnlessHandled` toasts only when the
 * interceptor did not — so one failure never raises two toasts once a screen is
 * cut over to real endpoints.
 */

/** Server text, then local text, then the caller's fallback. */
export const errorText = (e, fallback = 'Something went wrong') => e?.errorMessage || e?.message || fallback;

/**
 * Toast `e` through the `App.useApp()` message instance — unless the axios
 * interceptor already did (which is exactly when `errorMessage` is set).
 */
export const toastUnlessHandled = (message, e, fallback = 'Something went wrong') => {
  if (e?.errorMessage) return;
  message.error(errorText(e, fallback));
};
