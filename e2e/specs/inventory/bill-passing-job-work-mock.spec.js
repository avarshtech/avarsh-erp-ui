/**
 * Job-work bill passing — Stage 1 mock (owner, 2026-10-07): the Cut Panel PO / Garment Process PO vendor bills
 * run on browser demo data while the product team reviews the screens. Every case resets the demo first, so it
 * never depends on an earlier run. At the API cutover this spec moves to API fixtures (e2e/helpers/job-work-api.js).
 *
 * What it proves: one list over both kinds of bill, New Bill offering only final POs (D3), the workspace from
 * proposal to the Vendor Debit Note (D4, D5), a DC without its check holding the bill (D2) and the
 * duplicate-invoice override (D9) — with no console error on the way.
 */
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

const ENVIRONMENTAL = /ServiceWorker|service worker|unsupported MIME type|favicon|ResizeObserver|Failed to load resource/i;

function watchConsole(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { if (!ENVIRONMENTAL.test(String(e))) errors.push(String(e)); });
  return errors;
}

async function pickOption(page, selectLocator, optionText) {
  await selectLocator.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option').filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await page.waitForTimeout(250);
}

/** The list on one source, with the demo back at its seed and every status shown. */
async function openSource(page, label) {
  await navigateWithAuth(page, '/inventory/bill-passing');
  await waitForPageReady(page);
  await page.locator('.ant-segmented').first().getByText(label, { exact: true }).click();
  await page.getByRole('button', { name: /Reset demo data/ }).click();
  await expect(page.getByText('Job-work demo data reset')).toBeVisible();
  await page.locator('.ant-segmented').filter({ hasText: 'Pending' }).getByText('All', { exact: true }).click();
  await page.waitForTimeout(600);
}

/** New Bill on the current segment: vendor and PO, then the workspace. */
async function newBill(page, vendor, poNumber) {
  await page.getByRole('button', { name: /New Bill Passing/i }).click();
  const dialog = page.getByRole('dialog', { name: /New Bill Passing/i });
  await expect(dialog).toBeVisible();
  await pickOption(page, dialog.locator('.ant-select').first(), vendor);
  await pickOption(page, dialog.locator('.ant-select').nth(1), poNumber);
  await dialog.getByRole('button', { name: /Create Draft Bill/i }).click();
  await page.waitForURL(/\/inventory\/bill-passing\/job-work\/\d+/, { timeout: 30000 });
  await waitForPageReady(page);
}

const confirmModal = async (page, okText) => {
  await page.locator('.ant-modal-confirm').getByRole('button', { name: okText }).click();
  await page.waitForTimeout(700);
};

