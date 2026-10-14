/**
 * The shared fixtures (e2e/fixtures.js) do what the specs rely on.
 *
 * What this tests:
 *   - `api` is signed in and is one client for the whole worker
 *   - `authedPage` reaches the app shell with no saved login, and the session survives a reload,
 *     which rotates the refresh token
 *   - `consoleGuard` fails a test on a page error and on a console error
 *   - `authedPage` fails a test whose page calls another machine's ERP API
 *
 * The last three are expected failures (test.fail): each passes only if the guard fails it.
 */
import { test, expect } from '../../fixtures.js';

let firstClient;

test.describe('Fixtures', () => {
  test('api is signed in', async ({ api }) => {
    firstClient = api;
    const res = await api.get('/me/permissions');
    expect(res.status).toBe(200);
  });

  test('api is one client per worker', async ({ api }) => {
    expect(api).toBe(firstClient);
  });

  test('authedPage opens the app signed in, and stays signed in after a reload', async ({ authedPage, consoleGuard }) => {
    await authedPage.goto('/');
    await expect(authedPage.locator('#main-content')).toBeVisible();
    await expect(authedPage).not.toHaveURL(/\/login/);

    await authedPage.reload();
    await expect(authedPage.locator('#main-content')).toBeVisible();
    await expect(authedPage).not.toHaveURL(/\/login/);
  });

  test('consoleGuard fails a test on a page error', async ({ authedPage, consoleGuard }) => {
    test.fail(true, 'the guard must fail this test');
    await authedPage.goto('/');
    await expect(authedPage.locator('#main-content')).toBeVisible();
    await authedPage.evaluate(() => setTimeout(() => { throw new Error('fixture check: page error'); }));
    await expect.poll(() => consoleGuard.length).toBe(1);
  });

  test('consoleGuard fails a test on a console error', async ({ authedPage, consoleGuard }) => {
    test.fail(true, 'the guard must fail this test');
    await authedPage.goto('/');
    await expect(authedPage.locator('#main-content')).toBeVisible();
    await authedPage.evaluate(() => console.error('fixture check: console error'));
    await expect.poll(() => consoleGuard.length).toBe(1);
  });

  test('authedPage fails a test whose page calls a remote ERP API', async ({ authedPage }) => {
    test.fail(true, 'the remote-API watch must fail this test');
    await authedPage.goto('/');
    await authedPage.evaluate(() => fetch('https://api.example.invalid/api/v1/orders').catch(() => {}));
  });
});
