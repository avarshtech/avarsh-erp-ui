// Work Order (Sewing PO) journey — created against the APPROVED Cutting PO from
// spec 01. Asserts the garment-process banner (BOM-derived), rates the matrix
// and submits (auto-approves — no WORK_ORDER flow in e2e seeds).
// Idempotent: skips creation when an approved Work Order already exists.
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { waitForTableSettled, formField } from '../../helpers/ui-master.js';
import { selectOptionByText, pickToday, submitAnywayIfAsked, applyBulkRate, approvedRowExists, expectSuccessToast } from './helpers.js';

const ORDER_NO = 'ORD/0003';

test.describe('Work Order', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('create a Work Order against the approved Cutting PO and approve it', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/work-order/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    if (await approvedRowExists(page, ORDER_NO)) {
      test.info().annotations.push({ type: 'note', description: 'Approved Work Order already present — creation skipped.' });
      return;
    }

    await page.getByRole('button', { name: /New Work Order/i }).click();
    await waitForPageReady(page);

    await selectOptionByText(page, 'Confirmed Order', ORDER_NO);
    await expect(page.locator('.ant-alert', { hasText: /PP Sample approved/i })).toBeVisible({ timeout: 10000 });

    // The approved Cutting PO from spec 01 must be offered
    const cpoField = formField(page, 'Approved Cutting PO');
    await cpoField.locator('.ant-select').first().click();
    const cpoOption = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: /CPO\// }).first();
    await expect(cpoOption).toBeVisible({ timeout: 10000 });
    await cpoOption.click();

    // Garment processes surfaced from the BOM (seeded lines carry processes)
    await expect(page.locator('.ant-alert', { hasText: /requires additional process/i }))
      .toBeVisible({ timeout: 10000 });

    await pickToday(page, 'Planned Start');
    await pickToday(page, 'Planned End');
    await selectOptionByText(page, 'Factory Unit', 'Unit 1');
    await pickToday(page, 'Planned Delivery Date');

    await applyBulkRate(page, 30);
    await page.getByRole('button', { name: /Save & Submit/i }).click();
    await submitAnywayIfAsked(page);
    await expectSuccessToast(page, /submitted/i);

    await waitForPageReady(page);
    await waitForTableSettled(page);
    expect(await approvedRowExists(page, ORDER_NO)).toBeTruthy();
  });
});
