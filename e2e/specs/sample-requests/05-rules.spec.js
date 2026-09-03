/**
 * The rules the module is supposed to hold, screen by screen.
 *
 * These are the assertions that would have passed just as happily against the
 * localStorage mock and mean something different now: a record survives a
 * reload because the server has it, a submitted request stops being editable
 * because the server refuses, an issued invoice cannot be cancelled without a
 * reason, and the two masters the cutover introduced — Couriers and the Company
 * Profile — actually round-trip.
 *
 * The first test is the demolition's own receipt: the mock's localStorage key
 * must be cleared on load and never come back.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import {
  goTo, settle, inputFor, expectToast, button, tableRows,
  raiseSr, submitSr, issueFabric, createDispatch, issueCommercialInvoice, SAMPLE_TYPE,
} from './helpers.js';

const MOCK_STORE_KEY = 'avarsh.sr.mockStore.v1';

let api;

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests — the rules hold', () => {
  test.beforeAll(async () => { api = await createAuthenticatedClient(); });
  test.afterAll(async () => { await api?.dispose(); });

  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('the mock store is cleared on load and the list survives a reload from the server', async ({ page }) => {
    const sr = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.PROTO });

    await goTo(page, '/sample-requests/list');
    // Plant the mock's old key the way a returning user's browser would hold it.
    await page.evaluate((key) => localStorage.setItem(key, '{"srs":[{"srNo":"STALE"}]}'), MOCK_STORE_KEY);

    await page.reload();
    await settle(page, 1500);

    expect(
      await page.evaluate((key) => localStorage.getItem(key), MOCK_STORE_KEY),
      'srApi clears the demolished mock store at module load',
    ).toBeNull();

    await page.getByPlaceholder('Search SR No or Order No...').fill(sr.srNo);
    await settle(page, 1200);
    const rows = await tableRows(page);
    expect(rows.join('\n'), 'the request comes back from the API, not from the browser')
      .toContain(sr.srNo);
  });

  test('a submitted request can no longer be edited or deleted', async ({ page }) => {
    const sr = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.PROTO });
    await submitSr(api, sr);

    // The edit route itself refuses, so a stale link cannot get round the panel.
    await goTo(page, `/sample-requests/edit/${sr.id}`);
    await expect(page.getByText('This Sample Request is no longer editable')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(new RegExp(`${sr.srNo} is SUBMITTED`))).toBeVisible();

    await goTo(page, '/sample-requests/list');
    await page.getByPlaceholder('Search SR No or Order No...').fill(sr.srNo);
    await settle(page, 1200);
    await page.locator('.ant-table-row', { hasText: sr.srNo }).first().click();

    const detail = page.locator('.ant-modal-wrap:visible').last();
    await expect(detail.locator('.ant-tag').first()).toContainText(/Submitted/i);
    // Substring match: a disabled action row prints its reason inside the button.
    await expect(button(detail, 'Edit Sample Request')).toBeDisabled();
    await expect(button(detail, 'Delete')).toBeDisabled();
  });

  test('cancelling an issued invoice is refused until a reason is given', async ({ page }) => {
    const sr = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.FIT });
    await submitSr(api, sr);
    await issueFabric(api, sr.id);
    const dispatch = await createDispatch(api, [sr.id]);
    const invoice = await issueCommercialInvoice(api, dispatch);

    await goTo(page, '/sample-requests/invoices/list');
    const row = page.locator('.ant-table-row', { hasText: invoice.invoiceNo }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    // view / print / duplicate / cancel — cancel is the last icon on an issued row.
    await row.locator('td').last().locator('button').last().click();

    const modal = page.locator('.ant-modal-wrap:visible').last();
    await expect(modal.getByText(`Cancel invoice ${invoice.invoiceNo}?`)).toBeVisible({ timeout: 15000 });
    await expect(
      button(modal, /^Cancel Invoice$/),
      'the reason is mandatory — confirm stays disabled while it is blank',
    ).toBeDisabled();

    await modal.locator('textarea').fill('Wrong declared value — cancelled and re-raised by the e2e suite');
    await button(modal, /^Cancel Invoice$/).click();
    await expectToast(page, /cancelled/i);

    await settle(page, 1500);
    await expect(page.locator('.ant-table-row', { hasText: invoice.invoiceNo }).first())
      .toContainText('Cancelled');
  });

  test('the Couriers master creates, renames and deletes a carrier', async ({ page }) => {
    const name = `E2E Carrier ${Date.now()}`;
    const renamed = `${name} (renamed)`;

    await goToMasterEntity(page, 'Couriers');
    await button(page, /^Add Courier$/).click();
    await inputFor(page, 'Courier Name').fill(name);
    await button(page, /^Save Changes$/).click();
    await expectToast(page, /Courier created/i);
    await settle(page, 1200);
    await expect(page.locator('.ant-table-row', { hasText: name }).first()).toBeVisible();

    await page.locator('.ant-table-row', { hasText: name }).first().click();
    await settle(page, 700);
    await inputFor(page, 'Courier Name').fill(renamed);
    await button(page, /^Save Changes$/).click();
    await expectToast(page, /Courier updated/i);
    await settle(page, 1200);
    await expect(page.locator('.ant-table-row', { hasText: renamed }).first()).toBeVisible();

    await page.locator('.ant-table-row', { hasText: renamed }).first().click();
    await settle(page, 700);
    await button(page, /^Delete$/).click();
    const confirm = page.locator('.ant-modal-wrap:visible').last();
    await button(confirm, /^Delete$/).click();
    await expectToast(page, /Courier deleted/i);
    await settle(page, 1200);
    await expect(page.locator('.ant-table-row', { hasText: renamed })).toHaveCount(0);
  });

  test('the Company Profile round-trips — and it is what decides who is overseas', async ({ page }) => {
    const signatory = `E2E Signatory ${Date.now()}`;

    await goTo(page, '/admin/company-profile');
    // The seeded organisation is in India, which is why the UK buyer in the
    // other specs reads as an export.
    await expect(inputFor(page, 'Country')).toHaveValue('India');
    await expect(inputFor(page, 'Commercial Invoice Series')).toHaveValue('EXSG');

    await inputFor(page, 'Authorised Signatory').fill(signatory);
    await button(page, /^Save Profile$/).click();
    await expectToast(page, /Company profile saved/i);

    await page.reload();
    await settle(page, 1500);
    await expect(inputFor(page, 'Authorised Signatory')).toHaveValue(signatory);
  });
});
