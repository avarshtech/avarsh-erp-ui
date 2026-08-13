/**
 * Session 3 — Buyer orders.
 *
 * NOTE ON ORDER: the original campaign plan had BOM before Order, but this codebase
 * builds a BOM *against an order* — BOMForm looks the order up by number and derives
 * its quantities, colours and per-size consumption matrix from the order lines. So the
 * real chain is Costing -> Order -> BOM, and Orders must be seeded first.
 *
 * An order is raised against an approved cost sheet: entering the Costing ID looks it
 * up and auto-fills buyer, style, garment name, currency and fabric description.
 *
 * Idempotent: an order for a style is skipped if one already exists.
 */

import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { selectByLabel, formField, visibleOption } from '../../helpers/ui-master.js';
import { ORDERS } from '../../data/garment-dataset.js';
import dayjs from 'dayjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Session 3 — Orders', () => {
  for (const order of ORDERS) {
    test(`Order — ${order.styleNo}`, async ({ page }) => {
      await navigateWithAuth(page, '/orders/list');
      await waitForPageReady(page);

      if (await page.locator('.ant-table-row').filter({ hasText: order.buyerPoNo }).count()) {
        console.log(`Order ${order.styleNo} (${order.buyerPoNo}): skipped (already exists)`);
        return;
      }

      const costingId = await costingIdForStyle(page, order.styleNo);
      await navigateWithAuth(page, '/orders/new');
      await waitForPageReady(page);

      // ── Order details. The Costing ID lookup fires on blur and back-fills the
      // buyer, style, garment name, currency and fabric description. ──
      const costingInput = formField(page, 'Costing ID').locator('input').first();
      await costingInput.fill(costingId);
      await costingInput.blur();
      await expect(formField(page, 'Style No').locator('input').first())
        .toHaveValue(order.styleNo, { timeout: 20000 });

      await selectByLabel(page, 'Material', order.material);
      await selectByLabel(page, 'Component', order.component);
      await selectByLabel(page, 'Payment Terms', order.paymentTerms);
      await formField(page, 'Payment Days').locator('input').first().fill(String(order.paymentDays));

      const fabricDesc = formField(page, 'Fabric Description').locator('textarea, input').first();
      if (!(await fabricDesc.inputValue())) {
        await fabricDesc.fill('100% Cotton');
      }

      // ── Order line (assortment) ──
      // The form starts with one empty line. Count the collapse panels rather than the
      // inputs: a collapsed panel renders no inputs, so an input-based check would add
      // a second line and leave a blank "New Assortment" that fails validation.
      const linePanels = page.locator('.ant-collapse-item');
      if ((await linePanels.count()) === 0) {
        await page.locator('button').filter({ hasText: /Add Order Line/i }).click();
        await page.waitForTimeout(600);
      }
      // Make sure the line we are about to fill is expanded.
      if ((await page.getByPlaceholder('Buyer PO Number').count()) === 0) {
        await linePanels.first().locator('.ant-collapse-header').click();
        await page.waitForTimeout(500);
      }

      await page.getByPlaceholder('Buyer PO Number').first().fill(order.buyerPoNo);
      // Scope to the line's own panel — the page header also has a (disabled) Order Date
      // picker, and an unscoped .ant-picker would hit that one first.
      const linePanel = page.locator('.ant-collapse-item').filter({ hasText: order.buyerPoNo }).first();
      await pickPlaceholderSelect(page, /Select destination/, order.destination);
      await setDispatchDate(page, linePanel, order.dispatchInDays);
      await pickPlaceholderSelect(page, /Select size preset/, order.sizePreset);
      await page.waitForTimeout(600);

      // One price for every size, then the colour x size quantity matrix.
      await applyBulkPrice(page, order.price);
      for (const [idx, color] of order.colors.entries()) {
        if (idx > 0) {
          await page.locator('button').filter({ hasText: /^Add Color$/ }).first().click();
          await page.waitForTimeout(400);
        }
        await fillColorRow(page, idx, color);
      }

      await page.locator('button').filter({ hasText: /^Submit Order$/ }).first().click();
      // Submit asks for confirmation before it creates and confirms the order.
      await page.locator('.ant-modal button').filter({ hasText: /^Submit$/ }).last().click();
      await expect(
        page.locator('.ant-message-notice').filter({ hasText: /submitted and confirmed/i })
      ).toBeVisible({ timeout: 30000 });
      await expect(page).toHaveURL(/\/orders\/list/, { timeout: 20000 });

      console.log(`Order ${order.styleNo} (${order.buyerPoNo}): created`);
    });
  }

  test('orders carry their style, buyer PO and total quantity', async ({ page }) => {
    await navigateWithAuth(page, '/orders/list');
    await waitForPageReady(page);

    for (const order of ORDERS) {
      const row = page.locator('.ant-table-row').filter({ hasText: order.buyerPoNo }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await expect(row).toContainText(order.styleNo);

      const expectedQty = order.colors.reduce(
        (sum, c) => sum + Object.values(c.quantities).reduce((a, b) => a + b, 0),
        0
      );
      // Quantity is rendered with thousands separators.
      await expect(row).toContainText(expectedQty.toLocaleString());
    }
  });
});

/** The Costing ID of the approved cost sheet for a style, read off the costing list. */
async function costingIdForStyle(page, styleNo) {
  await navigateWithAuth(page, '/costing/list');
  await waitForPageReady(page);
  const row = page.locator('.ant-table-row').filter({ hasText: styleNo }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  const text = await row.innerText();
  const match = text.match(/CST\/\d{2}-\d{2}\/\d+/);
  if (!match) throw new Error(`No costing ID found on the row for style ${styleNo}`);
  return match[0];
}

/** Open a Select by its placeholder text and choose an option. */
async function pickPlaceholderSelect(page, placeholderPattern, optionText) {
  const select = page
    .locator('.ant-select')
    .filter({ hasText: placeholderPattern })
    .first();
  await select.click({ timeout: 15000 });
  await page.waitForTimeout(300);
  await visibleOption(page, optionText).click({ timeout: 15000 });
  await page.waitForTimeout(300);
}

/** Pick a dispatch date N days out via the line's own date picker. */
async function setDispatchDate(page, scope, daysAhead) {
  const date = dayjs().add(daysAhead, 'day').format('YYYY-MM-DD');
  const picker = scope.locator('.ant-picker input').first();
  await picker.click({ timeout: 15000 });
  await picker.fill(date);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}

/** Set a single price across every size using the "Apply All" shortcut. */
async function applyBulkPrice(page, price) {
  const bulk = page.getByPlaceholder('0.00').first();
  await bulk.fill(String(price));
  await page.locator('button').filter({ hasText: /Apply All/i }).first().click();
  await page.waitForTimeout(400);
}

/** Fill one colour row: name plus a quantity per size. */
async function fillColorRow(page, rowIndex, color) {
  const nameInput = page.getByPlaceholder('Color/Print name *').nth(rowIndex);
  await nameInput.fill(color.name);
  await page.waitForTimeout(200);

  // Quantity inputs use placeholder "0" and are laid out size-by-size within the row.
  const row = nameInput.locator('xpath=ancestor::tr[1]');
  const qtyInputs = row.getByPlaceholder('0');
  const sizes = Object.keys(color.quantities);
  for (let i = 0; i < sizes.length; i++) {
    await qtyInputs.nth(i).fill(String(color.quantities[sizes[i]]));
    await page.waitForTimeout(120);
  }
}
