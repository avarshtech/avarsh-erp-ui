/**
 * Cutting Module — Smoke Tests
 * Verifies every cutting sub-page loads without crashing.
 */

import { test, expect } from '@playwright/test';
import { goToListPage, navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Cutting Module — Smoke Tests', () => {

  test('Cutting Dashboard loads', async ({ page }) => {
    await navigateWithAuth(page, '/cutting/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  const listPages = [
    { name: 'Cut Order Plan', path: '/cutting/order-plan/list' },
    { name: 'Fabric Receipt', path: '/cutting/fabric-receipt/list' },
    { name: 'Relaxation', path: '/cutting/relaxation/list' },
    { name: 'Marker', path: '/cutting/marker/list' },
    { name: 'Lay Audit', path: '/cutting/lay-audit/list' },
    { name: 'TMB Check', path: '/cutting/tmb-check/list' },
    { name: 'Cutting Report', path: '/cutting/report/list' },
    { name: 'Bundling', path: '/cutting/bundling/list' },
    { name: 'Bundle Issue', path: '/cutting/bundle-issue/list' },
    { name: 'Panel Issue', path: '/cutting/panel-issue/list' },
    { name: 'Panel Check', path: '/cutting/panel-check/list' },
    { name: 'Process Return', path: '/cutting/process-return/list' },
    { name: 'Recutting', path: '/cutting/recutting/list' },
    { name: 'Wastage', path: '/cutting/wastage/list' },
  ];

  for (const { name, path } of listPages) {
    test(`${name} list page loads`, async ({ page }) => {
      await goToListPage(page, path);
      // Verify the main content area rendered (table OR empty state)
      const content = page.locator('.ant-layout-content');
      await expect(content).toBeVisible();
      // Either table or empty state should be present
      const hasTable = await content.locator('.ant-table').isVisible().catch(() => false);
      const hasEmpty = await content.locator('.ant-empty').isVisible().catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();
    });
  }

});
