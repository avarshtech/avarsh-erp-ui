/**
 * What the floor records has to survive a page reload — the real proof the
 * module left the mock. Each spec creates through the UI, reloads the browser
 * and asserts the document is still there with its server-derived figures.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { openTab, settle, tableRows, pickOption, selectAt, expectToast, TABS, watchConsole } from './helpers.js';

test.describe('Sewing — records survive a reload', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('a garment issue posted through the drawer is still there after reload', async ({ page }) => {
    const errors = watchConsole(page);
    await openTab(page, TABS.issue);

    const before = await tableRows(page);

    await page.getByRole('button', { name: /New Garment Issue/i }).click();
    const drawer = page.locator('.ant-drawer-body');
    await drawer.waitFor({ state: 'visible', timeout: 10000 });

    await pickOption(page, selectAt(drawer, 0), 'SG/');
    // The size sheet is built server-side from the order's size run.
    await expect(drawer.locator('.ant-table-tbody tr').first()).toBeVisible({ timeout: 15000 });

    const qty = drawer.locator('.ant-input-number-input').first();
    await qty.fill('7');
    await drawer.getByPlaceholder('Issued by').fill('E2E Storekeeper');

    await page.locator('.ant-drawer-footer button.ant-btn-primary').click();
    await expectToast(page, /pcs issued/i);

    await page.reload();
    await settle(page);

    const after = await tableRows(page);
    expect(after.length, 'the new issue should be listed').toBeGreaterThan(before.length);
    expect(after.some((r) => r.includes('E2E Storekeeper')), 'the issue we just made should survive the reload').toBe(true);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('an end-line report keeps its derived DHU and traffic light after reload', async ({ page }) => {
    const errors = watchConsole(page);
    await openTab(page, TABS.topse);

    await page.getByRole('button', { name: /New End-Line Check/i }).click();
    await page.waitForURL(/\/production\/sewing\/topse\/new/, { timeout: 15000 });
    await settle(page);

    // 8 defects in 200 pieces is 4% DHU — above the 3% green ceiling and below
    // the 5% red one, so the light has to read YELLOW / Watch.
    const inspected = page.locator('.ant-card').first()
      .locator('div', { hasText: /^Total Inspected$/ }).locator('..')
      .locator('.ant-input-number-input').first();
    await inspected.fill('200');
    await page.keyboard.press('Tab');

    await page.getByRole('button', { name: /Add Defect/i }).click();
    await settle(page, 800);

    const row = page.locator('.ant-table-tbody tr').filter({ has: page.locator('.ant-select') }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    // Third select on the row is the defect type; category is pre-filled.
    await pickOption(page, row.locator('.ant-select').nth(2), /\w/);
    await row.locator('.ant-input-number-input').first().fill('8');
    await page.keyboard.press('Tab');
    await settle(page, 800);

    await expect(page.getByText(/4%/).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Save Report/i }).click();
    await expectToast(page, /DHU/i);
    await page.waitForURL(/tab=topse/, { timeout: 15000 });
    await settle(page);

    const rows = await tableRows(page);
    const saved = rows.find((r) => r.includes('200'));
    expect(saved, 'the report we just saved should be listed').toBeTruthy();
    expect(saved).toMatch(/4%/);
    expect(saved).toMatch(/Watch/i);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
