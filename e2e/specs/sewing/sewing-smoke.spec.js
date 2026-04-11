/**
 * Sewing Module — Smoke Tests
 * Verifies every sewing sub-page loads without crashing.
 */

import { test, expect } from '@playwright/test';
import { goToListPage, navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Sewing Module — Smoke Tests', () => {

  test('Sewing Dashboard loads', async ({ page }) => {
    await navigateWithAuth(page, '/sewing/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('Quality Dashboard loads', async ({ page }) => {
    await navigateWithAuth(page, '/sewing/quality-dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  test('Skill Matrix page loads', async ({ page }) => {
    await navigateWithAuth(page, '/sewing/skills');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.ant-layout-content')).toBeVisible();
  });

  const listPages = [
    { name: 'Sewing Lines', path: '/sewing/lines/list' },
    { name: 'Operators', path: '/sewing/operators/list' },
    { name: 'SAM Standards', path: '/sewing/sam/list' },
    { name: 'Sewing Plan', path: '/sewing/plan/list' },
    { name: 'Cut Parts Receipt', path: '/sewing/cut-parts-receipt/list' },
    { name: 'Hourly Production', path: '/sewing/hourly/list' },
    { name: 'Garment Issue', path: '/sewing/garment-issue/list' },
    { name: 'Trim Verification', path: '/sewing/trim-verification/list' },
    { name: 'Measurement Report', path: '/sewing/measurement/list' },
    { name: 'TOPSE', path: '/sewing/topse/list' },
    { name: 'Replacement', path: '/sewing/replacement/list' },
    { name: 'Incentive', path: '/sewing/incentive/list' },
  ];

  for (const { name, path } of listPages) {
    test(`${name} list page loads`, async ({ page }) => {
      await goToListPage(page, path);
      const content = page.locator('.ant-layout-content');
      await expect(content).toBeVisible();
      const hasTable = await content.locator('.ant-table').isVisible().catch(() => false);
      const hasEmpty = await content.locator('.ant-empty').isVisible().catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();
    });
  }

});
