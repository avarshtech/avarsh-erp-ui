/**
 * PO — UI: List, Filters, and General-PO Create with live tax computation
 *
 * What this tests (real browser DOM):
 *   - List loads with the key columns; Status filter fires a search with status=
 *   - New form renders; "Add Item" is gated until a supplier is selected
 *   - Create a General PO through the form: pick supplier → add an item line →
 *     type Qty / Unit Price / GST% → the Order Summary Grand Total updates to the
 *     GST-inclusive total (proving the frontend tax wiring) → Save as Draft →
 *     POST /purchase-orders 200 → returns to the list
 *
 * Selectors: Supplier is a Form.Item name=supplierId → #supplierId. PO Type is a
 * Segmented (.po-type-toggle). Line cells are placeholder-based (Search items…,
 * Description, "0", "0.00") with a GST% select.
 */

import { test, expect } from '@playwright/test';
import { antSelect, antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage, navigateWithAuth } from '../../helpers/navigation.js';

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test.describe('PO — List & Filters', () => {
  test('List loads with the key columns', async ({ page }) => {
    await goToListPage(page, '/purchase-orders/supplier-po/list');
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table').first()).toBeVisible();
    for (const col of ['PO Number', 'Supplier', 'PO Type', 'Grand Total', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
    }
  });

  test('Status filter fires a search request carrying status=', async ({ page }) => {
    await goToListPage(page, '/purchase-orders/supplier-po/list');
    await antTableWaitForData(page);

    const statusSelect = page.locator('.ant-select').filter({ hasText: 'Status' }).first();
    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/purchase-orders/search') && /[?&]status=/.test(r.url()),
        { timeout: 10000 },
      ),
      (async () => {
        await statusSelect.click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible' });
        await dd.locator('.ant-select-item-option').filter({ hasText: 'Draft' }).first().click();
      })(),
    ]);
    expect(req.url()).toMatch(/[?&]status=Draft/);
  });
});

test.describe('PO — General PO form & create', () => {
  test('New form renders; "Add Item" is gated until a supplier is chosen', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/supplier-po/new');
    await page.locator('#supplierId').waitFor({ state: 'visible', timeout: 15000 });

    // PO Type defaults to General; the General add control is "Add Item", disabled pre-supplier.
    await expect(page.getByRole('button', { name: /Add Item/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Save as Draft/i })).toBeVisible();
  });

  test('Create a General PO via the form: tax computes live → Save as Draft → list', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/supplier-po/new');
    await page.locator('#supplierId').waitFor({ state: 'visible', timeout: 15000 });

    // 1) Pick the first supplier
    await antSelect(page, page.locator('#supplierId'), null, { first: true });
    await page.waitForTimeout(400);

    // 1b) Fill the other required header fields: Terms & Conditions + Expected Delivery Date.
    // The 2nd date picker on the page is Expected Delivery Date (the 1st is PO Date).
    await antSelect(page, page.getByRole('combobox', { name: /Terms/ }), null, { first: true });
    await page.locator('.ant-picker').nth(1).click();
    const panel = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last();
    await panel.waitFor({ state: 'visible' });
    await panel.locator('.ant-picker-header-next-btn').click(); // next month → guaranteed future
    await panel.locator('.ant-picker-cell-in-view:not(.ant-picker-cell-disabled) .ant-picker-cell-inner')
      .filter({ hasText: /^15$/ }).first().click();

    // 2) The General form already starts with one empty line — use it (no Add Item).
    await expect(page.getByRole('button', { name: /Add Item/i })).toBeEnabled();
    const row = page.locator('.ant-table-tbody tr.ant-table-row').first();
    await row.waitFor({ state: 'visible' });

    // 3) Search + pick an item. The AutoComplete debounces + re-renders its options,
    //    so select via KEYBOARD (ArrowDown+Enter) to avoid the click-detach race.
    const itemSelect = row.locator('.ant-select').first();
    await itemSelect.click(); // focus the AutoComplete (the inner search input has no width)
    await page.keyboard.type('Cotton', { delay: 60 }); // types into the focused search input
    await page.waitForResponse((r) => r.url().includes('/items/autocomplete'), { timeout: 12000 }).catch(() => {});
    const itemDd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await itemDd.locator('.ant-select-item-option').first().waitFor({ state: 'visible', timeout: 12000 });
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Qty becomes editable once an item is chosen — confirms the selection took.
    const nums = row.locator('input.ant-input-number-input');
    await expect(nums.first()).toBeEnabled({ timeout: 8000 });

    // 4) Fill Qty + Unit Price (number inputs, in column order: Qty, Unit Price)
    await nums.nth(0).fill('10');
    await nums.nth(1).fill('100');

    // 5) Set GST% to 18 via the row's GST select (the last .ant-select in the row)
    const gstSelect = row.locator('.ant-select').last();
    await gstSelect.click();
    const gstDd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await gstDd.locator('.ant-select-item-option').filter({ hasText: '18%' }).first().click();
    await page.keyboard.press('Tab');

    // 6) Order Summary Grand Total = 10×100×1.18 = 1180 (GST-inclusive)
    await expect(page.getByText(/1,?180\.00/).first()).toBeVisible({ timeout: 8000 });

    // 7) Save as Draft → POST 200 → navigates to list
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/purchase-orders') && r.request().method() === 'POST',
        { timeout: 20000 },
      ),
      page.getByRole('button', { name: /Save as Draft/i }).click(),
    ]);
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    await expect(page).toHaveURL(/\/purchase-orders\/list/, { timeout: 15000 });
  });
});
