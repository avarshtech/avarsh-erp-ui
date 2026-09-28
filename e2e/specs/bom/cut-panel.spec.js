/**
 * BOM — Cut Panel Requirement (UI mock phase)
 *
 * The CPR screens run on a localStorage mock (services/bom/requirementEnv.js) while
 * their panel and process dropdowns read the REAL Parts and Processes masters
 * (category 'Cut Panel'). Every test gets a fresh browser context, so the mock starts
 * from its seed: CPR-2026-00001 is the PRD appendix requirement (5,415 pcs).
 *
 * What this tests:
 *   - BOM menu: BOM List · Cut Panel · Garment Process, and no "Create BOM" item
 *   - List: seeded requirements with totals and status
 *   - A submitted CPR is read-only; colours without a process read "No cut-panel process"
 *   - Create: Colours x Panels x Processes expansion, PRD quantities (4Y 220 @2% → 225,
 *     @3% → 227), duplicate skipping, reason required for a variance, Save → number,
 *     Submit (WRN-03 confirm) → Submitted
 *   - Reopen (nothing consumed) and Close (reason mandatory)
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

async function pickOption(page, id, text) {
  await page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]').click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

const lineRow = (page, process) => page.locator('.ant-table-row').filter({ hasText: process }).first();

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('BOM menu lists BOM List, Cut Panel and Garment Process — no Create BOM item', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  const sider = page.locator('.ant-layout-sider');
  for (const item of ['BOM List', 'Cut Panel', 'Garment Process']) {
    await expect(sider.locator('.ant-menu-item').filter({ hasText: item })).toBeVisible();
  }
  await expect(sider.locator('.ant-menu-item').filter({ hasText: /^Create BOM$/ })).toHaveCount(0);
});

test('List shows the seeded requirements with totals and status', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  const row = page.locator('.ant-table-row').filter({ hasText: 'CPR-2026-00001' });
  await expect(row).toContainText('ORD-2026-00125');
  await expect(row).toContainText('5,415');
  await expect(row).toContainText('Submitted');
  await expect(page.getByRole('button', { name: /New Cut Panel Requirement/ })).toBeVisible();
});

test('A submitted requirement is read-only and reports colours without a process', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/1');
  await waitForPageReady(page);
  await expect(page.getByRole('heading', { name: /CPR-2026-00001/ })).toBeVisible();
  await expect(page.getByText('No cut-panel process')).toHaveCount(2); // White and Navy
  await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
});

test('Create: expand, calculate, record a variance reason, save and submit', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/new');
  await waitForPageReady(page);

  await pickOption(page, 'cpr-order', 'ORD-2026-00125');
  await expect(page.getByText(/already has cut panel requirements/)).toBeVisible(); // WRN-07
  await pickOption(page, 'cpr-fabric', 'Single Jersey');
  await pickOption(page, 'cpr-colours', 'Black');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-panels', 'Front Panel');
  await page.keyboard.press('Escape');
  for (const process of ['Panel Printing', 'Panel Embroidery', 'Heat Transfer']) {
    await pickOption(page, 'cpr-processes', process);
  }
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText('3 line(s) added to the grid')).toBeVisible();
  await expect(lineRow(page, 'Panel Printing').locator('input[name$="-4Y"]')).toHaveValue('225');

  // Same selection again: nothing duplicated (PRD §8.2.3)
  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText('3 line(s) already exist and were skipped')).toBeVisible();

  // Allowance 3% on embroidery recalculates that line only and needs a reason (WRN-04)
  const embroidery = lineRow(page, 'Panel Embroidery');
  await embroidery.locator('input[name^="allow-"]').fill('3');
  await embroidery.locator('input[name^="allow-"]').press('Tab');
  await expect(embroidery.locator('input[name$="-4Y"]')).toHaveValue('227');
  await expect(lineRow(page, 'Panel Printing').locator('input[name$="-4Y"]')).toHaveValue('225');

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Record a reason on every line/).first()).toBeVisible();
  await embroidery.locator('input[name^="reason-"]').fill('Extra 1% for embroidery rejection');

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Draft saved')).toBeVisible();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/\d+$/);
  await expect(page.getByRole('heading', { name: /CPR-\d{4}-\d{5}/ })).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  const confirm = page.locator('.ant-modal-confirm').last(); // WRN-03: Red, White, Navy have no process
  await expect(confirm).toContainText('Red, White, Navy');
  await confirm.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the requirement is now available/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
});

test('Reopen returns an unconsumed requirement to Draft; Close needs a reason', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/1');
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Reopen' }).click();
  await page.locator('.ant-modal').last().getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText('Reopened as Draft')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();

  // CPR-2026-00003 is partially used: no Reopen, Close with a mandatory reason
  await navigateWithAuth(page, '/bom/cut-panel/3');
  await waitForPageReady(page);
  await expect(page.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  const dialog = page.locator('.ant-modal').last();
  await expect(dialog.getByRole('button', { name: 'Close Requirement' })).toBeDisabled();
  await dialog.locator('textarea').fill('Order short-shipped, balance not needed');
  await dialog.getByRole('button', { name: 'Close Requirement' }).click();
  await expect(page.getByText('Requirement closed')).toBeVisible();
  await expect(page.locator('.ant-alert-description').filter({ hasText: 'Order short-shipped, balance not needed' })).toBeVisible();
});
