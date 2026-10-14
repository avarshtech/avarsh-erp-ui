/**
 * Where an e2e run points and who it signs in as: the one place the config, the fixtures and the
 * helpers read these from.
 *
 * A run creates, edits and deletes records, so it may only ever reach servers on this machine:
 * the e2e API (H2, rebuilt at every boot) and the dev or preview server in front of it. A base URL
 * or API URL anywhere else is refused when this module loads, which is before Playwright starts a
 * single test, unless E2E_ALLOW_REMOTE=1 says so on purpose. The UI under test can still point
 * somewhere else (a plain `npm run dev` talks to the shared API), so `isRemoteApiRequest` lets the
 * login paths refuse a request to another machine's API before it is sent.
 */
import process from 'process';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
export const E2E_API_URL = process.env.E2E_API_URL || 'http://localhost:8088/api/v1';
export const E2E_USERNAME = process.env.E2E_USERNAME || 'superadmin';
/** The e2e seed's superadmin password (erp-purchase db/e2eseed/V100__seed_roles_users.sql). */
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';
export const E2E_ALLOW_REMOTE = process.env.E2E_ALLOW_REMOTE === '1';

const hostnameOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

/** True for a URL on this machine (localhost, 127.0.0.1 or ::1). */
export const isLocalUrl = (url) => LOCAL_HOSTNAMES.has(hostnameOf(url));

/**
 * True for a request to an ERP API (`/api/v1/`) on another machine, which a run must not send
 * unless E2E_ALLOW_REMOTE=1. Other outside requests (fonts, the pincode and Pantone lookups)
 * are left alone.
 */
export const isRemoteApiRequest = (url) =>
  !E2E_ALLOW_REMOTE && /^https?:\/\/[^/]+\/api\/v1\//.test(url) && !isLocalUrl(url);

function assertLocal(name, url) {
  const host = hostnameOf(url);
  if (!host) throw new Error(`${name} is not a URL: "${url}"`);
  if (E2E_ALLOW_REMOTE || LOCAL_HOSTNAMES.has(host)) return;
  throw new Error(
    `${name} is ${url}, which is not this machine. An e2e run creates and deletes records, so it ` +
      'runs only against the local e2e stack (see e2e/README.md). Set E2E_ALLOW_REMOTE=1 only if ' +
      'you really mean to run it against that server.',
  );
}

assertLocal('E2E_BASE_URL', E2E_BASE_URL);
assertLocal('E2E_API_URL', E2E_API_URL);
