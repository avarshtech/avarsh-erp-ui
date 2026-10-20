/**
 * The customs gate, from the screens.
 *
 * Next PLC ships to the UK and the seeded organisation is in India, so every
 * parcel to them is an export: Mark as Dispatched must refuse until an issued
 * COMMERCIAL invoice covers every sample request on the dispatch. The refusal
 * has to arrive as the INVOICE_REQUIRED modal naming the uncovered request —
 * not as a generic toast, which is what the module did before the interceptor
 * learned that error code.
 *
 * The request is walked to In Production through the API: raising and issuing
 * are covered end to end by 02, and repeating them here would only make this
 * spec slower without testing the gate any harder.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive } from '../../helpers/navigation.js';
import {
  SEED_BUYER, goTo, settle, pickOption, selectFor, inputFor, confirmModal,
  expectToast, button, raiseSr, submitSr, issueFabric, SAMPLE_TYPE,
} from './helpers.js';

let api;
const state = { srNo: null, dispatchNo: null, invoiceNo: null };

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests — the overseas dispatch needs an invoice', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    const sr = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.FIT });
    await submitSr(api, sr);
    await issueFabric(api, sr.id);
    state.srNo = sr.srNo;
  });

  test.afterAll(async () => { await api?.dispose(); });

  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('Mark as Dispatched is refused with the INVOICE_REQUIRED modal naming the SR', async ({ page }) => {
    await goTo(page, '/sample-requests/dispatches/new');

    await pickOption(page, page.locator('.ant-select').first(), SEED_BUYER);
    await settle(page, 900);

    const srRow = page.locator('.ant-table-row', { hasText: state.srNo }).first();
    await expect(srRow, 'the In-Production request must be offered for dispatch').toBeVisible({ timeout: 20000 });
    await srRow.locator('.ant-checkbox-input').first().check();

    // The screen tells the user the gate exists before they hit it.
    await expect(page.getByText(/Overseas consignee/i).first()).toBeVisible();

    await pickOption(page, selectFor(page, 'Courier / Carrier'), 'DHL Express');
    await inputFor(page, 'Tracking Number').fill('AWB-E2E-GATE-1');
    await pickOption(page, selectFor(page, 'Dispatch Mode'), 'Air');

    await button(page, /^Mark as Dispatched$/).click();
    await confirmModal(page, /^Mark as Dispatched$/);

    const refusal = page.locator('.ant-modal-wrap:visible').filter({ hasText: 'Commercial invoice required' }).last();
    await expect(refusal).toBeVisible({ timeout: 25000 });
    await expect(refusal, 'the refusal must name the uncovered request').toContainText(state.srNo);
    await button(refusal, /^OK$/).click();
    await settle(page, 500);

    // The draft is saved even though the gate refused — that is what the
    // invoice is raised against next.
    const dispatch = await api.get('/sample-dispatches?status=DRAFT');
    const draft = (dispatch.data.content || []).find((d) => (d.srs || []).some((s) => s.srNo === state.srNo));
    expect(draft, 'the refused attempt must still have persisted the draft').toBeTruthy();
    state.dispatchNo = draft.dispatchNo;
    state.dispatchId = draft.id;
  });

  test('a commercial invoice is issued for the dispatch', async ({ page }) => {
    await goTo(page, `/sample-requests/dispatches/edit/${state.dispatchId}`);

    await button(page, /^Generate Commercial Invoice$/).click();
    await settle(page, 2000);

    // The deep link pre-ticks every uncovered SR and builds its line; only the
    // declared value is a human judgement, so only the rate is left to enter.
    await expect(page.getByText(/Styles preselected from/i).first()).toBeVisible({ timeout: 25000 });
    await page.getByText('Lines & Valuation').first().click();
    await settle(page, 700);

    const lineRow = page.locator('.ant-table-row', { hasText: state.srNo }).first();
    await expect(lineRow).toBeVisible({ timeout: 15000 });
    await lineRow.locator('input').last().fill('14');
    await settle(page, 500);

    await button(page, /^Issue Invoice$/).click();
    await confirmModal(page, /^Issue Invoice$/);
    await expectToast(page, /issued/i);

    await settle(page, 1500);
    const invoices = await api.get('/sample-invoices');
    const issued = (invoices.data.content || []).find((i) => i.status === 'ISSUED');
    expect(issued, 'an ISSUED commercial invoice must exist').toBeTruthy();
    state.invoiceNo = issued.invoiceNo;
    expect(state.invoiceNo, 'the number comes from the organisation profile series').toMatch(/^EXSG\//);
  });

  test('the dispatch now ships, and the invoice follows it to Dispatched', async ({ page }) => {
    await goTo(page, '/sample-requests/dispatches/list');

    const row = page.locator('.ant-table-row', { hasText: state.dispatchNo }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    // Actions are view / edit / mark-dispatched / delete — the send icon is third.
    await row.locator('td').last().locator('button').nth(2).click();
    await confirmModal(page, /^Mark as Dispatched$/);
    await expectToast(page, /dispatched/i);

    await settle(page, 1500);
    await expect(page.locator('.ant-table-row', { hasText: state.dispatchNo }).first())
      .toContainText('Dispatched');

    // An issued commercial invoice whose requests have all shipped follows them.
    await goTo(page, '/sample-requests/invoices/list');
    await expect(page.locator('.ant-table-row', { hasText: state.invoiceNo }).first())
      .toContainText('Dispatched', { timeout: 20000 });
  });
});
