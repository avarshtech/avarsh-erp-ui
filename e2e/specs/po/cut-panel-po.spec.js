/**
 * Purchase Orders — Cut Panel PO (UI mock phase)
 *
 * The PO documents, their allocation ledger and the Cut Panel Requirements are the
 * localStorage mock (services/po/jobWork, services/bom); every test gets a fresh browser
 * context, so the stores start from their seed. Job workers are the REAL Supplier master:
 * beforeAll creates the seeded ones (e2e/helpers/job-work-seed.js), matched by GSTIN.
 *
 * What this tests:
 *   - PRD §13.4 end to end on CPR-2026-00005 Panel Printing: 10 lines / 3,160 pcs, the last
 *     PO rates copied for 2Y/4Y and 8 / 8.5 bulk-filled for 6Y/8Y → 24,855.00, CGST 621.38,
 *     SGST 621.37, 26,097.75, rounded 26,098; save → CPP-2026-00035; submit; approve
 *     (superuser, logged as self-approved) → the CPR allocation shows 3,960 PO'd, balance 0
 *   - Ineligible job workers stay listed, greyed, with the reason (BR-14)
 *   - Approve the seeded submitted CPP-2026-00033, then edit it while Approved, not sent (BR-16)
 *   - Two POs on one balance: the second approval stops and names the balance (EC-10)
 *   - The seeded override request on CPP-2026-00034 is authorised by someone other than
 *     its requester and adds an approval level
 *   - Amend a sent PO: the open amendment's diff is on screen for its approver; approval
 *     releases R0 and allocates R1 (CPR-2026-00005 Panel Printing 800 → 780 PO'd)
 *   - Close short releases the unreceived quantity (AC-17)
 *   - The vendor copy carries no internal quantities
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureJobWorkers } from '../../helpers/job-work-seed.js';

const BASE = '/purchase-orders/cut-panel-po';

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')}-${mon}-${d.getFullYear()}`;
};

const openDropdown = async (page, input) => {
  // Centred first: the sticky action bar would cover a control at the bottom edge.
  const select = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
};

async function pickOption(page, input, text) {
  const dropdown = await openDropdown(page, input);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await dropdown.waitFor({ state: 'hidden' }).catch(() => {});
}

const selectOf = (page, id) => page.locator(`#${id}`);

async function setDate(page, id, text) {
  const input = page.locator(`#${id}`);
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

async function fillRate(page, mode, target, rate, count) {
  await pickOption(page, page.getByRole('combobox', { name: 'Fill rate for' }), mode);
  if (target) await pickOption(page, page.getByRole('combobox', { name: mode.includes('size') ? 'Size' : 'Colour', exact: true }), target);
  await page.getByRole('spinbutton', { name: 'Rate to fill' }).fill(String(rate));
  const apply = page.getByRole('button', { name: `Apply to ${count}` });
  await apply.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await apply.click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Apply' }).click();
}

async function reason(page, { code, remark }) {
  const dialog = page.getByRole('dialog');
  if (code) await pickOption(page, dialog.getByRole('combobox', { name: 'Reason' }), code);
  await dialog.getByRole('textbox', { name: 'Remark' }).fill(remark);
  await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
  await expect(dialog).toBeHidden();
}

const valueRow = (page, label) => page.locator('#cpp-delivery div').filter({ hasText: new RegExp(`^${label}`) }).last();

async function openAllocation(page, cprId) {
  await navigateWithAuth(page, `/bom/cut-panel/${cprId}`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'PO allocation' }).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Purchase orders')).toBeVisible();
  return drawer;
}

/** A draft on the chosen CPR / process with every line at its balance and one rate. */
async function draftOnBalance(page, { process, cprNo, vendor, rate, count }) {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await pickOption(page, selectOf(page, 'cpp-process'), process);
  await page.getByRole('checkbox', { name: `Select ${cprNo}` }).check();
  await page.getByRole('button', { name: 'Add to Grid' }).click();
  await pickOption(page, selectOf(page, 'cpp-vendor-select'), vendor);
  await setDate(page, 'cpp-requiredDeliveryDate', plusDays(20));
  await setDate(page, 'cpp-expectedCompletionDate', plusDays(18));
  await fillRate(page, 'All lines', null, rate, count);
}

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try { await ensureJobWorkers(api); } finally { await api.dispose(); }
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('List opens on the open POs, with the overdue flag in place of the status', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/list`);
  await expect(page.locator('.ant-table-row')).toHaveCount(4);
  await expect(page.locator('.ant-table-row').filter({ hasText: 'CPP-2026-00032' })).toContainText('Overdue');
  await expect(page.locator('.ant-table-row').filter({ hasText: 'CPP-2026-00033' })).toContainText('Submitted');
  const menu = page.locator('.ant-layout-sider');
  await expect(menu.locator('.ant-menu-item-selected')).toContainText('Cut Panel PO');
});

test('§13.4 worked example: fetch, copy and bulk-fill rates, value, save, submit, approve', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);

  await pickOption(page, selectOf(page, 'cpp-process'), 'Panel Printing');
  await page.getByRole('checkbox', { name: 'Select CPR-2026-00005' }).check();
  await page.getByRole('button', { name: 'Add to Grid' }).click();
  await expect(page.getByText('12 line(s) added')).toBeVisible();
  // Navy 2Y / 4Y went on CPP-2026-00031: fetched greyed at 0, dropped on save.
  await expect(page.getByRole('spinbutton', { name: 'PO qty Navy 2Y' })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'PO qty Navy 6Y' })).toHaveValue('440.00');

  await pickOption(page, selectOf(page, 'cpp-vendor-select'), 'Sri Murugan Prints');
  await expect(page.locator('#cpp-vendor')).toContainText('33AAFCS1234K1Z2');
  await expect(selectOf(page, 'cpp-paymentTerms').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]')).toContainText('Open Account 30 Days');
  await setDate(page, 'cpp-requiredDeliveryDate', plusDays(20));
  await setDate(page, 'cpp-expectedCompletionDate', plusDays(18));

  await page.getByRole('button', { name: 'Copy last PO rates' }).click(); // 2Y ₹7.00, 4Y ₹7.50 from CPP-2026-00031
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Rate White 4Y' })).toHaveValue('7.50');
  await fillRate(page, 'All colours of a size', '6Y', 8, 3);
  await fillRate(page, 'All colours of a size', '8Y', 8.5, 3);

  await expect(valueRow(page, 'Basic amount')).toContainText('₹24,855.00');
  await expect(valueRow(page, 'CGST')).toContainText('₹621.38');
  await expect(valueRow(page, 'SGST')).toContainText('₹621.37');
  await expect(valueRow(page, 'PO value')).toContainText('₹26,097.75');
  await expect(valueRow(page, 'Rounded')).toContainText('₹26,098.00');

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/\\d+$`));
  await expect(page.getByRole('heading', { name: /CPP-2026-00035/ })).toBeVisible();
  await expect(page.getByText('Lines 10')).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/self-approved \(superuser\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible();

  const drawer = await openAllocation(page, 5);
  const printing = drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first();
  await expect(printing).toContainText('3,960');
  await expect(printing).toContainText('Fully allocated');
  await expect(drawer.getByRole('link', { name: 'CPP-2026-00035' })).toBeVisible();
});

