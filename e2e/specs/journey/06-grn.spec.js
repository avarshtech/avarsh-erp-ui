/**
 * Session 6 — Goods Receipt Notes.
 *
 * The last link in the chain: material ordered on a PO physically arrives and is
 * booked into stock. Fabric is received as ROLLS (roll number + shade lot, because a
 * garment must not mix dye lots); trims and packing are received as CARTONS.
 *
 * Two things are proved here beyond "a GRN saves":
 *
 *  1. Quantities are received in the PURCHASE UOM the PO was raised in — KG for
 *     fabric, Cones for thread — closing the conversion chain that started at the
 *     item master (bug B-006).
 *  2. Every GRN line shows its VARIANT identity (name + generated SKU) rather than a
 *     blank. That is the whole point of the item/variant refactor, and it was broken
 *     until the PO read path started returning variantCode/variantName (bug B-030).
 *
 * Accessories GRNs additionally regress bug B-031: the PO line picker used to
 * exact-match a category literally named "Trims", so lines in "Local Trims",
 * "Imported Trims" or "Packing Materials" were unreceivable and no accessories GRN
 * could be created at all.
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { formField, waitForTableSettled } from '../../helpers/ui-master.js';
import { GRNS } from '../../data/garment-dataset.js';
import dayjs from 'dayjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures');
const INVOICE_FILE = path.join(FIXTURES, 'supplier-invoice.png');

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Session 6 — Goods Receipt Notes', () => {
  for (const grn of GRNS) {
    test(`GRN — ${grn.type} / ${grn.supplier}`, async ({ page }) => {
      await navigateWithAuth(page, '/inventory/grn/list');
      await waitForPageReady(page);
      await waitForTableSettled(page);

      // Each supplier receives exactly one GRN in this dataset, so the supplier is a
      // sufficient idempotency key — the GRN number is server-generated.
      if (await page.locator('.ant-table-row').filter({ hasText: grn.supplier }).count()) {
        console.log(`GRN ${grn.type} / ${grn.supplier}: skipped (already exists)`);
        return;
      }

      const route = grn.type === 'Fabric' ? 'fabric' : 'accessories';
      await navigateWithAuth(page, `/inventory/grn/${route}/new`);
      await waitForPageReady(page);

      // Selecting the PO loads its line items; the picker auto-includes them.
      await selectPOBySupplier(page, grn.supplier);
      await page.waitForTimeout(1500);

      // The picker must have found the PO's lines. When it shows the empty state the
      // category classification is broken (B-031) and nothing downstream can work —
      // fail here with that diagnosis rather than on a confusing later assertion.
      await expect(
        page.getByText(/No (fabric|accessories) line items in this PO/i)
      ).toHaveCount(0);

      // A PO with a single eligible line is auto-included and renders no checkbox
      // column at all; a multi-line PO must have its lines ticked explicitly.
      await selectAllPoLines(page);

      await formField(page, 'Challan / Invoice Number').locator('input').first().fill(grn.challanNo);

      // Both dates must sit inside the PO's date window and not be in the future;
      // today satisfies both for every PO in this dataset.
      await setDateByLabel(page, 'Invoice Date', dayjs());
      await setDateByLabel(page, 'Delivery Challan Date', dayjs());

      await formField(page, 'Vehicle Number').locator('input').first().fill(grn.vehicleNumber);
      await formField(page, 'Transporter').locator('input').first().fill(grn.transporter);

      // Supplier invoice is mandatory on submit (grnValidation). The upload is deferred:
      // the file is attached to the GRN when the form is submitted, not on its own.
      await page.locator('input[type="file"]').last().setInputFiles(INVOICE_FILE);
      await page.waitForTimeout(500);

      // ── Line detail: rolls for fabric, items + cartons for accessories ──
      for (const [lineIndex, line] of grn.lines.entries()) {
        if (grn.type === 'Fabric') {
          const row = rowFor(page, line.variant);
          await expect(row).toBeVisible({ timeout: 15000 });
          await fillCell(row, /Roll Number|Roll/i, line.rollNumber);
          await fillCell(row, /Quantity|Qty/i, String(line.receivingQty));
          await fillCell(row, /Shade Lot|Shade/i, line.shadeLot);
        } else {
          // Accessories has two tables over the same line: the received quantity, then
          // the carton it was packed into. Cartons must cover the full receipt.
          const itemRow = rowFor(page, line.variant);
          await expect(itemRow).toBeVisible({ timeout: 15000 });
          await fillCell(itemRow, /Quantity|Qty/i, String(line.receivingQty));
          await page.waitForTimeout(300);

          // The carton table identifies a line by item code and description, not by
          // variant name, so it cannot be located by the variant. One carton row is
          // created per selected line, in selection order — hence the index.
          const cartonRow = page
            .locator('.ant-card')
            .filter({ hasText: 'Carton Details' })
            .locator('tbody tr.ant-table-row')
            .nth(lineIndex);
          await expect(cartonRow).toBeVisible({ timeout: 15000 });
          await fillCell(cartonRow, /Carton/i, line.cartonNumber);
          await fillCell(cartonRow, /Quantity|Qty/i, String(line.receivingQty));
        }
        await page.waitForTimeout(300);
      }

      await page.locator('button').filter({ hasText: /^Submit$/ }).first().click();

      // Validation failures surface as transient toasts — surface them rather than
      // just timing out on the success message.
      await page.waitForTimeout(2500);
      const notices = page.locator('.ant-message-notice');
      for (let i = 0; i < (await notices.count()); i++) {
        console.log(`  submit notice: ${(await notices.nth(i).innerText()).replace(/\s+/g, ' ').trim()}`);
      }

      await expect(
        page.locator('.ant-message-notice').filter({ hasText: /submitted|created|success/i })
      ).toBeVisible({ timeout: 30000 });

      console.log(`GRN ${grn.type} / ${grn.supplier}: created with ${grn.lines.length} line(s)`);
    });
  }

  test('fabric is received in the purchase UOM with variant identity intact', async ({ page }) => {
    // Regression guard for the whole chain: the fabric roll must be booked as
    // 1,903.125 KG — the converted purchase quantity — under the variant's own name,
    // not the 6,090 MTR it is consumed in and not a blank.
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    const row = page.locator('.ant-table-row').filter({ hasText: 'Arvind Mills Ltd' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('a, button').first().click();
    await page.waitForTimeout(2000);

    // Thousands separators vary by view, so accept 1903 or 1,903.
    await expect(page.getByText(/1,?903(\.\d+)?/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Single Jersey 180 GSM Navy Blue').first()).toBeVisible({ timeout: 15000 });
  });

  test('accessory GRN lines carry the variant SKU, not a blank', async ({ page }) => {
    // B-030 regression: variantCode is what the store and QC screens key on.
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    const row = page.locator('.ant-table-row').filter({ hasText: 'YKK India Pvt Ltd' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('a, button').first().click();
    await page.waitForTimeout(2000);

    await expect(page.getByText('ZIP-MET-001-ANTI-16CM').first()).toBeVisible({ timeout: 15000 });
  });
});

/**
 * Pick the PO by its supplier. Options are labelled "PO/26-27/1001 — Arvind Mills Ltd",
 * so the shared selectByLabel helper (which matches an option's exact title) cannot be
 * used here — this matches on the supplier half.
 */
