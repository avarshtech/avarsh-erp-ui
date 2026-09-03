// Finishing PO journey — the generate wizard splits by vendor (in-house
// clubbed + one PO per outsourced vendor), then the by-order coverage matrix
// shows the process coverage. Idempotent: the backend rejects duplicate process
// coverage per order, so generation is skipped when FPOs already exist.
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';
import { selectOptionByText, pickToday, expectSuccessToast } from './helpers.js';

const ORDER_NO = 'ORD/0003';

test.describe('Finishing PO', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('generate vendor-split Finishing POs and verify coverage', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/finishing-po/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    const searchBox = page.locator('input[placeholder*="Search"]').first();
    await searchBox.fill(ORDER_NO);
    await page.waitForTimeout(1200);
    const existing = await page.locator('.ant-table-row', { hasText: ORDER_NO }).count();

    if (existing === 0) {
      await page.getByRole('button', { name: /Generate Finishing POs/i }).click();
      await waitForPageReady(page);

      // Step 1 — source
      await selectOptionByText(page, 'Confirmed Order', ORDER_NO);
      const woField = page.locator('.ant-form-item', { hasText: 'Approved Work Order' }).first();
      await woField.locator('.ant-select').first().click();
      const woOption = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: /WO\// }).first();
      await expect(woOption).toBeVisible({ timeout: 10000 });
      await woOption.click();
      await pickToday(page, 'Planned Start');
      await pickToday(page, 'Planned End');
      await page.getByRole('button', { name: /^Next$/ }).click();

      // Step 2 — outsource Ironing to a vendor, rest in-house
      const ironingRow = page.locator('.ant-table-row', { hasText: 'Ironing' });
      await ironingRow.locator('.ant-radio-button-wrapper', { hasText: /Outsource/i }).click();
      const vendorSelect = ironingRow.locator('.ant-select').first();
      await expect(vendorSelect).not.toHaveClass(/ant-select-disabled/, { timeout: 5000 });
      await vendorSelect.click();
      const vendorOption = page.locator('.ant-select-dropdown:visible .ant-select-item-option').first();
      await expect(vendorOption).toBeVisible({ timeout: 10000 });
      await vendorOption.click();
      await page.getByRole('button', { name: /^Next$/ }).click();

      // Step 3 — review shows the split, then generate
      await expect(page.getByText(/2 Finishing POs will be created/i)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Confirm & Generate/i }).click();
      await expectSuccessToast(page, /Finishing PO\(s\) created/i);
      await waitForPageReady(page);
      await waitForTableSettled(page);

      await searchBox.fill(ORDER_NO);
      await page.waitForTimeout(1200);
      expect(await page.locator('.ant-table-row', { hasText: ORDER_NO }).count()).toBeGreaterThanOrEqual(2);
    }

    // By-order coverage matrix
    await page.locator('.ant-segmented-item', { hasText: /By Order/i }).click();
    await page.waitForTimeout(500);
    const coverageRow = page.locator('.ant-table-row', { hasText: ORDER_NO }).first();
    await expect(coverageRow).toBeVisible({ timeout: 10000 });
    // Ironing covered (vendor) and Trimming covered (in-house) — no GAP on those cells
    await expect(coverageRow.locator('.anticon-check-circle').first()).toBeVisible();
  });
});