test('Ineligible job workers stay listed, greyed, with the reason', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await pickOption(page, selectOf(page, 'cpp-process'), 'Panel Printing');
  const input = selectOf(page, 'cpp-vendor-select');
  const dropdown = await openDropdown(page, input);
  // The list is virtual: search each vendor so its option is rendered.
  const expectOption = async (name, reason, disabled = true) => {
    await input.fill(name.split(' ')[0]);
    const option = dropdown.locator('.ant-select-item-option').filter({ hasText: name });
    await expect(option).toContainText(reason);
    await expect(option).toHaveClass(disabled ? /option-disabled/ : /^((?!option-disabled).)*$/);
  };
  await expectOption('Sri Murugan Prints', 'Approved to', false);
  await expectOption('Star Heat Transfers', 'Approval expired');
  await expectOption('Nova Prints', 'Job-work approval missing');
  await expectOption('Classic Embroidery Works', 'Does not do Panel Printing');
  await expectOption('Old Town Dyers', 'Inactive');
});

test('Approve the seeded submitted PO, then change its terms before it is sent', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/3`);
  await waitForPageReady(page);
  await expect(page.getByText('Balance after 0')).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible();
  await expect(page.getByText('Balance after 0')).toBeVisible(); // its own allocation is not counted against it

  await setDate(page, 'cpp-requiredDeliveryDate', plusDays(25));
  // Unsaved changes block the workflow: sending now would send the stored terms.
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeEnabled();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText(`Required delivery:`);
  await expect(page.locator('.ant-drawer-open')).toContainText(plusDays(25));

  const drawer = await openAllocation(page, 3);
  await expect(drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first()).toContainText('Fully allocated');
});

test('Two POs on one balance: the second approval stops and shows the new balance', async ({ page }) => {
  await draftOnBalance(page, { process: 'Panel Printing', cprNo: 'CPR-2026-00003', vendor: 'Sri Murugan Prints', rate: 6.5, count: 4 });
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  const url = page.url();

  await navigateWithAuth(page, `${BASE}/3`); // CPP-2026-00033 takes the same 3,091 first
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible();

  await page.goto(url);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Navy .*another PO has taken it since submission/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible(); // still Submitted
});

test('An override request is authorised by someone else and adds an approval level', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/4`);
  await waitForPageReady(page);
  await expect(page.getByText('Exceeds balance by 6')).toBeVisible();
  await expect(page.getByText('Awaiting authoriser')).toBeVisible();
  await page.getByRole('button', { name: 'Authorise' }).click();
  await expect(page.getByText(/Authorised by/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  const approval = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: /^Approval$/ }) });
  await expect(approval.locator('.ant-steps')).toContainText('Merchandising Head');
  await expect(approval.locator('.ant-steps')).toContainText('Additional level (override)');
});

