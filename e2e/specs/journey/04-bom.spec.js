/**
 * Session 4 — Bills of Materials.
 *
 * A BOM is built against a CONFIRMED ORDER: entering the order number looks it up and
 * pulls in style, buyer, material and the order quantity, which then drive every line's
 * total and purchase quantities.
 *
 * Each line is keyed by the Category / Sub-Category / Item Type triple — that resolves
 * to exactly one item, whose variants populate the Variant dropdown.
 *
 * This is where the UOM conversion from Session 0 finally pays off: fabric is consumed
 * in MTR but purchased in KG, thread in MTR but purchased in Cones, snap buttons in PCS
 * but purchased in Gross. The last test asserts the conversion actually happened.
 */

import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { visibleOption } from '../../helpers/ui-master.js';
import { BOMS } from '../../data/garment-dataset.js';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Session 4 — BOM', () => {
  for (const bom of BOMS) {
    test(`BOM — ${bom.styleNo}`, async ({ page }) => {
      await navigateWithAuth(page, '/bom/list');
      await waitForPageReady(page);
      if (await page.locator('.ant-table-row').filter({ hasText: bom.styleNo }).count()) {
        console.log(`BOM ${bom.styleNo}: skipped (already exists)`);
        return;
      }

      const orderNo = await orderNoForStyle(page, bom.styleNo);
      await navigateWithAuth(page, '/bom/new');
      await waitForPageReady(page);

      // Order lookup fires on blur and back-fills style, buyer, material and order qty.
      const orderInput = page.getByPlaceholder('SG/25-26/1001').first();
      await orderInput.fill(orderNo);
      await orderInput.blur();
      // A successful lookup renders the order number as a chip in the page header and
      // fills the Order Summary. Assert on that rather than on an input value —
      // React sets value as a property, so input[value="…"] never matches.
      await expect(page.getByText(orderNo, { exact: false }).first())
        .toBeVisible({ timeout: 20000 });
      await expect(page.getByText(/Order Summary/i).first()).toBeVisible({ timeout: 15000 });

      // The form starts with one empty line; only add further ones.
      for (const [idx, line] of bom.lines.entries()) {
        if (idx > 0) {
          await page.locator('button').filter({ hasText: /^Add Line$/i }).first().click();
          await page.waitForTimeout(500);
        }
        await fillBomLine(page, idx, line);
      }

      await page.locator('button').filter({ hasText: /^Create BOM$/ }).first().click();

      // Validation failures surface as transient message.warning toasts. Capture them
      // so a rejected submit reports *why* instead of just timing out.
      await page.waitForTimeout(2500);
      const notices = page.locator('.ant-message-notice');
      const noticeCount = await notices.count();
      for (let i = 0; i < noticeCount; i++) {
        console.log(`  submit notice: ${(await notices.nth(i).innerText()).replace(/\s+/g, ' ').trim()}`);
      }

      await expect(
        page.locator('.ant-message-notice').filter({ hasText: /BOM (created|updated) successfully/i })
      ).toBeVisible({ timeout: 30000 });
      await expect(page).toHaveURL(/\/bom\/list/, { timeout: 20000 });

      console.log(`BOM ${bom.styleNo}: created with ${bom.lines.length} lines`);
    });
  }

  test('BOM purchase quantities are converted into the purchase UOM', async ({ page }) => {
    // Regression guard for B-006: BOM snapshots the item's UOM conversion factor and
    // stores purchaseQtyPrimary, so a PO is raised in the purchase UOM (KG, Cones,
    // Gross) rather than the consumption UOM (MTR, PCS).
    await navigateWithAuth(page, '/bom/list');
    await waitForPageReady(page);

    const row = page.locator('.ant-table-row').filter({ hasText: BOMS[0].styleNo }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('a, button').first().click();
    await waitForPageReady(page);

    // The view shows the purchase figure in the purchase UOM with the consumption
    // figure beneath it — e.g. "= 10,150.00 MTR" under a KG total.
    await expect(page.getByText(/=\s*[\d,.]+\s*(MTR|PCS)/i).first())
      .toBeVisible({ timeout: 15000 });
  });
});

/** The order number of the confirmed order for a style, read off the order list. */
async function orderNoForStyle(page, styleNo) {
  await navigateWithAuth(page, '/orders/list');
  await waitForPageReady(page);
  const search = page.getByPlaceholder(/Search order no, buyer, style/i).first();
  await search.fill(styleNo);
  // The list has no style column, so the row itself cannot confirm the match. Wait for
  // the server-side filter to settle to the single expected order instead — sampling
  // too early returns the unfiltered list and silently picks the wrong order.
  await expect(page.locator('.ant-table-row')).toHaveCount(1, { timeout: 15000 });

  const row = page.locator('.ant-table-row').first();
  const match = (await row.innerText()).match(/SG\/\d{2}-\d{2}\/\d+/);
  if (!match) throw new Error(`No order number found for style ${styleNo}`);
  return match[0];
}

