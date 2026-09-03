/**
 * Item Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API: list/search via GET /items/search, create (itemCode is
 *     SERVER-GENERATED — assert itemName echo + truthy itemCode only),
 *     update (PUT), delete (DELETE exists in API even though the UI has none)
 *   - List: columns, server-side filters (category/subcategory/itemType/status)
 *     + Clear, debounced server search
 *   - Row actions: View + Edit only — asserts the DELETE action is ABSENT
 *     (Item Master has no UI delete by design)
 *   - Create (80vw Modal): full cascade categoryId → subCategoryId →
 *     itemTypeId → uomId (children disabled until parent picked), itemName
 *     (no #itemName id — selected via placeholder), primary/secondary UOM,
 *     HSN, defaultAllowance InputNumber, isActive checkbox, variant attribute
 *   - Validation: all required fields
 *   - Cascade clearing: changing category clears children + variants
 *   - Conditional: category containing "fabric" → secondary UOM REQUIRED and
 *     must differ from primary; item type WITHOUT attributes → no variants UI
 *   - Variants: add-variant guard, duplicate-variant guard, multi-variant save
 *   - Item-name autocomplete (edit-by-search) loads an existing item
 *
 * Self-sufficient: seeds 2 full Category→SubCategory→ItemType chains (one
 * "Fabric", one plain with a linked attribute + 2 UOMs) via API in beforeAll.
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §4
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antInputNumberFill } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { itemPayload, categoryPayload, subCategoryPayload, uomPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/** The 80vw Add/Edit Item modal. */
const itemModal = (page) =>
  page.locator('.ant-modal').filter({
    has: page.locator('.ant-modal-title', { hasText: /(Add Item|Edit Item)/ }),
  });

/** Select root for a Form.Item field inside the item modal (input id = field name). */
const modalSelect = (page, fieldId) => itemModal(page).locator(`.ant-select:has(#${fieldId})`);

/** Type-to-filter Select helper (scrolls virtual lists for non-search selects). */
async function antSelectType(page, selectLocator, text) {
  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.type(String(text), { delay: 15 });
  await page.waitForTimeout(150);
  const byTitle = dropdown.locator(`.ant-select-item-option[title="${text}"]`).first();
  const byText = dropdown.locator('.ant-select-item-option').filter({ hasText: String(text) }).first();
  let option = (await byTitle.count()) ? byTitle : byText;
  for (let i = 0; i < 30 && !(await option.isVisible().catch(() => false)); i++) {
    await dropdown
      .locator('.rc-virtual-list-holder')
      .evaluate((el) => { el.scrollTop += 150; })
      .catch(() => {});
    await page.waitForTimeout(50);
    option = (await byTitle.count()) ? byTitle : byText;
  }
  await option.click();
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Open the Add Item modal and wait for /items/meta to resolve (skeleton gone). */
async function openAddItem(page) {
  await page.getByRole('button', { name: /Add Item/i }).first().click();
  const modal = itemModal(page);
  await modal.locator('#categoryId').waitFor({ state: 'visible', timeout: 20000 });
  return modal;
}

/** Select the full Category → Subcategory → Item Type cascade. */
async function pickChain(page, chain) {
  await antSelectType(page, modalSelect(page, 'categoryId'), chain.cat);
  await antSelectType(page, modalSelect(page, 'subCategoryId'), chain.sub);
  await antSelectType(page, modalSelect(page, 'itemTypeId'), chain.type);
}

/** Close the item modal, discarding the unsaved-changes confirm if it appears. */
async function cancelItemModal(page) {
  await itemModal(page).getByRole('button', { name: /Cancel/i }).click();
  // Unsaved-changes confirm uses "Discard" or "Discard & Continue"
  const discard = page.getByRole('button', { name: /Discard/i });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await discard.click();
  }
}

/** Server search with debounce (400ms) — waits for the matching /items/search response. */
async function searchItems(page, text) {
  // axios may serialize spaces as '+' — normalize before comparing
  const normUrl = (u) => decodeURIComponent(u.replace(/\+/g, ' '));
  await Promise.all([
    page.waitForResponse(
      (r) => normUrl(r.url()).includes('/items/search')
        && normUrl(r.url()).includes(`search=${text}`),
      { timeout: 15000 },
    ),
    page.getByPlaceholder('Search items...').fill(text),
  ]);
  await antTableWaitForData(page);
}

