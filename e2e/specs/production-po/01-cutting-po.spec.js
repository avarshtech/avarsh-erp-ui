// Cutting PO journey — create against the seeded eligible order (ORD/0003:
// CONFIRMED + CREATED BOM + PP COMPLETED per V117), bulk-rate the matrix,
// verify the no-price guard, submit (auto-approves — no approval flow is
// configured for CUTTING_PO in the e2e seeds) and assert APPROVED.
// Idempotent: skips creation when an approved Cutting PO already exists.
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';
import { selectOptionByText, pickToday, submitAnywayIfAsked, applyBulkRate, approvedRowExists, expectSuccessToast } from './helpers.js';

const ORDER_NO = 'ORD/0003';

test.describe('Cutting PO', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('create, guard rates, submit and approve a Cutting PO', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/cutting-po/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    if (await approvedRowExists(page, ORDER_NO)) {
      test.info().annotations.push({ type: 'note', description: 'Approved Cutting PO already present — creation skipped.' });
      return;
    }

    await page.getByRole('button', { name: /New Cutting PO/i }).click();
    await waitForPageReady(page);

    // General tab
    await selectOptionByText(page, 'Confirmed Order', ORDER_NO);
    await expect(page.locator('.ant-alert', { hasText: /PP Sample approved/i })).toBeVisible({ timeout: 10000 });
    await pickToday(page, 'Planned Cut Date');
    await selectOptionByText(page, 'Factory Unit', 'Unit 1');
    await pickToday(page, 'Planned Delivery Date');

    // Guard: saving without any rate must be blocked
    await page.getByRole('button', { name: /Save & Submit/i }).click();
    await expect(page.locator('.ant-message-notice', { hasText: /rate\/price for every/i }).first())
      .toBeVisible({ timeout: 10000 });

    // Rates via bulk apply, then submit for real
    await applyBulkRate(page, 12.5);
    await page.getByRole('button', { name: /Save & Submit/i }).click();
    await submitAnywayIfAsked(page);
    await expectSuccessToast(page, /submitted/i);

    // Auto-approved (no CUTTING_PO approval flow configured in e2e seeds)
    await waitForPageReady(page);
    await waitForTableSettled(page);
    expect(await approvedRowExists(page, ORDER_NO)).toBeTruthy();
  });
});
