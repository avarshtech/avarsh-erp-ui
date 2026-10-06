/**
 * BOM — Garment Process Requirement, on the real API (/garment-process-requirements).
 *
 * The e2e seed's ORD/0003 has four colours (Heather Grey 1,200 · Forest Green 1,000 · Midnight Navy 1,500 ·
 * Cream 1,200 = 4,900) in S–XL; the process dropdown reads the Processes master (category 'Garment'). The
 * requirement edited from the list is made by beforeAll through the API; numbers are GPRQ/<FY>/NNNN.
 *
 * What this tests:
 *   - Build a two-step requirement: Seq 1 Garment Washing on every colour (4,900), Seq 2 Enzyme Washing without
 *     Cream (3,700), then Submit → the server's number, read-only
 *   - A process on another line is shown "(already added)" and cannot be picked twice
 *   - A cell above its order qty turns amber; Submit then needs a reason (superadmin holds "Submit above order qty")
 *   - The list's Edit opens a submitted GPR in place: the order stays fixed, Save changes keeps it Submitted and is audited
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { submittedGpr } from '../../helpers/job-work-api.js';

const selectRoot = (page, id) => page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');

async function openSelect(page, id) {
  // Centred first: opened near the bottom edge, the dropdown flips above its input once the page scrolls.
  const select = selectRoot(page, id);
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
}

async function pickOption(page, id, text) {
  const dropdown = await openSelect(page, id);
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await expect(selectRoot(page, id)).toContainText(text); // a missed pick fails here, not steps later
}

const chip = (page, text) => page.getByRole('group', { name: 'Colours' }).last().locator('.ant-tag').filter({ hasText: text });
const lineTotal = (page) => page.getByText(/Total process quantity/).last();
const cell = (page, line, colour, size) => page.locator(`input[name="gpr-${line}-${colour}-${size}"]`);

async function startNew(page) {
  await navigateWithAuth(page, '/bom/garment-process/new');
  await waitForPageReady(page);
  await pickOption(page, 'gpr-order', 'ORD/0003');
  await expect(page.getByText('Seq 1').first()).toBeVisible();
}

let listed;

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    listed = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Softener Washing' });
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Two process steps, the second without one colour, then submit', async ({ page }) => {
  await startNew(page);
  await pickOption(page, 'gpr-process-G1', 'Garment Washing');
  await expect(lineTotal(page)).toContainText('4,900');

  await page.getByRole('button', { name: 'Add process' }).click();
  await pickOption(page, 'gpr-process-G2', 'Enzyme Washing');
  await chip(page, 'Cream').click();
  await expect(lineTotal(page)).toContainText('3,700');
  await expect(page.getByText('Garment Washing → Enzyme Washing').first()).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the process lines are now available/)).toBeVisible();
  await expect(page).toHaveURL(/\/bom\/garment-process\/\d+$/);
  await expect(page.getByRole('heading', { name: /GPRQ\/\d{2}-\d{2}\/\d+/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
});

test('A process already on another line cannot be picked again', async ({ page }) => {
  await startNew(page);
  await pickOption(page, 'gpr-process-G1', 'Garment Washing');
  await page.getByRole('button', { name: 'Add process' }).click();
  const dropdown = await openSelect(page, 'gpr-process-G2');
  await page.keyboard.type('Garment Wash');
  const option = dropdown.locator('.ant-select-item-option').filter({ hasText: 'Garment Washing (already added)' });
  await expect(option).toBeVisible();
  await expect(option).toHaveClass(/ant-select-item-option-disabled/);
});

test('Above order qty turns amber and needs a reason to submit', async ({ page }) => {
  await startNew(page);
  await pickOption(page, 'gpr-process-G1', 'Stone Washing');
  await cell(page, 'G1', 'Heather Grey', 'S').fill('250'); // order qty 200
  await expect(page.getByText('1 cell(s) above the order quantity')).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Seq 1: enter a reason for Heather Grey S/).first()).toBeVisible();

  await page.getByRole('textbox', { name: /Reason for Heather Grey S above order quantity/ }).fill('Extra for shade band');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/Submitted — the process lines are now available/)).toBeVisible();
});

test('Edit a submitted GPR in place from the list', async ({ page }) => {
  await navigateWithAuth(page, '/bom/garment-process/list');
  await page.getByRole('button', { name: `Edit ${listed.requirementNo}` }).click();
  await expect(page).toHaveURL(new RegExp(`/bom/garment-process/${listed.id}\\?edit=1$`));
  await waitForPageReady(page);
  await expect(page.locator('#gpr-order')).toHaveCount(0); // the order stays fixed
  await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();

  await cell(page, 'G1', 'Heather Grey', 'S').fill('180'); // order qty 200
  await expect(lineTotal(page)).toContainText('4,880');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved — the requirement stays submitted')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/bom/garment-process/${listed.id}$`));
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText('revised the requirement (R1)');
  await page.keyboard.press('Escape');

  await navigateWithAuth(page, '/bom/garment-process/list');
  const row = page.locator('.ant-table-row').filter({ hasText: listed.requirementNo });
  await expect(row).toContainText('4,880');
  await expect(row).toContainText('Submitted');
});