test.describe.serial('Item — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let categoryId;
    let subCategoryId;
    let itemTypeId;
    let uomId;
    let createdId;
    let createdItem;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      const { data: cat } = await api.post('/categories', categoryPayload());
      categoryId = cat.id;
      const { data: subCat } = await api.post('/sub-categories', subCategoryPayload(categoryId));
      subCategoryId = subCat.id;
      const { data: uom } = await api.post('/unit-of-measures', uomPayload());
      uomId = uom.id;
      const { data: itemTypeData } = await api.post('/item-types', {
        name: `E2E ItemType ${Date.now()}`,
        subCategoryId,
        uomIds: [uomId],
      });
      itemTypeId = itemTypeData.id;
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data (paged /items/search)', async () => {
      const { response, data } = await api.get('/items/search', { page: 0, size: 10 });
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record (itemCode is server-generated)', async () => {
      const payload = itemPayload({ categoryId, subCategoryId, itemTypeId, uomId });
      const { response, data } = await api.post('/items', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      // Since the Item Master refactor, itemName is DERIVED server-side as
      // "Category / Sub-Category / Item Type" — the client-sent name is ignored.
      expect(data.itemName).toContain(' / ');
      expect(data.itemName).toContain('E2E');
      expect(data.itemCode).toBeTruthy();           // generated — never assert a client value
      createdId = data.id;
      createdItem = data;
    });

    test('API — Search returns matching items', async () => {
      test.skip(!createdId, 'No record created to search');
      const { response, data } = await api.get('/items/search', { page: 0, size: 10, search: 'E2E' });
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      // itemName is DERIVED from the classifier triple since the refactor — it cannot
      // be edited. Update a real field instead and assert the derived name survives.
      const updated = { ...createdItem, description: `Updated ${Date.now()}` };
      const { response, data } = await api.put(`/items/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.description).toContain('Updated');
      expect(data.itemName).toContain(' / ');
    });

    test('API — Delete removes record (API-only; the UI exposes no delete)', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/items/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    const S = STAMP();
    const attrName = `Shade${S}`;
    let uomA;
    let uomB;
    let plain = {}; // { catId, cat, subId, sub, typeId, type }
    let plainB = {}; // same chain, second item type — free triple for the create test
    let plainC = {}; // free triple for the cascade test
    let plainD = {}; // free triple for the variants test
    let fabric = {};
    let seedItem;   // pre-existing item (with one variant) for search/filter/edit/autocomplete

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();

      const { data: attr } = await api.post('/attribute-configs', { attributeName: attrName, dataType: 'string' });
      ({ data: uomA } = await api.post('/unit-of-measures', uomPayload({ name: `E2E UomA ${S}`, symbol: `a${S.slice(-3)}` })));
      ({ data: uomB } = await api.post('/unit-of-measures', uomPayload({ name: `E2E UomB ${S}`, symbol: `b${S.slice(-3)}` })));

      // plain chain: item type WITH attribute (variants UI) + 2 UOMs
      const { data: pCat } = await api.post('/categories', categoryPayload({ name: `E2E Plain Cat ${S}` }));
      const { data: pSub } = await api.post('/sub-categories', subCategoryPayload(pCat.id, { name: `E2E Plain Sub ${S}` }));
      const { data: pType } = await api.post('/item-types', {
        name: `E2E Plain Type ${S}`,
        subCategoryId: pSub.id,
        attributeIds: [attr.id],
        uomIds: [uomA.id, uomB.id],
      });
      plain = { catId: pCat.id, cat: pCat.name, subId: pSub.id, sub: pSub.name, typeId: pType.id, type: pType.name };

      // A SECOND item type on the same chain, reserved for the UI create test: only
      // one item may exist per Category/Sub-Category/Item Type since the refactor,
      // and the seed item below occupies the first triple.
      const { data: pType2 } = await api.post('/item-types', {
        name: `E2E Plain TypeB ${S}`,
        subCategoryId: pSub.id,
        attributeIds: [attr.id],
        uomIds: [uomA.id, uomB.id],
      });
      plainB = { ...plain, typeId: pType2.id, type: pType2.name };

      // Two more free triples: one per create-path test (cascade, variants). Any test
      // that OPENS the form on a taken triple flips into edit mode instead.
      const { data: pType3 } = await api.post('/item-types', {
        name: `E2E Plain TypeC ${S}`, subCategoryId: pSub.id,
        attributeIds: [attr.id], uomIds: [uomA.id, uomB.id],
      });
      plainC = { ...plain, typeId: pType3.id, type: pType3.name };
      const { data: pType4 } = await api.post('/item-types', {
        name: `E2E Plain TypeD ${S}`, subCategoryId: pSub.id,
        attributeIds: [attr.id], uomIds: [uomA.id, uomB.id],
      });
      plainD = { ...plain, typeId: pType4.id, type: pType4.name };

      // fabric chain: category name contains "Fabric" → secondary UOM required;
      // item type WITHOUT attributes → no variants section
      const { data: fCat } = await api.post('/categories', categoryPayload({ name: `E2E Fabric Cat ${S}` }));
      const { data: fSub } = await api.post('/sub-categories', subCategoryPayload(fCat.id, { name: `E2E Fabric Sub ${S}` }));
      const { data: fType } = await api.post('/item-types', {
        name: `E2E Fabric Type ${S}`,
        subCategoryId: fSub.id,
        attributeIds: [],
        uomIds: [uomA.id, uomB.id],
      });
      fabric = { catId: fCat.id, cat: fCat.name, subId: fSub.id, sub: fSub.name, typeId: fType.id, type: fType.name };

      const seedName = `E2E Seed Item ${S}`;
      const { data: created } = await api.post('/items', itemPayload(
        { categoryId: plain.catId, subCategoryId: plain.subId, itemTypeId: plain.typeId, uomId: uomA.id },
        {
          itemName: seedName, // ignored since the refactor — name derives from the triple
          variants: [{
            // variantName is REQUIRED (>= 5 chars) since the Item Master refactor,
            // and it is what item search matches on — keep it distinctive.
            variantName: `Seed Variant ${S}`,
            isActive: true,
            attributes: { [attrName.toLowerCase()]: 'SeedShade' }, // camelCase("ShadeNNN") === lowercase
          }],
        },
      ));
      seedItem = created;
      expect(seedItem?.id, `seed item create failed: ${JSON.stringify(created).slice(0, 300)}`).toBeTruthy();
      // The searchable identity of the item is its variant, not the derived name.
      seedItem.searchKey = `Seed Variant ${S}`;
    });

    test.afterAll(async () => { await api.dispose(); });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Items');
      await antTableWaitForData(page);
    });

    test('List: columns, View/Edit actions present, NO delete action', async ({ page }) => {
      // Since the refactor the list has NO "Item Name" column — the name is derived
      // and the classifier renders as three separate cells (see bug B-040).
      for (const col of ['Item Code', 'Category', 'Subcategory', 'Item Type', 'UOM', 'Status', 'Created', 'Actions']) {
        // exact — 'Category' would otherwise also match 'Subcategory'
        await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByText(/of \d+ items/)).toBeVisible();

      await searchItems(page, seedItem.searchKey);
      const row = page.locator('.ant-table-row').filter({ hasText: seedItem.itemCode });
      await expect(row).toBeVisible();
      await expect(row.locator('.anticon-eye')).toBeVisible();
      await expect(row.locator('.anticon-edit')).toBeVisible();
      // Item Master deliberately has NO UI delete — assert the action is absent
      await expect(row.locator('.anticon-delete')).toHaveCount(0);
      await expect(page.locator('.ant-table .anticon-delete')).toHaveCount(0);
    });

    test('Search: debounced server-side search finds seeded item', async ({ page }) => {
      await searchItems(page, seedItem.searchKey);
      const row = page.locator('.ant-table-row').filter({ hasText: seedItem.itemCode });
      await expect(row).toBeVisible();
      await expect(row.locator('.ant-tag').first()).not.toBeEmpty(); // server-generated itemCode tag
    });

    test('Filters: each filter fires its query param + Clear resets', async ({ page }) => {
      const filterSelect = (ph) => page.locator('.ant-select').filter({ hasText: ph }).first();
      const waitFiltered = (substr) => page.waitForResponse(
        (r) => decodeURIComponent(r.url()).includes('/items/search') && decodeURIComponent(r.url()).includes(substr),
        { timeout: 15000 },
      );
      // Filter-bar Selects have NO showSearch and the option list is long + virtualized
      // (test data accrues across runs), so pick the FIRST rendered option — enough to
      // prove the filter wires its query param. The Status list (2 options) is used for
      // the seedItem-visible assertion since it is never virtualized.
      const pickFirst = async (ph) => {
        await filterSelect(ph).click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible', timeout: 5000 });
        await dd.locator('.ant-select-item-option').first().click();
        await dd.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      };
      const pickOption = async (ph, title) => {
        await filterSelect(ph).click();
        const dd = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
        await dd.waitFor({ state: 'visible', timeout: 5000 });
        await dd.getByTitle(title, { exact: true }).click();
        await dd.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      };
      const clearAll = async () => {
        const pending = page.waitForResponse(
          (r) => r.url().includes('/items/search') && !r.url().includes('categoryId='),
          { timeout: 15000 },
        );
        // Button accessible name is "clear Clear" (ClearOutlined icon + label)
        await page.getByRole('button', { name: /Clear/i }).click();
        await pending;
      };

      // Status=Active → isActive=true; narrow by search first so the (active) seeded
      // item is deterministically on the page regardless of accumulated data/pagination
      await searchItems(page, seedItem.searchKey);
      let pending = waitFiltered('isActive=true');
      await pickOption('All Status', 'Active');
      await pending;
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: seedItem.itemCode })).toBeVisible();
      await clearAll();

      // Category filter fires categoryId=
      pending = waitFiltered('categoryId=');
      await pickFirst('All Categories');
      await pending;
      await clearAll();

      // Subcategory filter fires subCategoryId=
      pending = waitFiltered('subCategoryId=');
      await pickFirst('All Subcategories');
      await pending;
      await clearAll();

      // Item Type filter fires itemTypeId=
      pending = waitFiltered('itemTypeId=');
      await pickFirst('All Item Types');
      await pending;
      await clearAll();

      // Clear restored placeholders + empty search
      await expect(page.getByText('All Categories')).toBeVisible();
      await expect(page.getByText('All Status')).toBeVisible();
      await expect(page.getByPlaceholder('Search items...')).toHaveValue('');
    });

    test('Create: full cascade enablement, all fields, variant attribute', async ({ page }) => {
      // Uses the RESERVED second item type: one item per classifier triple since the
      // refactor, and the seed item occupies the first one. Picking a taken triple
      // would flip the form into edit mode instead of creating.
      const variantName = `Crimson Variant ${STAMP()}`;
      const modal = await openAddItem(page);

      // children disabled until their parent is picked
      await expect(modalSelect(page, 'subCategoryId')).toHaveClass(/ant-select-disabled/);
      await expect(modalSelect(page, 'itemTypeId')).toHaveClass(/ant-select-disabled/);
      await expect(modalSelect(page, 'uomId')).toHaveClass(/ant-select-disabled/);

      await antSelectType(page, modalSelect(page, 'categoryId'), plainB.cat);
      await expect(modalSelect(page, 'subCategoryId')).not.toHaveClass(/ant-select-disabled/);
      await antSelectType(page, modalSelect(page, 'subCategoryId'), plainB.sub);
      await expect(modalSelect(page, 'itemTypeId')).not.toHaveClass(/ant-select-disabled/);
      await antSelectType(page, modalSelect(page, 'itemTypeId'), plainB.type);
      await expect(modalSelect(page, 'uomId')).not.toHaveClass(/ant-select-disabled/);

      // item type has an attribute → variants section appears with 1 empty variant
      await expect(modal.getByText(/Item Variants \(1\)/)).toBeVisible();

      // The Item Name input is READ-ONLY since the refactor — it mirrors the triple.
      const nameBox = modal.getByPlaceholder('Select Category, Subcategory and Item Type');
      await expect(nameBox).toHaveValue(new RegExp(`${plainB.cat}.*/.*${plainB.sub}.*/.*${plainB.type}`));

      await antSelectType(page, modalSelect(page, 'uomId'), uomA.symbol);
      await antSelectType(page, modalSelect(page, 'secondaryUomId'), uomB.symbol); // non-fabric: optional, needs a factor
      const conversion = modal.getByPlaceholder('e.g. 144');
      if (await conversion.isVisible().catch(() => false)) await conversion.fill('12');
      await modal.locator('#hsnCode').fill('610910');
      await antInputNumberFill(page, '#defaultAllowance', 5.5);
      await expect(modal.locator('#isActive')).toBeChecked(); // default true

      // Variant name is REQUIRED (>= 5 chars) and is the item's searchable identity.
      await modal.getByPlaceholder(/e\.g\. Single Jersey|Variant Name/i).first().fill(variantName);
      await modal.getByPlaceholder(`Enter ${attrName}`).fill('Crimson Red');

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/items') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Item created successfully/i)).toBeVisible({ timeout: 8000 });

      // Search matches the VARIANT name; the row renders classifier cells.
      await searchItems(page, variantName);
      const row = page.locator('.ant-table-row').filter({ hasText: plainB.type });
      await expect(row).toBeVisible();
      await expect(row.locator('.ant-tag').first()).not.toBeEmpty(); // generated item code
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Validation: all required fields on empty submit', async ({ page }) => {
      const modal = await openAddItem(page);
      await modal.getByRole('button', { name: /Save/i }).click();
      for (const msg of [
        'Category is required', 'Subcategory is required', 'Item Type is required',
        // 'Item Name is required' no longer exists — the name is derived, not typed.
        'UOM is required', 'HSN Code is required', 'Allowance is required',
      ]) {
        await expect(page.getByText(msg, { exact: true })).toBeVisible();
      }
    });

    test('Cascade: changing category clears children and removes variants', async ({ page }) => {
      const modal = await openAddItem(page);
      await pickChain(page, { cat: plainC.cat, sub: plainC.sub, type: plainC.type });
      await antSelectType(page, modalSelect(page, 'uomId'), uomA.symbol);
      await expect(modal.getByText(/Item Variants \(/)).toBeVisible();

      // change category → subcategory/itemType/UOMs cleared, variants gone
      await antSelectType(page, modalSelect(page, 'categoryId'), fabric.cat);
      await expect(modalSelect(page, 'subCategoryId').locator('.ant-select-selection-item')).toHaveCount(0);
      await expect(modalSelect(page, 'itemTypeId').locator('.ant-select-selection-item')).toHaveCount(0);
      await expect(modalSelect(page, 'uomId').locator('.ant-select-selection-item')).toHaveCount(0);
      await expect(modal.getByText(/Item Variants \(/)).toBeHidden();

      await cancelItemModal(page);
    });

    test('Conditional: fabric category requires a distinct secondary UOM; no variants without attributes', async ({ page }) => {
      const modal = await openAddItem(page);
      await pickChain(page, { cat: fabric.cat, sub: fabric.sub, type: fabric.type });

      // fabric item type has no attributes → variants section absent
      await expect(modal.getByText(/Item Variants \(/)).toBeHidden();
      // placeholder flips to "(required)" for fabric categories
      await expect(modal.getByText('Select Secondary UOM (required)')).toBeVisible();

      await antSelectType(page, modalSelect(page, 'uomId'), uomA.symbol);
      await modal.locator('#hsnCode').fill('520811');
      await antInputNumberFill(page, '#defaultAllowance', 3);

      // missing secondary UOM → blocked
      await modal.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Secondary UOM is required for fabric items', { exact: true })).toBeVisible();

      // Same as primary: since the refactor this is LEGAL and means "no conversion" —
      // the factor input must NOT appear (server discards the factor for equal UOMs).
      await antSelectType(page, modalSelect(page, 'secondaryUomId'), uomA.symbol);
      await expect(modal.getByPlaceholder('e.g. 144')).toBeHidden();

      // distinct secondary UOM → the conversion factor becomes mandatory (refactor)
      await antSelectType(page, modalSelect(page, 'secondaryUomId'), uomB.symbol);
      const conversion = modal.getByPlaceholder('e.g. 144');
      await expect(conversion).toBeVisible();
      await conversion.fill('3.2');
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/items') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Item created successfully/i)).toBeVisible({ timeout: 8000 });
    });

    test('Variants: add-variant guard, duplicate-variant guard, multi-variant save', async ({ page }) => {
      const S2 = STAMP();
      const modal = await openAddItem(page);
      await pickChain(page, { cat: plainD.cat, sub: plainD.sub, type: plainD.type });
      await antSelectType(page, modalSelect(page, 'uomId'), uomA.symbol);
      await modal.locator('#hsnCode').fill('610910');
      await antInputNumberFill(page, '#defaultAllowance', 2);

      const variantNameBox = () => modal.getByPlaceholder(/e\.g\. Single Jersey|Variant Name/i);

      // guard: cannot add a new variant while the current one is empty
      await modal.getByRole('button', { name: /Add Variant/i }).click();
      await expect(
        page.locator('.ant-message').getByText(/Please fill at least one attribute before adding a new variant/i),
      ).toBeVisible({ timeout: 8000 });

      // fill variant 1 (name is required and unique-in-item since the refactor)
      await variantNameBox().first().fill(`Variant Crimson ${S2}`);
      await modal.getByPlaceholder(`Enter ${attrName}`).fill('Crimson');
      await modal.getByRole('button', { name: /Add Variant/i }).click();
      await expect(modal.getByText(/Item Variants \(2\)/)).toBeVisible();

      // duplicate guard: variant 2 with identical attribute values is blocked
      await variantNameBox().first().fill(`Variant Second ${S2}`);
      await modal.getByPlaceholder(`Enter ${attrName}`).fill('Crimson');
      await modal.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.locator('.ant-message').getByText(/Duplicate variant detected/i),
      ).toBeVisible({ timeout: 8000 });
      await expect(modal.getByText(/This variant has duplicate attribute values/i)).toBeVisible();

      // make variant 2 unique → saves
      await modal.getByPlaceholder(`Enter ${attrName}`).fill('Navy');
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/items') && r.request().method() === 'POST'),
        modal.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Item created successfully/i)).toBeVisible({ timeout: 8000 });
    });

    test('Edit: via row action, Update gated until dirty, variant value round-trips', async ({ page }) => {
      await searchItems(page, seedItem.searchKey);
      await page.locator('.ant-table-row').filter({ hasText: seedItem.itemCode }).locator('.anticon-edit').click();

      const modal = itemModal(page);
      await modal.locator('#categoryId').waitFor({ state: 'visible', timeout: 20000 });
      await expect(modal.getByRole('button', { name: /Update/i })).toBeDisabled(); // gated until dirty

      // seeded variant attribute value resolved back into the form
      await expect(modal.getByPlaceholder(`Enter ${attrName}`)).toHaveValue('SeedShade');

      // HSN (like the classifier triple and UOMs) is LOCKED in edit mode by design —
      // dirty the form through the fields that stay editable.
      await expect(modal.locator('#hsnCode')).toBeDisabled();
      await antInputNumberFill(page, '#defaultAllowance', 7.25);
      await modal.locator('#description').fill('Edited in regression');
      await expect(modal.getByRole('button', { name: /Update/i })).toBeEnabled();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/items\/\d+/.test(r.url()) && r.request().method() === 'PUT'),
        modal.getByRole('button', { name: /Update/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Item updated successfully/i)).toBeVisible({ timeout: 8000 });
    });

    test('Existing-triple lookup: picking a taken combination loads that item for editing', async ({ page }) => {
      // The name-autocomplete was REMOVED in the Item Master refactor (the name is
      // derived, not typed). Its replacement: selecting a Category / Sub-Category /
      // Item Type combination that already has an item fetches that item
      // (GET /items/{id}) and switches the form to edit mode.
      const modal = await openAddItem(page);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/items\/\d+$/.test(r.url()) && r.request().method() === 'GET',
          { timeout: 20000 },
        ),
        pickChain(page, plain), // the seed item's classifier triple
      ]);
      expect(resp.status()).toBeLessThan(300);

      await expect(modal.getByRole('button', { name: /Update/i })).toBeVisible({ timeout: 10000 });
      // The seeded variant hydrates into the form — the variant is the item identity.
      await expect(modal.getByPlaceholder(`Enter ${attrName}`)).toHaveValue('SeedShade', { timeout: 10000 });

      await cancelItemModal(page);
    });
  });
});
