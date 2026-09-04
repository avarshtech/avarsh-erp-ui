/**
 * Customer Comments closes the request.
 *
 * The buyer's decision is the end of the line for the request it is recorded
 * on: recording Approved moves the request from Dispatched through Feedback
 * Received to a terminal status in one transaction, and a terminal request is
 * read-only — nothing is created here, no further edit is offered. (A rejected
 * sample is re-made as a linked revision, raised from the closed request; 05
 * covers that.) That "and then nothing more happens" half is the part worth a
 * test, because it is invisible until someone tries.
 *
 * The request is walked to Dispatched through the API (raise, submit, issue,
 * invoice, ship — all of it covered by 02 and 03) so this spec spends its time
 * on the comment sheet itself.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive } from '../../helpers/navigation.js';
import {
  goTo, settle, pickOption, selectFor, inputFor, fillDate, expectToast, button,
  dispatchedSr, SAMPLE_TYPE,
} from './helpers.js';

let api;
const state = { srNo: null };

const today = () => new Date().toISOString().slice(0, 10);

/** Open one request's comment dialog off the Customer Comments list. */
async function openComments(page, srNo) {
  await goTo(page, '/sample-requests/comments');
  await page.getByPlaceholder('Search SR No or Order No...').fill(srNo);
  await settle(page, 1200);
  await page.locator('.ant-table-row', { hasText: srNo }).first().click();
  await expect(page.locator('.ant-modal-wrap:visible').getByText(srNo).first())
    .toBeVisible({ timeout: 20000 });
  return page.locator('.ant-modal-wrap:visible').last();
}

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests — recording the buyer decision closes the request', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    const { sr } = await dispatchedSr(api, { sampleTypeId: SAMPLE_TYPE.SIZE_SET });
    expect(sr.status, 'setup must leave the request Dispatched').toBe('DISPATCHED');
    state.srNo = sr.srNo;
  });

  test.afterAll(async () => { await api?.dispose(); });

  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('a dispatched request accepts an Approved decision', async ({ page }) => {
    const dialog = await openComments(page, state.srNo);
    await expect(dialog.getByText('Awaiting feedback').first()).toBeVisible();

    await fillDate(page, 'Feedback Received Date', today());
    await inputFor(page, 'Feedback From').fill('James Wilson');
    await pickOption(page, selectFor(page, 'Overall Decision'), 'Approved');
    await dialog.locator('textarea').first().fill('Fit and shade both signed off by the buyer.');

    await button(dialog, /^Save Comments$/).click();
    await expectToast(page, /Comments saved/i);
    await settle(page, 1500);

    const fresh = await api.get(`/sample-requests?search=${encodeURIComponent(state.srNo)}`);
    const row = (fresh.data.content || [])[0];
    expect(row.status, 'Approved is terminal — the request does not sit at Feedback Received').toBe('APPROVED');
  });

  test('the closed request is read-only everywhere it appears', async ({ page }) => {
    const dialog = await openComments(page, state.srNo);
    await expect(dialog.getByText('Feedback recorded').first()).toBeVisible();

    // The comment dialog drops both save actions once the request is terminal.
    await expect(dialog.locator('button').filter({ hasText: /^Save Comments$/ }))
      .toHaveCount(0);
    await expect(dialog.locator('button').filter({ hasText: /^Save as Draft$/ }))
      .toHaveCount(0);

    // And so does the request's own detail: nothing is left to do to it.
    await goTo(page, '/sample-requests/list');
    await page.getByPlaceholder('Search SR No or Order No...').fill(state.srNo);
    await settle(page, 1200);
    await page.locator('.ant-table-row', { hasText: state.srNo }).first().click();
    const detail = page.locator('.ant-modal-wrap:visible').last();
    await expect(detail.locator('.ant-tag').first()).toContainText(/Approved/i);

    // Substring match, not anchored: a disabled action row prints the reason it
    // is unavailable inside the button, so its text is longer than its label.
    for (const label of ['Edit Sample Request', 'Submit', 'Delete']) {
      await expect(
        button(detail, label),
        `${label} must be disabled on a closed request`,
      ).toBeDisabled();
    }
  });
});
