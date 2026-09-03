/**
 * Session 5 — Purchase Orders.
 *
 * A PO is raised on one supplier and pulls its lines from a BOM, so a BOM's lines are
 * split across POs by material: fabric from the mill, threads/labels from the trims
 * supplier, zippers from the zip maker.
 *
 * The quantity carried over is the BOM's `purchaseQtyPrimary` — expressed in the
 * PURCHASE UOM (KG, Cones, Gross), not the consumption UOM. That is the whole point of
 * the UOM conversion chain built in Session 0 and proved in Session 4, and the last
 * test asserts it survives into the PO.
 */

import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { selectByLabel, formField, waitForTableSettled } from '../../helpers/ui-master.js';
import { PURCHASE_ORDERS } from '../../data/garment-dataset.js';
import dayjs from 'dayjs';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Session 5 — Purchase Orders', () => {
  for (const po of PURCHASE_ORDERS) {
    test(`PO — ${po.supplier} / ${po.orderNo}`, async ({ page }) => {
      await navigateWithAuth(page, '/purchase-orders/supplier-po/list');
      await waitForPageReady(page);
      await waitForTableSettled(page);

      // The PO list shows PO number, supplier, date and status — not the source order —
      // so the order number cannot be part of the exists-check. Each supplier has
      // exactly one PO in this dataset, which makes the supplier a sufficient key.
      const existing = page.locator('.ant-table-row').filter({ hasText: po.supplier });
      if (await existing.count()) {
        console.log(`PO ${po.supplier} / ${po.orderNo}: skipped (already exists)`);
        return;
      }

      await navigateWithAuth(page, '/purchase-orders/supplier-po/new');
      await waitForPageReady(page);

      // "Regular" pulls its lines from a single order's BOM; "General" is manual entry.
      await page.locator('.ant-segmented-item').filter({ hasText: /^Regular$/ }).first().click();
      await page.waitForTimeout(500);

      await selectByLabel(page, 'Supplier', po.supplier);
      await setDateByLabel(page, 'Expected Delivery Date', dayjs().add(po.deliveryInDays, 'day'));
      await selectByLabel(page, 'Terms & Conditions', po.terms);

      // ── Pull the lines in from the BOM ──
      await page.locator('button').filter({ hasText: /Select BOM Lines/i }).first().click();
      const drawer = page.locator('.ant-drawer').first();
      await expect(drawer).toBeVisible({ timeout: 15000 });

      const orderInput = drawer.getByPlaceholder('SG/25-26/1001').first();
      await orderInput.fill(po.orderNo);
      await orderInput.press('Enter');

      // The drawer renders BOM lines as cards, not a table, and only shows the
      // materials this supplier actually supplies ("Showing Fabric lines only").
      for (const line of po.lines) {
        const card = drawer
          .locator('div')
          .filter({ has: page.getByText(line.variant, { exact: false }) })
          .filter({ has: page.locator('input[type="checkbox"]') })
          .last();
        await expect(card).toBeVisible({ timeout: 20000 });
        await card.locator('input[type="checkbox"]').first().check({ timeout: 15000 });
        await page.waitForTimeout(250);
      }

      await drawer.locator('button').filter({ hasText: /Add \d+ Lines? to PO/i }).first().click();
      // AntD keeps the drawer mounted and merely hides it, so assert on the outcome —
      // the lines landing in the PO — rather than on the drawer disappearing.
      await expect(page.locator('.ant-drawer-open')).toHaveCount(0, { timeout: 15000 });
      await page.waitForTimeout(1000);

      // ── Unit prices ──
      for (const line of po.lines) {
        const row = page.locator('.ant-table-row').filter({ hasText: line.variant }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
        await row.getByPlaceholder(/Unit Price|Price|0\.00/i).first().fill(String(line.unitPrice));
        await page.waitForTimeout(250);
      }

      await page.locator('button').filter({ hasText: /Submit for Approval/i }).first().click();

      // Submitting asks for confirmation before it sends the PO for approval.
      const confirm = page.locator('.ant-modal button').filter({ hasText: /^Submit$/ }).last();
      if (await confirm.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
        await confirm.click({ timeout: 15000 });
      }

      // Validation failures surface as transient toasts — report why rather than just
      // timing out on the success message.
      await page.waitForTimeout(2500);
      const notices = page.locator('.ant-message-notice');
      for (let i = 0; i < (await notices.count()); i++) {
        console.log(`  submit notice: ${(await notices.nth(i).innerText()).replace(/\s+/g, ' ').trim()}`);
      }

      await expect(
        page.locator('.ant-message-notice').filter({ hasText: /submitted|created|success/i })
      ).toBeVisible({ timeout: 30000 });

      console.log(`PO ${po.supplier} / ${po.orderNo}: created with ${po.lines.length} lines`);
    });
  }

  test('PO quantities are in the purchase UOM, not the consumption UOM', async ({ page }) => {
    // Regression guard for B-006 carried through to the PO: the fabric line must be
    // ordered in KG (≈1,903) rather than the 6,090 MTR it is consumed in.
    await navigateWithAuth(page, '/purchase-orders/supplier-po/list');
    await waitForPageReady(page);
    await waitForTableSettled(page);

    const row = page.locator('.ant-table-row').filter({ hasText: 'Arvind Mills Ltd' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('a, button').first().click();
    await waitForPageReady(page);

    // Assert on the quantity, not the variant name: PO line items currently come back
    // with variantCode/variantName/uomName null from the API (bug B-030), so the name
    // is not rendered. The quantity is the actual regression guard here — 1,903.125 KG
    // (the converted purchase quantity) rather than the 6,090 MTR it is consumed in.
    // Thousands separators vary by view, so accept 1903 or 1,903.
    await expect(page.getByText(/1,?903(\.\d+)?/).first()).toBeVisible({ timeout: 15000 });
  });
});

/** Set an AntD DatePicker identified by its form label. */
async function setDateByLabel(page, label, date) {
  // The app renders dates as DD-MMM-YYYY (utils/uiConstants DATE_FORMAT). Typing an ISO
  // string leaves the text in the input but the DatePicker cannot parse it, so onChange
  // never fires and the Form field stays empty — the submit then reports the date as
  // missing even though it looks filled.
  const formatted = date.format('DD-MMM-YYYY');
  const picker = formField(page, label).locator('input').first();
  await picker.click({ timeout: 15000 });
  await picker.pressSequentially(formatted, { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await expect(picker).toHaveValue(formatted, { timeout: 5000 });
}

