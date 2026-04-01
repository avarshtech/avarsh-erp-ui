/**
 * Navigation Helpers for E2E Tests
 *
 * Handles auth-aware navigation, session restoration, and page readiness.
 * Extracted from existing costing.spec.js patterns.
 */

import process from 'process';

const E2E_USERNAME = process.env.E2E_USERNAME || 'superadmin';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

/**
 * Navigate to a page, re-authenticate if session expired, and retry navigation.
 * After page.goto(), the React router may redirect to /login if the session
 * is invalid. We race between the app sidebar appearing (authenticated) and
 * the login form appearing (session expired).
 */
export async function navigateWithAuth(page, path, { username, password } = {}) {
  await page.goto(path);

  const loginField = page.getByPlaceholder('Username');
  const appSidebar = page.locator('.ant-layout-sider');

  // Race: whichever appears first — app sidebar or login form
  await Promise.race([
    loginField.waitFor({ state: 'visible', timeout: 15000 }),
    appSidebar.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {});

  // If login form appeared, re-authenticate
  if (await loginField.isVisible().catch(() => false)) {
    await loginField.fill(username || E2E_USERNAME);
    await page.getByPlaceholder('Password').fill(password || E2E_PASSWORD);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForLoadState('networkidle');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Navigate to a module page and wait for it to be ready.
 */
export async function goToModule(page, path) {
  await navigateWithAuth(page, path);
  await waitForPageReady(page);
}

/**
 * Wait for page to be ready — spinner gone, content visible.
 */
export async function waitForPageReady(page, { timeout = 20000 } = {}) {
  // Wait for any loading spinners to disappear
  await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Navigate to a list page and wait for the table to render.
 * Returns true if data rows exist, false if table is empty.
 */
export async function goToListPage(page, path) {
  await navigateWithAuth(page, path);
  await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  const dataRowCount = await page.locator('.ant-table-row').count();
  return dataRowCount > 0;
}

/**
 * Ensure sessionStorage has the sessionActive flag set.
 * Call in test.beforeEach to prevent auth issues.
 */
export async function ensureSessionActive(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('sessionActive', 'true');
  });
}