async function selectPOBySupplier(page, supplier) {
  const field = formField(page, 'Purchase Order');
  await field.locator('.ant-select').first().click({ timeout: 15000 });
  await page.waitForTimeout(300);

  const input = field.locator('input').first();
  await input.fill('');
  await input.pressSequentially(supplier, { delay: 15 });
  await page.waitForTimeout(500);

  const option = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: supplier })
    .first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click({ timeout: 15000 });
  await page.waitForTimeout(300);
}

/**
 * Tick every receivable line in the PO line-item picker. Lines already fully received
 * in an earlier GRN render a disabled checkbox, so the select-all header box is not
 * used — each enabled box is ticked individually.
 */
async function selectAllPoLines(page) {
  // Scoped to the table that actually has a selection column. The picker's Card cannot
  // be used as the scope: the PO summary Card above it also contains the text
  // "Line Items" and matches first.
  const picker = page
    .locator('table')
    .filter({ has: page.locator('thead input[type="checkbox"]') })
    .first();
  const boxes = picker.locator('tbody input[type="checkbox"]:not([disabled])');
  const count = await boxes.count();
  for (let i = 0; i < count; i++) {
    const box = boxes.nth(i);
    if (await box.isChecked()) continue;
    // A real click lands on the sticky page header or on AntD's styled overlay span
    // rather than the input. Dispatching the event bypasses hit-testing and still
    // triggers React's onChange, which is what the picker listens to.
    await box.dispatchEvent('click');
    await expect(box).toBeChecked({ timeout: 10000 });
    await page.waitForTimeout(200);
  }
  // Zero boxes is the single-line case: the row is auto-included without a checkbox.
  await page.waitForTimeout(800);
}

/** The editable row for a variant, in whichever GRN detail table renders it first. */
function rowFor(page, variant) {
  return page.locator('.ant-table-row').filter({ hasText: variant }).first();
}

/**
 * Fill an in-row editor. The GRN tables render bare inputs without labels, so the
 * cell is located by its column header position via the input's placeholder or, when
 * there is none, by matching the header text to the cell index.
 */
async function fillCell(row, headerPattern, value) {
  const page = row.page();
  const table = row.locator('xpath=ancestor::table[1]');
  const headers = table.locator('thead th');
  const count = await headers.count();
  let index = -1;
  for (let i = 0; i < count; i++) {
    if (headerPattern.test((await headers.nth(i).innerText()).trim())) { index = i; break; }
  }
  if (index < 0) throw new Error(`No column matching ${headerPattern} in this GRN table`);

  const cell = row.locator('td').nth(index);
  // AntD InputNumber wraps its <input>; both cases are covered by targeting the input.
  const input = cell.locator('input').first();
  await input.click({ timeout: 15000 });
  await input.fill(String(value));
  await page.waitForTimeout(150);
}

/**
 * Set an AntD DatePicker to today by clicking the panel's date cell.
 *
 * Deliberately NOT done by typing. Typing only works if the string matches the picker's
 * `format`, and a mismatch fails silently in the worst possible way: the text sits in
 * the input (so an assertion on the input's value passes) while the Form value stays
 * empty, and submit then reports the date as missing. Clicking the cell commits a real
 * dayjs value regardless of the display format.
 */
async function setDateByLabel(page, label, date) {
  const field = formField(page, label);
  const picker = field.locator('input').first();
  await picker.click({ timeout: 15000 });
  await page.waitForTimeout(400);

  // AntD titles each day cell with its ISO date, independent of the display format.
  const cell = page
    .locator(`.ant-picker-dropdown:visible td[title="${date.format('YYYY-MM-DD')}"]`)
    .first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.click({ timeout: 15000 });
  await page.waitForTimeout(400);

  await expect(picker).not.toHaveValue('', { timeout: 5000 });
}
