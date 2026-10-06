/**
 * Purchase Orders — Garment Process PO (UI mock phase)
 *
 * The PO documents, their allocation ledger and the Garment Process Requirements are the
 * localStorage mock; every test gets a fresh browser context, so the stores start from
 * their seed. Job workers are the REAL Vendor master (e2e/helpers/job-work-seed.js).
 *
 * What this tests:
 *   - Requirement lines come from section ②: Order #, then Garment Process #, then the
 *     colour × size cells with a select-all that stays within one process, then Add to PO
 *   - List opens on the open POs (GPO-2026-00002 sent, -00003 submitted)
 *   - GPR-2026-00001 Enzyme Washing, Black only (4,000): save → GPO-2026-00004; submit
 *     allocates (AC-10) → the GPR shows 4,000 PO'd, balance 3,000, Partially Used; recall
 *     releases it again
 *   - Reject (to Draft) of the seeded submitted GPO-2026-00003 releases its 138 pcs
 *   - GPR-2026-00001 + GPR-2026-00006 (both Enzyme Washing) in one PO, each line and card
 *     keeping its requirement number (AC-07); another process is not selectable
 *   - Excess: 4 over the balance blocks Submit; an approved excess allows it (AC-06)
 *   - A vendor that does no Garment process is greyed out; one that does not do the PO's own
 *     process (or is unapproved) warns, and the approver signs it off (§13)
 *   - ⑤ Delivery Instructions: the return unit from HR › Units (beforeAll creates two in the
 *     head office), its address as the delivery place
 *   - Amend delivery / instructions on a sent PO, audited (§16, AC-13); print shows no internal quantities
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureJobWorkers, ensureJobWorkUnits, JOB_WORK_UNITS } from '../../helpers/job-work-seed.js';

const BASE = '/purchase-orders/garment-process-po';

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
};

const openDropdown = async (page, input) => {
  const select = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
};

async function pickVendor(page, name) {
  const input = page.locator('#gpo-vendor-select');
  const dropdown = await openDropdown(page, input);
  await input.fill(name.split(' ')[0]);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: name }).first().click();
}

async function setDate(page, id, text) {
  const input = page.locator(`#${id}`);
  await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

async function reason(page, { code, remark }) {
  const dialog = page.getByRole('dialog');
  if (code) {
    const dropdown = await openDropdown(page, dialog.getByRole('combobox', { name: 'Reason' }));
    await dropdown.locator('.ant-select-item-option').filter({ hasText: code }).first().click();
  }
  await dialog.getByRole('textbox', { name: 'Remark' }).fill(remark);
  await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
  await expect(dialog).toBeHidden();
}

async function pickSelect(page, id, text) {
  const input = page.locator(`#${id}`);
  const dropdown = await openDropdown(page, input);
  await input.fill(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

/** Section ②: Order #, then Garment Process #, then the header select-all (one process), then Add to PO. */
async function addFromRequirement(page, { order, gpr }) {
  if (order) await pickSelect(page, 'gpo-order', order);
  await pickSelect(page, 'gpo-gpr', gpr);
  await page.locator('#gpo-selection').getByRole('checkbox', { name: 'Select all' }).check();
  await page.getByRole('button', { name: 'Add to PO' }).click();
}

/** The grid's bulk bar: one rate on the chosen lines ("All lines", "Selected lines", …). */
async function bulkRate(page, mode, rate, count) {
  const dropdown = await openDropdown(page, page.getByRole('combobox', { name: 'Fill rate for' }));
  await dropdown.locator('.ant-select-item-option').filter({ hasText: mode }).first().click();
  await page.getByRole('spinbutton', { name: 'Rate to fill' }).fill(String(rate));
  const apply = page.getByRole('button', { name: count ? `Apply to ${count}` : /^Apply to \d+$/ });
  await apply.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await apply.click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Apply' }).click();
}

const fillRates = (page, rate) => bulkRate(page, 'All lines', rate);

/** ⑤ Delivery Instructions: Return To stays Finishing; the return unit (its address is the delivery place) and the date. */
async function delivery(page) {
  await pickSelect(page, 'gpo-returnUnit', JOB_WORK_UNITS.fin.unitName);
  await expect(page.locator('#gpo-delivery')).toContainText('4 Dye House Street, Tiruppur, Tamil Nadu 641604');
  await setDate(page, 'gpo-expectedReturnDate', plusDays(12));
}

