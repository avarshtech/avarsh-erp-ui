/**
 * BOM — Garment Process Requirement (UI mock phase)
 *
 * The GPR screens run on a localStorage mock (services/bom/requirementEnv.js); the
 * process dropdown reads the REAL Processes master (category 'Garment'). Every test gets
 * a fresh browser context, so the mock starts from its seed: GPR-2026-00001 is the PRD
 * example on ORD-2026-0418 (7,000 / 4,000 / 6,850).
 *
 * What this tests:
 *   - List: process flow and per-line quantities of the seeded example
 *   - PRD example built from scratch: colour selection, Add process, Copy from previous
 *     Seq, lowering one cell (Navy 5-6Y → 450), flow line, Submit → read-only
 *   - A process on another line is shown "(already added)" and cannot be picked twice
 *   - A cell above its order qty turns amber; Submit then needs a reason (superadmin
 *     holds "Submit above order qty")
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

async function openSelect(page, id) {
  await page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]').click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
}

async function pickOption(page, id, text) {
  const dropdown = await openSelect(page, id);
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

const chip = (page, group, text) => page.getByRole('group', { name: group }).locator('.ant-tag').filter({ hasText: text });
const lineTotal = (page) => page.getByText(/Total process quantity/);

async function startNew(page) {
  await navigateWithAuth(page, '/bom/garment-process/new');
  await waitForPageReady(page);
  await pickOption(page, 'gpr-order', 'ORD-2026-0418');
  await expect(page.getByText('Seq 1').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('List shows the process flow and per-line quantities', async ({ page }) => {
  await navigateWithAuth(page, '/bom/garment-process/list');
  const row = page.locator('.ant-table-row').filter({ hasText: 'GPR-2026-00001' });
  await expect(row).toContainText('Enzyme Washing → Bleach Washing → Softener Washing');
  await expect(row).toContainText('7,000 / 4,000 / 6,850');
  await expect(row).toContainText('Submitted');
});

test('PRD example: 7,000 → 4,000 → 6,850, then submit', async ({ page }) => {
  await startNew(page);

  // Seq 1 — Enzyme Washing on Black + Navy
  await pickOption(page, 'gpr-process-G1', 'Enzyme Washing');
  await chip(page, 'Colours', 'White').click();
  await expect(lineTotal(page)).toContainText('7,000');

  // Seq 2 — Bleach Washing on Black only
  await page.getByRole('button', { name: 'Add process' }).click();
  await pickOption(page, 'gpr-process-G2', 'Bleach Washing');
  await chip(page, 'Colours', 'Navy').click();
  await chip(page, 'Colours', 'White').click();
  await expect(lineTotal(page)).toContainText('4,000');

  // Seq 3 — Softener Washing: copy Seq 2, add Navy, lower Navy 5-6Y to 450
  await page.getByRole('button', { name: 'Add process' }).click();
  await pickOption(page, 'gpr-process-G3', 'Softener Washing');
  await page.getByRole('button', { name: /Copy from previous Seq/ }).click();
  await chip(page, 'Colours', 'Navy').click();
  await page.locator('input[name="gpr-G3-Navy-5-6Y"]').fill('450');
  await expect(lineTotal(page)).toContainText('6,850');
  await expect(page.getByText('of 7,000 order qty in selection')).toBeVisible();
  await expect(page.getByText('Enzyme Washing → Bleach Washing → Softener Washing').first()).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the process lines are now available/)).toBeVisible();
  await expect(page).toHaveURL(/\/bom\/garment-process\/\d+$/);
  await expect(page.getByRole('heading', { name: /GPR-\d{4}-\d{5}/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
});

test('A process already on another line cannot be picked again', async ({ page }) => {
  await startNew(page);
  await pickOption(page, 'gpr-process-G1', 'Enzyme Washing');
  await page.getByRole('button', { name: 'Add process' }).click();
  const dropdown = await openSelect(page, 'gpr-process-G2');
  await page.keyboard.type('Enzyme');
  const option = dropdown.locator('.ant-select-item-option').filter({ hasText: 'Enzyme Washing (already added)' });
  await expect(option).toBeVisible();
  await expect(option).toHaveClass(/ant-select-item-option-disabled/);
});

test('Above order qty turns amber and needs a reason to submit', async ({ page }) => {
  await startNew(page);
  await pickOption(page, 'gpr-process-G1', 'Stone Washing');
  await page.locator('input[name="gpr-G1-Black-3-4Y"]').fill('950'); // order qty 900
  await expect(page.getByText('1 cell(s) above the order quantity')).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Seq 1: enter a reason for Black 3-4Y/).first()).toBeVisible();

  await page.getByRole('textbox', { name: /Reason for Black 3-4Y above order quantity/ }).fill('Extra for shade band');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the process lines are now available/)).toBeVisible();
});