test.describe('Job-work bill passing (demo)', () => {
  test('the list shows the demo bills, marked as demo', async ({ page }) => {
    const errors = watchConsole(page);
    await openSource(page, 'Cut Panel PO');
    await expect(page.getByText('Job-work bills: demo data')).toBeVisible();
    const row = page.locator('.ant-table-row').filter({ hasText: 'JWB/26-27/1001' });
    await expect(row).toContainText('Demo');
    await expect(row).toContainText('Approved');
    // The supplier line register is not offered for job-work bills.
    await expect(page.getByText('Lines', { exact: true })).toHaveCount(0);
    expect(errors, 'no console errors').toEqual([]);
  });

  test('New Bill offers only completed or short-closed POs that carry no bill', async ({ page }) => {
    await openSource(page, 'Garment Process PO');
    await page.getByRole('button', { name: /New Bill Passing/i }).click();
    const dialog = page.getByRole('dialog', { name: /New Bill Passing/i });
    await expect(dialog.locator('.ant-radio-button-wrapper-checked')).toHaveText('Garment Process PO');
    await dialog.locator('.ant-select').first().click();
    const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await expect(options.filter({ hasText: 'Sri Murugan Screen Prints' })).toHaveCount(1);
    // Kavya's GPPO 1010 is partially completed and 1005 already has a bill: nothing of hers is offered.
    await expect(options.filter({ hasText: 'Kavya' })).toHaveCount(0);
  });

  test('a Cut Panel PO bill from proposal to its Vendor Debit Note', async ({ page }) => {
    test.setTimeout(180000);
    const errors = watchConsole(page);
    await openSource(page, 'Cut Panel PO');
    await newBill(page, 'Sri Murugan Screen Prints', 'CPPO/26-27/1004');
    await expect(page.getByText('Demo data').first()).toBeVisible();

    await page.locator('#jwbInvoiceNo').fill(`SMP/INV/${Date.now().toString().slice(-5)}`);
    await page.getByRole('button', { name: /Propose deductions/ }).click();
    await expect(page.getByText('Deductions proposed')).toBeVisible();

    // Key the recovery rate on each material-damage proposal, then confirm every deduction.
    const deductions = page.locator('.ant-table-row').filter({ hasText: /Material damage recovery|Rejected \/ short qty billed/ });
    await expect(deductions).toHaveCount(4);
    for (let i = 0; i < 2; i += 1) {
      const row = page.locator('.ant-table-row').filter({ hasText: 'Material damage recovery' }).filter({ hasText: 'Key the rate' }).first();
      await row.locator('button').filter({ has: page.locator('.anticon-edit') }).click();
      const editor = page.getByRole('dialog', { name: /Edit deduction/ });
      await editor.getByLabel(/Recovery rate/).fill('92.4');
      await editor.getByRole('button', { name: /Save deduction/ }).click();
      await expect(editor).toBeHidden();
    }
    while (await page.locator('.ant-table-row button').filter({ has: page.locator('.anticon-check-circle') }).count()) {
      await page.locator('.ant-table-row button').filter({ has: page.locator('.anticon-check-circle') }).first().click();
      await page.waitForTimeout(700);
    }
    await expect(page.getByText(/blocker/)).toHaveCount(0);

    await page.getByRole('button', { name: /^send Submit$/ }).click();
    await confirmModal(page, 'Save & Submit');
    await expect(page.getByText('Submitted').first()).toBeVisible();
    await page.getByRole('button', { name: /Start Verification/ }).click();
    await confirmModal(page, 'Start');
    await page.getByRole('button', { name: /Send for Approval/ }).click();
    await expect(page.getByText('Pending Approval').first()).toBeVisible();
    await page.getByRole('button', { name: /^check-circle Approve$/ }).click();
    await confirmModal(page, 'Approve');
    await expect(page.getByText('Approved').first()).toBeVisible();
    await expect(page.getByText(/VDN\/\d{2}-\d{2}\/\d+/).first()).toBeVisible();

    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Print Debit Note/ }).click();
    const print = await popup;
    await expect(print.getByText('Debit Note · Job Work')).toBeVisible();
    await print.close();
    expect(errors, 'no console errors').toEqual([]);
  });

  test('an unchecked DC holds the bill, and a duplicate invoice asks for an override', async ({ page }) => {
    const errors = watchConsole(page);
    await openSource(page, 'Garment Process PO');
    await newBill(page, 'Sri Murugan Screen Prints', 'GPPO/26-27/1009');
    await expect(page.getByText('Check pending on vendor DCs').first()).toBeVisible();
    await expect(page.getByText('Not checked')).toBeVisible();

    // SMP/INV/1187 is already on the approved demo bill of the same vendor this financial year.
    await page.locator('#jwbInvoiceNo').fill('SMP/INV/1187');
    await page.getByRole('button', { name: /^save Save$/ }).click();
    const override = page.getByRole('dialog', { name: /Override the duplicate invoice check/ });
    await expect(override).toBeVisible();
    await override.locator('textarea').fill('One invoice covers two POs, agreed with accounts');
    await override.getByRole('button', { name: /Override and save/ }).click();
    await expect(page.getByText('The duplicate invoice check was overridden on this bill')).toBeVisible();
    // The demo facade toasts the refusal the way the API's interceptor does; that toast is not a console error.
    expect(errors, 'no console errors').toEqual([]);
  });
});