async function allocation(page, gprId, process) {
  await navigateWithAuth(page, `/bom/garment-process/${gprId}`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'PO allocation' }).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Purchase orders')).toBeVisible();
  return drawer.locator('.ant-table-row').filter({ hasText: process }).first();
}

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    await ensureJobWorkers(api);
    await ensureJobWorkUnits(api);
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000); // journeys across the PO and its requirements, on a mock with deliberate delays
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('List opens on the open POs', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/list`);
  await expect(page.locator('.ant-table-row')).toHaveCount(2);
  await expect(page.locator('.ant-table-row').filter({ hasText: 'GPO-2026-00003' })).toContainText('Submitted');
  await expect(page.locator('.ant-layout-sider .ant-menu-item-selected')).toContainText('Garment Process PO');
});

test('Submit allocates the requirement; recall releases it (AC-05, AC-10)', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-0418', gpr: 'GPR-2026-00001' }); // select-all takes Seq 1, Enzyme Washing
  await expect(page.getByText('8 line(s) added')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Select Black 3-4Y Bleach Washing' })).toBeDisabled(); // one process per PO
  for (const size of ['3-4Y', '5-6Y', '7-8Y', '9-10Y']) await page.getByRole('button', { name: `Remove GPR-2026-00001 Navy ${size}` }).click();
  await pickVendor(page, 'Bluewave Garment Washers');
  await fillRates(page, 18.5);
  await delivery(page);
  await expect(page.getByText('All lines within balance · ready to submit')).toBeVisible();
  await expect(page.locator('#gpo-requirements')).toContainText('4,000');

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: /GPO-2026-00004/ })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
  const url = page.url();

  let row = await allocation(page, 1, 'Enzyme Washing');
  await expect(row).toContainText('4,000');
  await expect(row).toContainText('3,000');

  await page.goto(url);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Recall' }).click();
  await expect(page.getByText(/Recalled to Draft/)).toBeVisible();
  row = await allocation(page, 1, 'Enzyme Washing');
  await expect(row).toContainText('7,000');
});

test('Reject to Draft releases the seeded submitted PO', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/7`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Reject to Draft' }).click();
  await reason(page, { remark: 'Rate above the agreed dyeing rate.' });
  await expect(page.getByText(/Rejected to Draft by/)).toBeVisible();
  const row = await allocation(page, 3, 'Garment Dyeing');
  await expect(row).toContainText('276'); // only GPO-2026-00002 still holds White 2Y / 4Y
});

test('Two requirements of one process share a PO; lines keep their requirement (AC-07)', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-0418', gpr: 'GPR-2026-00001' });
  await expect(page.getByText('8 line(s) added')).toBeVisible();
  await addFromRequirement(page, { gpr: 'GPR-2026-00006' }); // the same order, another requirement of the process
  await expect(page.getByText('4 line(s) added')).toBeVisible();
  const cards = page.locator('#gpo-requirements');
  await expect(cards).toContainText('GPR-2026-00001');
  await expect(cards).toContainText('GPR-2026-00006');
  await expect(page.locator('#gpo-lines .ant-table-row').filter({ hasText: 'GPR-2026-00006' })).toHaveCount(4);
  await expect(page.getByText('Total · 12 lines')).toBeVisible();
});

test('Bulk rate on selected lines keeps 4 decimals', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-0418', gpr: 'GPR-2026-00001' });
  await expect(page.getByText('8 line(s) added')).toBeVisible();
  for (const size of ['3-4Y', '5-6Y', '7-8Y']) await page.getByRole('checkbox', { name: `Select GPR-2026-00001 Black ${size}` }).check();
  await bulkRate(page, 'Selected lines', 12.3456, 3);
  for (const size of ['3-4Y', '5-6Y', '7-8Y']) await expect(page.getByRole('spinbutton', { name: `Rate Black ${size}` })).toHaveValue('12.3456');
  await expect(page.getByRole('spinbutton', { name: 'Rate Black 9-10Y' })).toHaveValue('');
  await expect(page.getByText('Total · 8 lines')).toBeVisible(); // the totals row still lines up with the selection column
});

