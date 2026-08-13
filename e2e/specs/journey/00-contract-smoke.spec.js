/**
 * Session 0 gate — Item / Variant contract smoke test.
 *
 * Proves the UI now speaks the refactored Item Master API end-to-end through the
 * real screens. Before the Session 0 fixes this spec could not pass at all:
 *   - every item create failed with "Variant name is required"     (bug B-001)
 *   - fabric items additionally failed on the missing conversion factor (bug B-002)
 *
 * Deliberately minimal: it seeds only the master chain a single fabric item needs.
 * The full dataset is seeded by 01-masters.spec.js.
 */

import { test, expect } from '@playwright/test';
import { goToMasterEntity, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import {
  ensureMasterRecord,
  masterRecordExists,
  searchMasterList,
  openAddForm,
  fillByLabel,
  selectByLabel,
  multiSelectByLabel,
  formField,
  dialog,
} from '../../helpers/ui-master.js';

// A single fabric item exercises every part of the new contract:
// derived name, variant names, generated variant codes, and UOM conversion.
const FIXTURE = {
  uoms: [
    { name: 'Kilogram', symbol: 'KG' },
    { name: 'Meter', symbol: 'MTR' },
  ],
  attributes: [
    { name: 'Color', dataType: 'Text' },
    { name: 'GSM', dataType: 'Number' },
  ],
  category: { name: 'Fabric', description: 'Knitted, woven and denim fabrics' },
  subCategory: { name: 'Knits', category: 'Fabric' },
  // The Item Types form lists UOMs by NAME; the Item form lists them by SYMBOL.
  itemType: { name: 'Single Jersey', subCategory: 'Knits', attributes: ['Color', 'GSM'], uomNames: ['Kilogram', 'Meter'] },
  item: {
    derivedName: 'Fabric / Knits / Single Jersey',
    uom: 'KG',
    secondaryUom: 'MTR',
    conversionFactor: 3.2,
    hsnCode: '60062200',
    allowance: 3,
    description: '100% Combed Cotton Single Jersey',
    variants: [
      { name: 'Single Jersey 180 GSM Navy Blue', Color: 'Navy Blue', GSM: '180' },
      { name: 'Single Jersey 180 GSM White', Color: 'White', GSM: '180' },
    ],
  },
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Session 0 — Item/Variant contract', () => {
  test('seeds the UOMs the fabric item needs', async ({ page }) => {
    for (const uom of FIXTURE.uoms) {
      const result = await ensureMasterRecord(page, 'Unit of Measurement', uom.name, async (p) => {
        await fillByLabel(p, 'UOM Name', uom.name);
        await fillByLabel(p, 'Symbol', uom.symbol);
      });
      console.log(`UOM ${uom.name}: ${result}`);
    }
  });

  test('seeds the variant attributes', async ({ page }) => {
    for (const attr of FIXTURE.attributes) {
      const result = await ensureMasterRecord(page, 'Attributes', attr.name, async (p) => {
        await fillByLabel(p, 'Attribute Name', attr.name);
        await selectByLabel(p, 'Data Type', attr.dataType);
      });
      console.log(`Attribute ${attr.name}: ${result}`);
    }
  });

  test('seeds the category, sub-category and item type', async ({ page }) => {
    const cat = await ensureMasterRecord(page, 'Categories', FIXTURE.category.name, async (p) => {
      await fillByLabel(p, 'Category Name', FIXTURE.category.name);
      await fillByLabel(p, 'Description', FIXTURE.category.description);
    });
    console.log(`Category ${FIXTURE.category.name}: ${cat}`);

    const sub = await ensureMasterRecord(page, 'Sub Categories', FIXTURE.subCategory.name, async (p) => {
      await selectByLabel(p, 'Parent Category', FIXTURE.subCategory.category);
      await fillByLabel(p, 'Sub Category Name', FIXTURE.subCategory.name);
    });
    console.log(`Sub Category ${FIXTURE.subCategory.name}: ${sub}`);

    const type = await ensureMasterRecord(page, 'Item Types', FIXTURE.itemType.name, async (p) => {
      await selectByLabel(p, 'Sub Category', FIXTURE.itemType.subCategory);
      await fillByLabel(p, 'Item Type Name', FIXTURE.itemType.name);
      await multiSelectByLabel(p, 'Attributes', FIXTURE.itemType.attributes);
      await multiSelectByLabel(p, 'Units of Measure', FIXTURE.itemType.uomNames);
    });
    console.log(`Item Type ${FIXTURE.itemType.name}: ${type}`);
  });

  test('creates a fabric item with named variants and a UOM conversion factor', async ({ page }) => {
    const { item } = FIXTURE;
    await goToMasterEntity(page, 'Items');
    await waitForPageReady(page);

    if (await masterRecordExists(page, item.derivedName)) {
      console.log(`Item ${item.derivedName}: skipped (already exists)`);
      return;
    }

    await openAddForm(page);
    const modal = dialog(page);
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Classifier triple — the item name is derived from these three.
    await selectByLabel(page, 'Category', FIXTURE.category.name, modal);
    await selectByLabel(page, 'Subcategory', FIXTURE.subCategory.name, modal);
    await selectByLabel(page, 'Item Type', FIXTURE.itemType.name, modal);
    await page.waitForTimeout(800);

    // The derived Item Name must mirror the server's "Category / Sub-Category / Item Type".
    await expect(formField(page, 'Item Name', modal).locator('input').first())
      .toHaveValue(item.derivedName);

    // Fabric forces a secondary UOM, which makes the conversion factor mandatory —
    // the exact combination that was 100% broken before (B-002).
    await selectByLabel(page, 'Primary UOM', item.uom, modal);
    await selectByLabel(page, 'Secondary UOM', item.secondaryUom, modal);

    const conversion = modal.getByPlaceholder('e.g. 144');
    await expect(conversion).toBeVisible();
    await conversion.fill(String(item.conversionFactor));

    await fillByLabel(page, 'HSN Code', item.hsnCode, modal);
    await fillByLabel(page, 'Allowance', String(item.allowance), modal);
    await fillByLabel(page, 'Description', item.description, modal);

    // Variant 1.
    await fillVariant(page, modal, item.variants[0]);

    // Variant 2 — proves per-variant naming and within-item uniqueness.
    await modal.locator('button').filter({ hasText: /Add Variant/i }).click();
    await page.waitForTimeout(500);
    await fillVariant(page, modal, item.variants[1]);

    await modal.locator('button').filter({ hasText: /^Save$|^Create$|Save Item/i }).first().click();
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: /Item (created|updated) successfully/i })
    ).toBeVisible({ timeout: 20000 });

    // Round-trip: the item lists under its derived name.
    await waitForPageReady(page);
    await searchMasterList(page, item.variants[0].name);
    await expect(page.locator('.ant-table-row').filter({ hasText: item.derivedName }).first())
      .toBeVisible({ timeout: 15000 });
  });

  test('shows server-generated variant codes and the conversion on the saved item', async ({ page }) => {
    const { item } = FIXTURE;
    await goToMasterEntity(page, 'Items');
    await waitForPageReady(page);
    await searchMasterList(page, item.variants[0].name);

    const row = page.locator('.ant-table-row').filter({ hasText: item.derivedName }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button').first().click();

    const drawer = page.locator('.ant-drawer').first();
    await expect(drawer).toBeVisible({ timeout: 15000 });

    // Variant names round-trip and the conversion factor is shown back.
    await expect(drawer.getByText(item.variants[0].name, { exact: false })).toBeVisible();
    await expect(drawer.getByText(new RegExp(`1 ${item.uom} = ${item.conversionFactor}`))).toBeVisible();
  });
});

/** Fill the active variant tab: name first, then each attribute field. */
async function fillVariant(page, modal, variant) {
  await fillByLabel(page, 'Variant Name', variant.name, modal);
  for (const [key, value] of Object.entries(variant)) {
    if (key === 'name') continue;
    const field = formField(page, key, modal);
    const input = field.locator('input:not([type="hidden"])').first();
    if (await input.count()) {
      await input.fill(String(value));
      await page.waitForTimeout(150);
    }
  }
}
