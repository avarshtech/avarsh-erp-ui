/**
 * Session 1 — Master data seed.
 *
 * Drives all 17 master screens through the real UI to populate the canonical
 * garment dataset (e2e/data/garment-dataset.js). No API seeding anywhere.
 *
 * Every step is idempotent: each record is looked up first and skipped when present,
 * so this spec can be re-run against an already-seeded database.
 *
 * Order matters — it follows the FK chain:
 *   UOM -> Attributes -> Categories -> Sub-Categories -> Item Types -> Items
 *   Buyers -> Size Presets -> Styles
 *   Suppliers, Payment Terms, T&C, Overheads, Processes, Parts, Defect Types, Trims QC
 */

import { test, expect } from '@playwright/test';
import { goToMasterEntity, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import {
  ensureMasterRecord,
  searchMasterList,
  openAddForm,
  expectNoErrorToast,
  fillByLabel,
  selectByLabel,
  multiSelectByLabel,
  fillTagsByLabel,
  fillRichText,
  checkByText,
  formField,
  dialog,
} from '../../helpers/ui-master.js';
import {
  UOMS,
  UOM_NAME_BY_SYMBOL,
  ATTRIBUTES,
  CATEGORIES,
  SUB_CATEGORIES,
  ITEM_TYPES,
  ITEMS,
  BUYERS,
  SUPPLIERS,
  SIZE_PRESETS,
  STYLES,
  PAYMENT_TERMS,
  TERMS_CONDITIONS,
  OVERHEADS,
  PROCESSES,
  PARTS,
  DEFECT_TYPES,
  TRIMS_QC_CRITERIA,
} from '../../data/garment-dataset.js';

// The Attributes form labels data types in words; the dataset stores the API value.
const DATA_TYPE_LABEL = { string: 'Text', number: 'Number', boolean: 'Yes/No', date: 'Date' };

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

const report = (label, results) => {
  const created = results.filter((r) => r === 'created').length;
  console.log(`${label}: ${created} created, ${results.length - created} already present`);
};

test.describe('Session 1 — Master data', () => {
  test('Units of Measurement', async ({ page }) => {
    const results = [];
    for (const uom of UOMS) {
      results.push(await ensureMasterRecord(page, 'Unit of Measurement', uom.name, async (p) => {
        await fillByLabel(p, 'UOM Name', uom.name);
        await fillByLabel(p, 'Symbol', uom.symbol);
      }));
    }
    report('UOMs', results);
  });

  test('Attributes', async ({ page }) => {
    const results = [];
    for (const attr of ATTRIBUTES) {
      results.push(await ensureMasterRecord(page, 'Attributes', attr.name, async (p) => {
        await fillByLabel(p, 'Attribute Name', attr.name);
        await selectByLabel(p, 'Data Type', DATA_TYPE_LABEL[attr.dataType]);
      }));
    }
    report('Attributes', results);
  });

  test('Categories', async ({ page }) => {
    const results = [];
    for (const cat of CATEGORIES) {
      results.push(await ensureMasterRecord(page, 'Categories', cat.name, async (p) => {
        await fillByLabel(p, 'Category Name', cat.name);
        await fillByLabel(p, 'Description', cat.description);
      }));
    }
    report('Categories', results);
  });

  test('Sub Categories', async ({ page }) => {
    const results = [];
    for (const sub of SUB_CATEGORIES) {
      results.push(await ensureMasterRecord(page, 'Sub Categories', sub.name, async (p) => {
        await selectByLabel(p, 'Parent Category', sub.category);
        await fillByLabel(p, 'Sub Category Name', sub.name);
      }));
    }
    report('Sub Categories', results);
  });

  test('Item Types', async ({ page }) => {
    const results = [];
    for (const type of ITEM_TYPES) {
      results.push(await ensureMasterRecord(page, 'Item Types', type.name, async (p) => {
        await selectByLabel(p, 'Sub Category', type.subCategory);
        await fillByLabel(p, 'Item Type Name', type.name);
        await multiSelectByLabel(p, 'Attributes', type.attributes);
        // This form lists UOMs by name, unlike the Item form which uses symbols.
        await multiSelectByLabel(p, 'Units of Measure', type.uoms.map((s) => UOM_NAME_BY_SYMBOL[s]));
      }));
    }
    report('Item Types', results);
  });

  // Items are split by category so each test stays comfortably inside the timeout
  // and a failure points at a specific group.
  for (const category of ['Fabric', 'Local Trims', 'Imported Trims', 'Packing Materials']) {
    test(`Items — ${category}`, async ({ page }) => {
      const results = [];
      for (const item of ITEMS.filter((i) => i.category === category)) {
        results.push(await createItem(page, item));
      }
      report(`Items (${category})`, results);
    });
  }

  test('Buyers', async ({ page }) => {
    const results = [];
    for (const buyer of BUYERS) {
      results.push(await ensureMasterRecord(page, 'Buyers', buyer.name, async (p) => {
        const modal = dialog(p);
        await fillByLabel(p, 'Buyer Name', buyer.name, modal);
        await fillByLabel(p, 'Contact Person', 'Sourcing Manager', modal);
        await fillByLabel(p, 'Email', buyer.email, modal);
        await fillByLabel(p, 'Phone', buyer.phone, modal);

        // At least one shipping location is mandatory; it is captured in a nested modal.
        await modal.locator('button').filter({ hasText: /Add Shipping Location/i }).click();
        // Scope on a field unique to the nested modal — the outer buyer modal also
        // contains the text "Add Shipping Location" (its trigger button).
        const loc = p.locator('.ant-modal').filter({ hasText: 'Location Label' }).first();
        await expect(loc).toBeVisible({ timeout: 10000 });
        await fillByLabel(p, 'Location Label', buyer.location.label, loc);
        await fillByLabel(p, 'Address', buyer.location.address, loc);
        await selectByLabel(p, 'Country', buyer.location.country, loc);
        await fillByLabel(p, 'Postal Code', buyer.location.postalCode, loc);
        await fillByLabel(p, 'City', buyer.location.city, loc);
        await fillByLabel(p, 'State / Province', buyer.location.state, loc);
        await loc.locator('button').filter({ hasText: /^Add$/ }).first().click();
        await expect(loc).toBeHidden({ timeout: 10000 });
      }));
    }
    report('Buyers', results);
  });

  test('Suppliers', async ({ page }) => {
    const results = [];
    for (const sup of SUPPLIERS) {
      results.push(await ensureMasterRecord(page, 'Suppliers', sup.name, async (p) => {
        const modal = dialog(p);
        await fillByLabel(p, 'Supplier Name', sup.name, modal);
        await fillByLabel(p, 'Contact Person', 'Sales Manager', modal);
        await fillByLabel(p, 'Email', sup.email, modal);
        await fillByLabel(p, 'Phone Number', sup.phone, modal);
        await fillByLabel(p, 'Address', sup.address, modal);
        await fillByLabel(p, 'Pincode', sup.pincode, modal);
        await fillByLabel(p, 'City', sup.city, modal);
        await fillByLabel(p, 'State', sup.state, modal);
        await fillByLabel(p, 'Country', 'India', modal);
        await fillByLabel(p, 'PAN', sup.pan, modal);
        await fillByLabel(p, 'GSTIN', sup.gstin, modal);
        await checkByText(p, sup.supplies === 'Fabric' ? 'Fabric' : 'Trims', modal);
      }));
    }
    report('Suppliers', results);
  });

  test('Size Presets', async ({ page }) => {
    const results = [];
    for (const preset of SIZE_PRESETS) {
      results.push(await ensureMasterRecord(page, 'Size Presets', preset.name, async (p) => {
        await fillByLabel(p, 'Preset Name', preset.name);
        await fillTagsByLabel(p, 'Sizes', preset.sizes);
      }));
    }
    report('Size Presets', results);
  });

  test('Styles', async ({ page }) => {
    const results = [];
    for (const style of STYLES) {
      results.push(await ensureMasterRecord(page, 'Styles', style.styleNo, async (p) => {
        await fillByLabel(p, 'Style No', style.styleNo);
        await fillByLabel(p, 'Garment Name', style.name);
        await selectByLabel(p, 'Buyer', style.buyer);
        await selectByLabel(p, 'Season', style.seasonLabel);
        await selectByLabel(p, 'Year', style.seasonYear);
        await fillByLabel(p, 'Fabric Description', style.description);
      }));
    }
    report('Styles', results);
  });

  test('Payment Terms', async ({ page }) => {
    const results = [];
    for (const term of PAYMENT_TERMS) {
      results.push(await ensureMasterRecord(page, 'Payment Terms', term.name, async (p) => {
        await fillByLabel(p, 'Name', term.name);
        await fillByLabel(p, 'Description', term.description);
        await fillByLabel(p, 'Payment Days', String(term.days));
      }));
    }
    report('Payment Terms', results);
  });

  test('Terms & Conditions', async ({ page }) => {
    const results = [];
    for (const tc of TERMS_CONDITIONS) {
      results.push(await ensureMasterRecord(page, 'Terms & Conditions', tc.title, async (p) => {
        await fillByLabel(p, 'Title', tc.title);
        await fillRichText(p, tc.content);
      }));
    }
    report('Terms & Conditions', results);
  });

  test('Overheads', async ({ page }) => {
    const results = [];
    for (const oh of OVERHEADS) {
      results.push(await ensureMasterRecord(page, 'Overheads', oh.name, async (p) => {
        await fillByLabel(p, 'Overhead Name', oh.name);
        await fillByLabel(p, 'Default Cost', String(oh.defaultCost));
      }));
    }
    report('Overheads', results);
  });

  test('Processes', async ({ page }) => {
    const results = [];
    // Manufacturing + Overheads processes both live here; the category value is what
    // the cost sheet filters on (bug B-017).
    for (const proc of [...PROCESSES, ...OVERHEADS.map((o) => ({ name: o.name, type: 'Overheads', defaultCost: o.defaultCost }))]) {
      results.push(await ensureMasterRecord(page, 'Processes', proc.name, async (p) => {
        await fillByLabel(p, 'Process Name', proc.name);
        await selectByLabel(p, 'Category', proc.type);
        await fillByLabel(p, 'Default Cost', String(proc.defaultCost));
      }));
    }
    report('Processes', results);
  });

  test('Parts', async ({ page }) => {
    const results = [];
    for (const part of PARTS) {
      results.push(await ensureMasterRecord(page, 'Parts', part.name, async (p) => {
        await fillByLabel(p, 'Part Name', part.name);
      }));
    }
    report('Parts', results);
  });

  test('Defect Types', async ({ page }) => {
    const results = [];
    for (const defect of DEFECT_TYPES) {
      results.push(await ensureMasterRecord(page, 'Defect Types', defect.name, async (p) => {
        await fillByLabel(p, 'Name', defect.name);
        await fillByLabel(p, 'Description', `${defect.severity} ${defect.category.toLowerCase()} defect`);
      }));
    }
    report('Defect Types', results);
  });

  test('Trims QC Criteria', async ({ page }) => {
    const results = [];
    for (const crit of TRIMS_QC_CRITERIA) {
      results.push(await ensureMasterRecord(page, 'Trims QC Criteria', crit.name, async (p) => {
        await fillByLabel(p, 'Name', crit.name);
        await fillByLabel(p, 'Description', crit.description);
      }));
    }
    report('Trims QC Criteria', results);
  });
});

/**
 * Create one item with all its variants through the Item modal.
 * The item's display name is derived server-side, so the exists-check uses that.
 */
/**
 * Is this item already in the list?
 *
 * The Items list has no "Item Name" column — it renders Category, Subcategory and Item
 * Type as separate cells. Matching a row against the derived "Category / Sub / Type"
 * string therefore never matched anything, so the check always reported "not present"
 * and every run tried to re-create items that already existed. Match the three cells
 * the list actually renders instead.
 */
function itemRowExists(page, item) {
  return page
    .locator('.ant-table-row')
    .filter({ hasText: item.category })
    .filter({ hasText: item.subCategory })
    .filter({ hasText: item.itemType })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 })
    .then(() => true)
    .catch(() => false);
}