/** Fill one BOM line: classifier triple, variant, parts, consumption and processes. */
async function fillBomLine(page, rowIndex, line) {
  const row = page.locator('.ant-table-row').nth(rowIndex);

  await pickInCell(page, row, 'Category', line.category);
  await pickInCell(page, row, 'Sub Category', line.subCategory);
  // Selecting the item type resolves the single matching item and loads its variants.
  await pickInCell(page, row, 'Item Type', line.itemType);
  await page.waitForTimeout(900);

  // The variant dropdown only appears when the item resolves to more than one active
  // variant, and it renders asynchronously after the item lookup. An instant count()
  // check races that render, silently skips the selection and leaves Consumption
  // disabled ("Select variant first") — so wait for it to appear instead.
  const variantSelect = row.locator('.ant-select').filter({ hasText: /Select variant/ }).first();
  const hasVariantPicker = await variantSelect
    .waitFor({ state: 'visible', timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  if (hasVariantPicker) {
    await variantSelect.click();
    await page.waitForTimeout(300);
    await pickVariantOption(page, line.variant);
  }

  await pickMultiInCell(page, row, 'Select part', line.parts);

  // Consumption stays disabled until the item (and variant, when required) is set.
  const consumption = row.locator('input[role="spinbutton"], .ant-input-number input').first();
  await expect(consumption).toBeEnabled({ timeout: 10000 });
  await consumption.fill(String(line.consumption));
  await page.waitForTimeout(300);

  // The process column's placeholder is computed and renders as "Processes".
  await pickMultiInCell(page, row, 'Process', line.processes);

  // Allowances are mandatory on submit ("Line N: Process allowances are required for
  // submission"). Choosing processes auto-opens the dialog only for the first line, so
  // drive it explicitly from the row's "Edit allowances" control instead.
  await applyProcessAllowances(page, row);
}

/** Choose an option in a row's Select, located by its placeholder text. */
async function pickInCell(page, row, placeholder, optionText) {
  const select = row.locator('.ant-select').filter({ hasText: new RegExp(placeholder) }).first();
  await select.click({ timeout: 15000 });
  await page.waitForTimeout(300);
  await visibleOption(page, optionText).click({ timeout: 15000 });
  await page.waitForTimeout(400);
}

/** Choose several options in a row's multi-select, then close the dropdown. */
async function pickMultiInCell(page, row, placeholder, values) {
  const select = row.locator('.ant-select').filter({ hasText: new RegExp(placeholder) }).first();
  await select.click({ timeout: 15000 });
  await page.waitForTimeout(300);
  for (const value of values) {
    // Options are matched on text, not an exact title: process and part labels are
    // rendered with extra detail, so an exact [title="..."] match misses them.
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: value })
      .first()
      .click({ timeout: 15000 });
    await page.waitForTimeout(200);
  }
  await closeOpenDropdown(page);
}

/**
 * Close any open Select dropdown by clicking a neutral heading.
 *
 * Escape is unusable here: selecting processes auto-opens the Process Allowances
 * dialog, and an Escape meant for the dropdown dismisses that dialog instead — which
 * silently loses the allowances the submit requires.
 */
async function closeOpenDropdown(page) {
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('.ant-select-dropdown:visible').count()) === 0) return;
    // Never Escape while a dialog is open — it dismisses the dialog, not the dropdown.
    if (await page.locator('.ant-modal:visible').count()) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}

/**
 * Open the row's Process Allowances dialog and accept the Process Master defaults.
 *
 * Order matters: selecting processes auto-opens the dialog for the first line, and an
 * Escape aimed at the Select dropdown would dismiss that dialog too. So check for the
 * dialog first, and only fall back to the row's "Edit allowances" pencil.
 */
async function applyProcessAllowances(page, row) {
  const apply = page.locator('.ant-modal button').filter({ hasText: /Apply Allowances/i }).first();

  const autoOpened = await apply
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (!autoOpened) {
    await closeOpenDropdown(page);
    await row.locator('.anticon-edit').first().click({ timeout: 15000 });
    await apply.waitFor({ state: 'visible', timeout: 15000 });
  }

  // The process Select's dropdown renders above the dialog and intercepts the click on
  // Apply. Clicking the dialog's own title dismisses the dropdown (outside-click)
  // without closing the dialog, which is what Escape would wrongly do.
  await page.locator('.ant-modal-title').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);

  await apply.click({ timeout: 15000 });
  await expect(apply).toBeHidden({ timeout: 10000 });
  await closeOpenDropdown(page);
}

/**
 * Variant options are labelled "<name> (<code>)", so an exact title match fails.
 * Match on the name prefix instead.
 */
async function pickVariantOption(page, variantName) {
  const option = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: variantName })
    .first();
  await option.click({ timeout: 15000 });
  await page.waitForTimeout(300);
}
