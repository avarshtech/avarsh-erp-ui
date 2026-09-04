/**
 * A sample request's deadline re-agreed after submission, and the order it was
 * raised for picking up the slip.
 *
 * A draft is simply edited; once submitted the originals are frozen and a later
 * agreement sits beside them as a revision, with its reason on the trail. The
 * Deadlines panel shows the date now tracked to with the original struck
 * through, the list counts down from it, and the linked order carries the
 * shift on its own dispatch date. Pulling the request back to Draft withdraws
 * the revision, on the screen and on the order alike.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  SEED_ORDER_NO, goTo, settle, button, expectToast, raiseSr, submitSr, getSr, watchConsole,
} from './helpers.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const iso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The DD-MMM-YYYY shape the app's pickers and formatDate use. */
const dmy = (isoDate) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
};

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

let api;
let sr;
const SHIFT = 7;

/** Open the request's detail dialog off the list and wait for it to paint. */
async function openSr(page, srNo) {
  await goTo(page, '/sample-requests/list');
  await page.getByPlaceholder('Search SR No or Order No...').fill(srNo);
  await settle(page, 1200);
  await page.locator('.ant-table-row', { hasText: srNo }).first().click();
  await expect(page.locator('.ant-modal-wrap:visible').getByText(srNo).first())
    .toBeVisible({ timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  sr = await submitSr(api, await raiseSr(api));
});
test.afterAll(async () => { await api.dispose(); });

test.describe('Sample Requests — deadline revision', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('a submitted request has its deadline re-agreed from the Deadlines panel', async ({ page }) => {
    const errors = watchConsole(page);
    await openSr(page, sr.srNo);
    const detail = page.locator('.ant-modal-wrap:visible').first();
    await button(detail, /^Revise$/).click();

    const dialog = page.locator('.ant-modal-wrap:visible').last();
    await expect(dialog.getByText('Revise Deadline')).toBeVisible();

    const newDispatch = iso(10 + SHIFT); // raised at +10 days
    const dispatchInput = dialog.locator('.ant-picker input').first();
    await dispatchInput.click();
    await dispatchInput.fill(dmy(newDispatch));
    await page.keyboard.press('Enter');
    await expect(dialog.getByText(`+${SHIFT} days`)).toBeVisible();

    await dialog.locator('textarea').fill('Buyer asked for a later courier slot');
    await button(dialog, /^Save Revision$/).click();
    await expectToast(page, /Deadline revised/i);

    // The panel now leads with the revised date and keeps the original beside it.
    await expect(detail.getByText('Revised', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await expect(detail.getByText(dmy(newDispatch)).first()).toBeVisible();

    const fresh = await getSr(api, sr.id);
    expect(fresh.dispatchDeadline).toBe(sr.dispatchDeadline);
    expect(fresh.revisedDispatchDeadline).toBe(newDispatch);
    // Not stated in the dialog, so the buyer's window moved by the same number of days.
    expect(fresh.revisedBuyerApprovalDeadline).toBe(iso(20 + SHIFT));
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the list shows the revised deadline and counts down from it', async ({ page }) => {
    await goTo(page, '/sample-requests/list');
    await page.getByPlaceholder('Search SR No or Order No...').fill(sr.srNo);
    await settle(page, 1200);
    const row = page.locator('.ant-table-row', { hasText: sr.srNo }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('Revised');
    await expect(row).toContainText(dmy(iso(10 + SHIFT)));
    await expect(row).toContainText(`${10 + SHIFT}d remaining`);
  });

  test('the order the sample was raised for carries the slip', async () => {
    const order = ok(await api.get(`/orders/by-order-no?orderNo=${encodeURIComponent(SEED_ORDER_NO)}`), 'get order');
    // Worst slip wins across every sample on the seeded order, so at least this one's.
    expect(order.dispatchDelayDays).toBeGreaterThanOrEqual(SHIFT);
    expect(order.dispatchDelaySource).toMatch(/^Sample SRQ\//);
  });

  test('pulling the request back to Draft withdraws the revision, and a draft offers none', async ({ page }) => {
    const current = await getSr(api, sr.id);
    ok(await api.put(`/sample-requests/${sr.id}/status`, { status: 'DRAFT', version: current.version }), 'pull back');

    const draft = await getSr(api, sr.id);
    expect(draft.revisedDispatchDeadline).toBeNull();
    expect(draft.revisedBuyerApprovalDeadline).toBeNull();

    const order = ok(await api.get(`/orders/by-order-no?orderNo=${encodeURIComponent(SEED_ORDER_NO)}`), 'get order');
    expect(order.dispatchDelaySource ?? '').not.toBe(`Sample ${sr.srNo}`);

    const refused = await api.put(`/sample-requests/${sr.id}/revise-deadline`, {
      revisedDispatchDeadline: iso(30), reason: 'Should be refused while a draft', version: draft.version,
    });
    expect(refused.status).toBe(409);

    await openSr(page, sr.srNo);
    const detail = page.locator('.ant-modal-wrap:visible').first();
    await expect(button(detail, /^Revise$/)).toHaveCount(0);
  });
});
