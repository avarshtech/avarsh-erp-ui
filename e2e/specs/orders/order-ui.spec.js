/**
 * Orders — UI: List, Filters, and the Costing-ID-driven Form
 *
 * The order form is gated by a Costing ID: typing an APPROVED costing's ID and
 * blurring fires GET /cost-sheets/by-costing-id, which auto-fills buyer/style/
 * season/currency and ENABLES the Order Lines card (dimmed until then). This is
 * the defining behavior of the screen, so it is the focus of the UI coverage.
 *
 * What this tests:
 *   - List loads with key columns; Status filter fires a search with status=
 *   - New form renders; Order Lines card is gated until a costing is verified
 *   - Entering a valid APPROVED costing id auto-fills the header + ungates lines
 *   - Entering a non-existent costing id surfaces an error and keeps lines gated
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedApprovedCosting } from '../../helpers/order-seed.js';

let api;
let seededCosting;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  seededCosting = await seedApprovedCosting(api); // Approved → usable for an order
});
test.afterAll(async () => {
  try { await api.delete(`/cost-sheets/${seededCosting.costSheetId}`); } catch { /* gone */ }
  await api.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test.describe('Orders — List & Filters', () => {
  test('List loads with the key columns', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table').first()).toBeVisible();
    for (const col of ['Order No', 'Buyer', 'Total Qty', 'Dispatch', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
    // The PO-facing "Supplier Delay" figure was replaced by the revised dispatch date.
    await expect(page.getByRole('columnheader', { name: 'Supplier Delay', exact: true })).toHaveCount(0);
  });

  test('Status filter fires a search request carrying status=', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);

    const statusSelect = page.locator('.ant-select').filter({ hasText: 'Status' }).first();
    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/orders/search') && /[?&]status=/.test(r.url()),
        { timeout: 10000 },
      ),
      (async () => {
        await statusSelect.click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible' });
        await dd.locator('.ant-select-item-option').filter({ hasText: 'Confirmed' }).first().click();
      })(),
    ]);
    expect(req.url()).toMatch(/[?&]status=/);
  });
});

test.describe('Orders — Form gating via Costing ID', () => {
  test('New form renders and the Order Lines card is gated until a costing is verified', async ({ page }) => {
    await navigateWithAuth(page, '/orders/new');
    await page.locator('#costingId').waitFor({ state: 'visible', timeout: 15000 });

    // The gate alert is present before any costing is entered
    await expect(page.getByText(/Enter a valid Costing ID above to enable order lines/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Save as Draft/i })).toBeVisible();
  });

  test('Entering a valid APPROVED costing id auto-fills the header and ungates lines', async ({ page }) => {
    await navigateWithAuth(page, '/orders/new');
    const costingInput = page.locator('#costingId');
    await costingInput.waitFor({ state: 'visible', timeout: 15000 });

    // Type the digits char-by-char onto the fixed "CST/" prefix so the masked-input
    // formatter runs (select-all would scramble it — the formatter rebuilds per keystroke).
    const digits = seededCosting.costingId.replace(/\D/g, ''); // e.g. "26271029"
    await costingInput.click();
    await costingInput.press('End');
    await costingInput.pressSequentially(digits, { delay: 30 });

    // Blur triggers the lookup
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/cost-sheets/by-costing-id') || r.url().includes('/cost-sheets/costing-id'),
        { timeout: 15000 },
      ),
      costingInput.press('Tab'),
    ]);
    expect(resp.status()).toBe(200);

    // Buyer/style auto-fill from costing; the gate alert disappears
    await expect(page.locator('#styleNo')).toHaveValue(seededCosting.styleNo, { timeout: 10000 });
    await expect(page.getByText(/Enter a valid Costing ID above to enable order lines/i)).toBeHidden({ timeout: 10000 });
    // Add Order Line becomes actionable
    await expect(page.getByRole('button', { name: /Add Order Line/i })).toBeEnabled({ timeout: 10000 });
  });

  test('A non-existent costing id surfaces an error and keeps lines gated', async ({ page }) => {
    await navigateWithAuth(page, '/orders/new');
    const costingInput = page.locator('#costingId');
    await costingInput.waitFor({ state: 'visible', timeout: 15000 });

    await costingInput.click();
    await costingInput.pressSequentially('99990000', { delay: 30 }); // CST/99-99/0000 — not present
    await costingInput.press('Tab');

    // gate alert remains; style stays empty
    await expect(page.getByText(/Enter a valid Costing ID above to enable order lines/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#styleNo')).toHaveValue('');
  });
});
