/**
 * Build identity, injected at build time by vite.config.js.
 *
 * BUILD_ID changes on every deploy (Netlify's COMMIT_REF, else the git SHA, else
 * the clock), so the app can tell one build from another even before human-facing
 * release versioning exists.
 *
 * APP_VERSION is package.json's version — only worth showing once releases are
 * actually numbered, so getDisplayVersion() hides the Vite default.
 */
export const BUILD_ID = __BUILD_ID__;
export const APP_VERSION = __APP_VERSION__;

const BUILD_KEY = 'avarsh-erp-build-id';

/**
 * The version to show users, or null while release versioning is still unset.
 * @returns {string|null}
 */
export const getDisplayVersion = () => {
  if (!APP_VERSION || APP_VERSION === '0.0.0') return null;
  return APP_VERSION.startsWith('v') ? APP_VERSION : `v${APP_VERSION}`;
};

/**
 * Report whether this browser is running a build it has not run before, and
 * record the build so the answer is true only once per deploy.
 *
 * Returns false when no build has ever been recorded: that is a first install,
 * not an update, and there is nothing to announce.
 *
 * @returns {boolean} True if the build changed since this browser last checked.
 */
export const consumeBuildChange = () => {
  let previous = null;
  try {
    previous = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, BUILD_ID);
  } catch {
    // Storage blocked (private mode, quota) — stay silent rather than announce
    // an update on every single load.
    return false;
  }
  return !!previous && previous !== BUILD_ID;
};