async function createItem(page, item) {
  await goToMasterEntity(page, 'Items');
  await waitForPageReady(page);
  // Search by the first VARIANT name, not the derived item name: ItemSpecification
  // matches only variant code/name, so a derived-name search always returns nothing
  // and the exists-check would wrongly report "not present" (bug B-014).
  //
  // Unlike the split-view screens (which filter client-side), the Items list queries
  // the server, so wait for the row rather than sampling immediately.
  await searchMasterList(page, item.variants[0].name);
  const alreadyExists = await itemRowExists(page, item);
  if (alreadyExists) return 'skipped';

  await openAddForm(page);
  const modal = dialog(page);
  await expect(modal).toBeVisible({ timeout: 15000 });

  await selectByLabel(page, 'Category', item.category, modal);
  await selectByLabel(page, 'Subcategory', item.subCategory, modal);
  await selectByLabel(page, 'Item Type', item.itemType, modal);
  await page.waitForTimeout(700);

  await selectByLabel(page, 'Primary UOM', item.uom, modal);
  if (item.secondaryUom) {
    await selectByLabel(page, 'Secondary UOM', item.secondaryUom, modal);
    // Required whenever the secondary UOM differs from the primary.
    await modal.getByPlaceholder('e.g. 144').fill(String(item.conversionFactor));
  }

  await fillByLabel(page, 'HSN Code', item.hsnCode, modal);
  await fillByLabel(page, 'Allowance', String(item.allowance), modal);
  await fillByLabel(page, 'Description', item.description, modal);

  for (const [idx, variant] of item.variants.entries()) {
    if (idx > 0) {
      await modal.locator('button').filter({ hasText: /Add Variant/i }).click();
      await page.waitForTimeout(400);
    }
    await fillByLabel(page, 'Variant Name', variant.name, modal);
    for (const [attrName, value] of Object.entries(variant.attrs)) {
      const input = formField(page, attrName, modal).locator('input:not([type="hidden"])').first();
      if (await input.count()) {
        await input.fill(String(value));
        await page.waitForTimeout(120);
      }
    }
  }

  await modal.locator('button').filter({ hasText: /^Save$|^Create$/i }).first().click();
  await expect(
    page.locator('.ant-message-notice').filter({ hasText: /Item (created|updated) successfully/i })
  ).toBeVisible({ timeout: 20000 });
  await expectNoErrorToast(page);

  return 'created';
}
