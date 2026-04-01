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

    // Click Sign In and wait for auth API response
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
        { timeout: 30000 }
      ),
      page.getByRole('button', { name: /Sign In/i }).click(),
    ]);

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the intended page
    if (!page.url().includes(path)) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
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
    // Suppress notification permission prompt during E2E tests
    localStorage.setItem('avarsh-notif-prompt-dismissed', Date.now().toString());
  });
}

/**
 * Dismiss any overlay modals (e.g., notification permission prompt) that may block UI interaction.
 */
async function dismissOverlayModals(page) {
  // Dismiss "Stay Updated on Your ERP" notification prompt
  const notNowBtn = page.getByRole('button', { name: /Not Now/i });
  if (await notNowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await notNowBtn.click();
    await page.waitForTimeout(300);
  }
  // Dismiss any generic Ant Design modal
  const modalCloseBtn = page.locator('.ant-modal-wrap:visible .ant-modal-close');
  if (await modalCloseBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await modalCloseBtn.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Navigate to master data page and select a specific entity from the sidebar.
 * The master data page uses a split-view with a left sidebar nav.
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} entityName - Text or regex to match in the sidebar (e.g., 'Buyers', /Item Types?/i)
 */
export async function goToMasterEntity(page, entityName) {
  await navigateWithAuth(page, '/master');
  // Wait for the sidebar navigation to render
  await page.locator('.ant-layout-sider').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await waitForPageReady(page);

  // Dismiss any overlay modals that may block interaction
  await dismissOverlayModals(page);

  // The master data page uses a custom left nav panel (not ant-layout-sider).
  // Find and click the nav item by its label text.
  const pattern = typeof entityName === 'string' ? new RegExp(entityName, 'i') : entityName;

  // The nav items are inside the main content area (not the app sidebar).
  // Use getByText scoped to the page content, clicking the first match.
  const navItem = page.getByText(pattern, { exact: false }).first();
  await navItem.waitFor({ state: 'visible', timeout: 10000 });
  await navItem.click();

  // Wait for the content area table to load
  await page.locator('.ant-table').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}
