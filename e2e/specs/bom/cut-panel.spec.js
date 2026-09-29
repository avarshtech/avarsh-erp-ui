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
 *   - A submitted CPR opens read-only with Edit and Close; colours without a process read
 *     "No cut-panel process"
 *   - Create: Colours x Panels x Processes expansion, PRD quantities (4Y 220 @2% → 225,
 *     @3% → 227), duplicate skipping, reason required for a variance, Save → number,
 *     Submit (WRN-03 confirm) → Submitted
 *   - One strip, several panels and fabrics: the panel clears after each add, a notice
 *     says what to do next and "Fabrics & panels added" lists them
 *   - Edit in place while no PO is placed (stays Submitted, audited as a revision); a CPR
 *     with placed POs has no Edit; Close needs a reason
 *   - The list's Edit opens a submitted CPR in edit mode; Cancel edit discards the change
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

/** The action bar's Edit ("edit Edit" with its icon) — never "Cancel edit" or a list row's "Edit CPR-…". */
const editButton = (page) => page.getByRole('button', { name: /(^|\s)Edit$/ });

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

test('A submitted requirement opens read-only with Edit and Close, and reports colours without a process', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/1');
  await waitForPageReady(page);
  await expect(page.getByRole('heading', { name: /CPR-2026-00001/ })).toBeVisible();
  await expect(page.getByText('No cut-panel process')).toHaveCount(2); // White and Navy
  await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
  await expect(editButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
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
  await expect(page.getByText(/3 lines added for Single Jersey › Front Panel\. Pick another panel/)).toBeVisible();
  await expect(lineRow(page, 'Panel Printing').locator('input[name$="-4Y"]')).toHaveValue('225');

  // Same selection again (the panel clears after an add, so pick it back): nothing duplicated (PRD §8.2.3)
  await pickOption(page, 'cpr-panels', 'Front Panel');
  await page.keyboard.press('Escape');
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
  await expect(editButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Draft' })).toHaveCount(0);
});

test('Edit a submitted CPR in place; Close needs a reason', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/1');
  await waitForPageReady(page);
  await editButton(page).click();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/1\?edit=1$/);
  const saveChanges = page.getByRole('button', { name: 'Save changes' });
  await expect(saveChanges).toBeDisabled(); // nothing changed yet

  const printing = lineRow(page, 'Panel Printing'); // Black Front Panel, 4Y 225
  await printing.locator('input[name$="-4Y"]').fill('230');
  await printing.locator('input[name$="-4Y"]').press('Tab');
  await printing.locator('input[name^="reason-"]').fill('Buyer asked for 5 spare fronts');
  await saveChanges.click();
  const confirm = page.locator('.ant-modal-confirm').last(); // WRN-03: White and Navy still have no process
  await confirm.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved — the requirement stays submitted')).toBeVisible();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/1$/);
  await expect(editButton(page)).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText('revised the requirement (R1)');
  await expect(page.locator('.ant-drawer-open')).toContainText('4Y: 225 → 230');
  await page.keyboard.press('Escape');

  // CPR-2026-00003 has POs placed against it: no Edit, Close with a mandatory reason
  await navigateWithAuth(page, '/bom/cut-panel/3');
  await waitForPageReady(page);
  await expect(editButton(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  const dialog = page.locator('.ant-modal').last();
  await expect(dialog.getByRole('button', { name: 'Close Requirement' })).toBeDisabled();
  await dialog.locator('textarea').fill('Order short-shipped, balance not needed');
  await dialog.getByRole('button', { name: 'Close Requirement' }).click();
  await expect(page.getByText('Requirement closed')).toBeVisible();
  await expect(page.locator('.ant-alert-description').filter({ hasText: 'Order short-shipped, balance not needed' })).toBeVisible();
});

test('The list Edit opens a submitted requirement in edit mode; Cancel edit discards the change', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  await expect(page.getByRole('button', { name: 'View CPR-2026-00003' })).toBeVisible(); // POs placed: view only
  await page.getByRole('button', { name: 'Edit CPR-2026-00001' }).click();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/1\?edit=1$/);
  await waitForPageReady(page);

  const cell = lineRow(page, 'Panel Printing').locator('input[name$="-4Y"]');
  await cell.fill('231');
  await cell.press('Tab');
  await page.getByRole('button', { name: 'Cancel edit' }).click();
  await page.locator('.ant-modal-confirm').last().getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/bom\/cut-panel\/1$/);
  await expect(editButton(page)).toBeVisible();
  await expect(lineRow(page, 'Panel Printing')).toContainText('225');
  await expect(lineRow(page, 'Panel Printing')).not.toContainText('231');
});

test('Another panel and another fabric from one strip', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/new');
  await waitForPageReady(page);
  await pickOption(page, 'cpr-order', 'ORD-2026-00110'); // BOM V1: Single Jersey + 1x1 Rib
  await pickOption(page, 'cpr-fabric', 'Single Jersey');
  await pickOption(page, 'cpr-colours', 'Navy');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-panels', 'Front Panel');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-processes', 'Panel Printing');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText(/1 line added for Single Jersey › Front Panel\. Pick another panel/)).toBeVisible();

  // The panel cleared; fabric, colour and process stayed: the back panel is one pick away
  await pickOption(page, 'cpr-panels', 'Back Panel');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText(/1 line added for Single Jersey › Back Panel/)).toBeVisible();

  // Another fabric from the same strip: the rib collar
  await pickOption(page, 'cpr-fabric', '1x1 Rib');
  await pickOption(page, 'cpr-colours', 'Navy');
  await page.keyboard.press('Escape');
  await pickOption(page, 'cpr-panels', 'Collar');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Add to Grid/ }).click();
  await expect(page.getByText(/1 line added for 1x1 Rib › Collar/)).toBeVisible();

  const summary = page.getByRole('group', { name: 'Fabrics and panels added' });
  await expect(summary).toContainText('Single Jersey');
  await expect(summary).toContainText('Front Panel · 1 line');
  await expect(summary).toContainText('Back Panel · 1 line');
  await expect(summary).toContainText('1x1 Rib');
  await expect(summary).toContainText('Collar · 1 line');
});