test('A draft GPO re-fetches after its GPR is edited', async ({ page }) => {
  test.setTimeout(180000); // a journey across the PO and its requirement, twice
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-0418', gpr: 'GPR-2026-00006' }); // Enzyme Washing, White × 4
  await expect(page.getByText('4 line(s) added')).toBeVisible();
  await pickVendor(page, 'Bluewave Garment Washers');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: /GPO-\d{4}-\d{5}/ })).toBeVisible();
  const poUrl = page.url();

  // The draft does not block GPR-6: White 3-4Y 700 → 650
  await navigateWithAuth(page, '/bom/garment-process/6?edit=1');
  await waitForPageReady(page);
  await page.locator('input[name="gpr-G1-White-3-4Y"]').fill('650');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved — the requirement stays submitted')).toBeVisible();

  await navigateWithAuth(page, poUrl);
  await waitForPageReady(page);
  await expect(page.getByText('Requirement changed').first()).toBeVisible();
  await page.getByRole('button', { name: 'Re-fetch lines' }).click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Re-fetch' }).click();
  await expect(page.getByText('1 line(s) re-fetched at the new balance')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'PO qty White 3-4Y' })).toHaveValue('650.00');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Draft saved')).toBeVisible();

  // GPR-6's line becomes another process: the PO keeps one process, so re-fetch drops its lines
  await navigateWithAuth(page, '/bom/garment-process/6?edit=1');
  await waitForPageReady(page);
  await pickSelect(page, 'gpr-process-G1', 'Stone Washing');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved — the requirement stays submitted')).toBeVisible();
  await navigateWithAuth(page, poUrl);
  await waitForPageReady(page);
  await expect(page.getByText(/is now Stone Washing on GPR-2026-00006/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Re-fetch lines' }).click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Re-fetch' }).click();
  await expect(page.getByText('0 line(s) re-fetched at the new balance · 4 removed')).toBeVisible();
  await expect(page.getByText('Pick an order and a requirement above, then Add to PO.')).toBeVisible();
});

test('An excess over the balance blocks Submit until approved (AC-06)', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-00125', gpr: 'GPR-2026-00003' }); // 2Y-6Y are on other POs: only 8Y is left
  await expect(page.getByText('1 line(s) added')).toBeVisible();
  await pickVendor(page, 'Colourtex Dye House');
  await page.getByRole('spinbutton', { name: 'PO qty White 8Y' }).fill('142');
  await fillRates(page, 22);
  await delivery(page);
  await expect(page.getByText('Exceeds balance by 4 pcs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for Approval' })).toBeDisabled();
  await page.getByRole('button', { name: 'Request excess override' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('At most 3%');
  const dropdown = await openDropdown(page, dialog.getByRole('combobox', { name: 'Reason' }));
  await dropdown.locator('.ant-select-item-option').filter({ hasText: 'Process wastage' }).click();
  await dialog.getByRole('textbox', { name: 'Justification' }).fill('Dye-house shrinkage losses on white.');
  await dialog.getByRole('button', { name: 'Request override' }).click();
  await expect(page.getByText(/Excess requested/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Authorise' }).click(); // a superuser may approve their own request — logged
  await expect(page.getByText('Excess approved').first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
});

test("A vendor with no Garment process is greyed out; one short of the PO's process warns and the approver signs it off (§13)", async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, { order: 'ORD-2026-0418', gpr: 'GPR-2026-00006' });
  await expect(page.getByText('4 line(s) added')).toBeVisible(); // the lines fix the process the vendor list is graded for
  // Vendors also hold cutting and stitching units: one that does no Garment process cannot take the PO
  const input = page.locator('#gpo-vendor-select');
  const dropdown = await openDropdown(page, input);
  await input.fill('Nova');
  const nova = dropdown.locator('.ant-select-item-option').filter({ hasText: 'Nova Prints' });
  await expect(nova).toContainText('Does no Garment process');
  await expect(nova).toHaveClass(/option-disabled/);
  await input.press('Escape');
  await pickVendor(page, 'Colourtex Dye House'); // does Garment Dyeing, not Enzyme Washing
  await expect(page.locator('#gpo-header')).toContainText('Does not do Enzyme Washing');
  await fillRates(page, 17);
  await delivery(page);
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Sign off and approve' }).click();
  await expect(page.getByText(/vendor signed off/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible();
});

test('Amend delivery on a sent PO is audited; the print carries no internal quantities', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/6`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Amend delivery / instructions' }).click();
  const dialog = page.getByRole('dialog');
  await setDate(page, 'amend-expectedReturnDate', plusDays(20));
  await dialog.locator('#amend-reason').fill('Dye house asked for four more days.');
  await dialog.getByRole('button', { name: 'Save amendment' }).click();
  await expect(page.getByText('Delivery / instructions amended')).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText(`Expected delivery date:`);
  await expect(page.locator('.ant-drawer-open')).toContainText(plusDays(20));
  await page.keyboard.press('Escape');

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Print', exact: true }).click()]);
  await popup.waitForLoadState();
  const html = await popup.content();
  expect(html).toContain('GPO-2026-00002');
  expect(html).toContain('Grand total');
  expect(html).not.toMatch(/Previously|Balance|Required qty/i);
  await popup.close();
});