test('Amend a sent PO: the approver sees the diff; approval re-allocates the requirement', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/1`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Amend' }).click();
  await reason(page, { remark: 'Buyer reduced Navy 4Y by 20.' });
  await expect(page.getByText(/Amendment R1 being drafted/)).toBeVisible();
  await page.getByRole('spinbutton', { name: 'PO qty Navy 4Y' }).fill('400');
  await expect(page.locator('#cpp-amendments')).toContainText('Navy 4Y — PO qty');
  await page.getByRole('button', { name: 'Submit amendment R1' }).click();
  await expect(page.getByText('Amendment submitted for approval')).toBeVisible();
  await expect(page.locator('#cpp-amendments')).toContainText('awaiting approval');
  await expect(page.getByRole('spinbutton', { name: 'PO qty Navy 4Y' })).toHaveValue('400.00'); // R1 on screen, read-only
  await page.getByRole('button', { name: 'Approve amendment R1' }).click();
  await expect(page.getByText('Amendment approved')).toBeVisible();
  await expect(page.locator('#cpp-amendments')).toContainText('R1 — Buyer reduced Navy 4Y by 20.');

  const drawer = await openAllocation(page, 5);
  const printing = drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first();
  await expect(printing).toContainText('780');
  await expect(printing).toContainText('3,180');
});

test('Close short releases the unreceived quantity to the requirement', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/2`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Close short' }).click();
  await reason(page, { code: 'Vendor cannot complete', remark: 'Vendor capacity lost; balance to be re-issued.' });
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  const drawer = await openAllocation(page, 3);
  const printing = drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first();
  await expect(printing).toContainText('Partially allocated');
});

test('The vendor copy carries no internal quantities', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/1`);
  await waitForPageReady(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Print vendor copy' }).click(),
  ]);
  await popup.waitForLoadState();
  const html = await popup.content();
  expect(html).toContain('CPP-2026-00031');
  expect(html).toContain('Sri Murugan Prints');
  expect(html).not.toMatch(/Previously|Balance|Required qty/i);
  await popup.close();
});
