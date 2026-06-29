/**
 * BOM — UI: List, Filters, and the Order-No-driven Form gate
 *
 * The BOM form is gated by the Order No: typing a CONFIRMED order's number and
 * blurring fires GET /orders/by-order-no, which populates style/buyer/qty and
 * UNGATES the line grid ("Add Line" enables; the grid stops being dimmed). This
 * is the defining behavior of the screen and is the focus of the UI coverage.
 *
 * What this tests:
 *   - List loads with key columns; Status filter fires a search with status=
 *   - New form renders; "Add Line" is disabled until an order is verified
 *   - A valid CONFIRMED order number populates the header and enables "Add Line"
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder } from '../../helpers/bom-seed.js';

let api;
let seeded;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  seeded = await seedConfirmedOrder(api); // CONFIRMED order usable for a BOM
});
test.afterAll(async () => {
  try { await api.delete(`/orders/${seeded.order.id}`); } catch { /* gone */ }
  try { await api.delete(`/cost-sheets/${seeded.costSheetId}`); } catch { /* gone */ }
  await api.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test.describe('BOM — List & Filters', () => {
  test('List loads with the key columns', async ({ page }) => {
    await goToListPage(page, '/bom/list');
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table').first()).toBeVisible();
    for (const col of ['Order No', 'Style No', 'Buyer', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
  });

  test('Status filter fires a search request carrying status=', async ({ page }) => {
    await goToListPage(page, '/bom/list');
    await antTableWaitForData(page);

    const statusSelect = page.locator('.ant-select').filter({ hasText: 'Status' }).first();
    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => /\/boms(\?|\/search)/.test(r.url()) && /[?&]status=/.test(r.url()),
        { timeout: 10000 },
      ),
      (async () => {
        await statusSelect.click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible' });
        await dd.locator('.ant-select-item-option').filter({ hasText: 'Created' }).first().click();
      })(),
    ]);
    expect(req.url()).toMatch(/[?&]status=/);
  });
});

test.describe('BOM — Form gating via Order No', () => {
  test('New form renders and "Add Line" is disabled until an order is verified', async ({ page }) => {
    await navigateWithAuth(page, '/bom/new');
    const orderInput = page.getByPlaceholder('SG/25-26/1001');
    await orderInput.waitFor({ state: 'visible', timeout: 15000 });

    await expect(page.getByRole('button', { name: /Add Line/i })).toBeDisabled();
  });

  test('A valid CONFIRMED order number populates the header and enables "Add Line"', async ({ page }) => {
    await navigateWithAuth(page, '/bom/new');
    const orderInput = page.getByPlaceholder('SG/25-26/1001');
    await orderInput.waitFor({ state: 'visible', timeout: 15000 });

    // Type the digits onto the fixed "SG/" prefix so the masked formatter runs.
    const digits = seeded.order.orderNo.replace(/\D/g, '');
    await orderInput.click();
    await orderInput.press('End');
    await orderInput.pressSequentially(digits, { delay: 30 });

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/orders/by-order-no'), { timeout: 15000 }),
      orderInput.press('Tab'),
    ]);
    expect(resp.status()).toBe(200);

    // header populates (style no shown) and the line grid ungates
    await expect(page.getByRole('button', { name: /Add Line/i })).toBeEnabled({ timeout: 10000 });
    await expect(page.getByText(seeded.order.orderNo).first()).toBeVisible({ timeout: 10000 });
  });
});
