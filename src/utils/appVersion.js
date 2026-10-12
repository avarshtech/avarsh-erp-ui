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
 * The build as screens show it: "v1.10.15 · e1be641", with the environment appended on any
 * build that is not the production site's ("· dev", "· qa", "· e2e"), so a test or development
 * build is never mistaken for production. VITE_APP_ENV comes from the site's own environment.
 * @returns {string}
 */
export const getVersionLabel = () => {
  const env = import.meta.env.VITE_APP_ENV;
  const parts = [getDisplayVersion() || 'unversioned', BUILD_ID];
  if (env !== 'production') parts.push(!env || env === 'development' ? 'dev' : env);
  return parts.join(' · ');
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
