/**
 * Keeps the browser off any ERP API but the local one. e2e/config/env.js refuses a remote
 * E2E_BASE_URL or E2E_API_URL, but the UI under test brings its own API address: a plain
 * `npm run dev` reads .env, which points at the shared API with real data.
 */
import { isRemoteApiRequest } from '../config/env.js';

/**
 * Abort, before it is sent, every request the page makes to another machine's ERP API, and
 * collect the URLs. Routing turns the browser's HTTP cache off, so this is for the one-off login
 * in the setup project, where it keeps the credentials from ever leaving the machine.
 * @returns {Promise<string[]>} the URLs that were stopped
 */
export async function blockRemoteApi(page) {
  const blocked = [];
  await page.route(
    (url) => isRemoteApiRequest(url.href),
    (route) => {
      blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    },
  );
  return blocked;
}

/**
 * Collect, without intercepting, every request the page makes to another machine's ERP API.
 * For per-test pages: their session cookie belongs to the local API, so such a request carries
 * no credentials, and the test is failed with the reason.
 * @returns {string[]} the URLs seen so far (filled in as requests are made)
 */
export function watchRemoteApi(page) {
  const seen = [];
  page.on('request', (request) => {
    if (isRemoteApiRequest(request.url())) seen.push(request.url());
  });
  return seen;
}

/** Throw, with the reason and the fix, if any request went (or tried to go) to a remote ERP API. */
export function assertNoRemoteApi(urls) {
  if (urls.length === 0) return;
  throw new Error(
    `The UI under test called ${new URL(urls[0]).origin}, not the local e2e API. Start it with ` +
      '`npx vite --mode e2e`, which reads .env.e2e (see e2e/README.md), or set E2E_ALLOW_REMOTE=1 ' +
      'if that server is really meant.',
  );
}
