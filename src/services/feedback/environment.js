/**
 * Which deployment a report comes from (LOCAL, DEV, QA, PROD, TEST), using the most trustworthy source
 * available:
 *   1. the ERP server, which signs its own environment into the reporter token (ERP_SERVER);
 *   2. this UI build's VITE_APP_ENV (APP_BUILD), shown to the reporter so they can correct it;
 *   3. the reporter's own choice (REPORTER).
 * The issue service applies the same order, and never lets the browser override the ERP server.
 */

export const ENVIRONMENT_LABELS = {
  DEV: 'Development',
  QA: 'QA',
  PROD: 'Production',
  LOCAL: 'Local',
  TEST: 'Test / automation',
};

/** An environment name as the ERP and the issue service write it, or null if it is none of them. */
export function normaliseEnvironment(name) {
  const n = String(name ?? '').trim().toLowerCase();
  if (n === 'prod' || n === 'production') return 'PROD';
  if (n === 'qa') return 'QA';
  if (n === 'dev' || n === 'development') return 'DEV';
  if (n === 'local') return 'LOCAL';
  if (n === 'test' || n === 'e2e' || n.startsWith('e2e-')) return 'TEST';
  return null;
}

/** What this UI build says it is (VITE_APP_ENV), or null. */
export function detectBuildEnvironment(appEnv = import.meta.env?.VITE_APP_ENV) {
  return normaliseEnvironment(appEnv);
}

/**
 * The environment fields of a submission.
 * @param {object} p
 * @param {string|null} p.serverEnvironment what the ERP put in the token (wins; nothing is sent)
 * @param {string|null} p.buildEnvironment  what this build detected
 * @param {string|undefined} p.chosen       the value in the form
 * @returns {{environment?: string, environmentSource?: 'APP_BUILD'|'REPORTER'}}
 */
export function environmentFields({ serverEnvironment, buildEnvironment, chosen }) {
  if (serverEnvironment) return {};
  if (!chosen) return {};
  return {
    environment: chosen,
    environmentSource: buildEnvironment && chosen === buildEnvironment ? 'APP_BUILD' : 'REPORTER',
  };
}
