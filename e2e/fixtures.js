/**
 * Shared Playwright fixtures. Import `test` and `expect` from here instead of '@playwright/test':
 *
 *   import { test, expect } from '../../fixtures.js';
 *
 *   test('the list shows the seed', async ({ api, authedPage, consoleGuard }) => { ... });
 *
 * - `api`: an ApiClient logged in once per worker (helpers/api-client.js), for seeding and
 *   checking records without the UI.
 * - `authedPage`: the test's page, signed in through the API for this test alone. The refresh
 *   token is rotated on every use and a reused one is revoked, so a storage state saved once and
 *   shared by many tests goes stale; a per-test login cannot. The app then starts its session the
 *   way it does after a reload. Needs no setup project and no storage state.
 * - `consoleGuard`: fails the test on a page error or a console error (also warnings when
 *   `test.use({ consoleGuardLevels: ['error', 'warning'] })`), ignoring the noise listed in
 *   helpers/console-noise.js. Its value is the list of problems so far. Request it to switch it
 *   on; nothing else is needed.
 */
import { test as base, expect } from '@playwright/test';
import { createAuthenticatedClient } from './helpers/api-client.js';
import { isConsoleNoise } from './helpers/console-noise.js';
import { assertNoRemoteApi, watchRemoteApi } from './helpers/remote-api-guard.js';
import { E2E_API_URL, E2E_PASSWORD, E2E_USERNAME } from './config/env.js';

export const test = base.extend({
  consoleGuardLevels: [['error'], { option: true }],

  // eslint-disable-next-line no-empty-pattern -- a worker fixture with no dependencies
  api: [async ({}, use) => {
    const api = await createAuthenticatedClient();
    await use(api);
    await api.dispose();
    // The first login after the API boots can be slow; it should not eat a test's timeout.
  }, { scope: 'worker', timeout: 120000 }],

  authedPage: async ({ page, baseURL }, use) => {
    const remoteCalls = watchRemoteApi(page);

    // The context's request shares the browser's cookie jar, so the refresh-token cookie the
    // login sets is the one the app's refresh call sends.
    const login = await page.context().request.post(`${E2E_API_URL}/auth/login`, {
      data: { username: E2E_USERNAME, password: E2E_PASSWORD },
    });
    expect(login.ok(), `API login as ${E2E_USERNAME} failed: ${login.status()}`).toBeTruthy();
    // The cookie is scoped to /api/v1/auth, so ask for the URL the app's refresh call uses.
    const cookies = await page.context().cookies(`${E2E_API_URL}/auth/refresh`);
    expect(cookies.some((c) => c.name === 'refreshToken'), 'the API login left no refresh-token cookie').toBeTruthy();

    // What a signed-in tab has in localStorage: the flag that makes the app refresh its session
    // on load, and the notification opt-in already answered so its modal never covers the page.
    // Seeded once per tab (a sign-out inside the test stays a sign-out), on the app's own origin.
    await page.addInitScript((origin) => {
      try {
        if (window.location.origin !== origin || sessionStorage.getItem('e2e:session-seeded')) return;
        sessionStorage.setItem('e2e:session-seeded', '1');
        localStorage.setItem('sessionActive', 'true');
        localStorage.setItem('avarsh-notif-prompt-dismissed', String(Date.now()));
      } catch {
        // A frame without storage (sandboxed iframe, about:blank) has no session to seed.
      }
    }, new URL(baseURL).origin);

    await use(page);
    assertNoRemoteApi(remoteCalls);
  },

  consoleGuard: async ({ page, consoleGuardLevels }, use) => {
    const problems = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (!consoleGuardLevels.includes(message.type())) return;
      const text = message.text();
      if (!isConsoleNoise(text)) problems.push(`${message.type()}: ${text.split('\n')[0]}`);
    });
    await use(problems);
    expect(problems, problems.join('\n')).toEqual([]);
  },
});

export { expect };
