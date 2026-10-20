/**
 * Item variants — one item per Category / Sub-category / Item Type, one variant per name or
 * attribute set. What this pins:
 *   - Item Master: picking a combination that already has an item loads it WITH its variants,
 *     even when the item type has no attributes, and a new variant can be added and saved —
 *     also on an older fabric saved without a secondary UOM (the field is locked when editing).
 *   - Item Master refuses a variant whose name another variant already has.
 *   - find-or-create (costing): a name in another case, the same attribute values under another
 *     name, and a near-identical classifier name all return what exists instead of a duplicate.
 *
 * Self-sufficient: seeds its own classifier chains and items via the API in beforeAll.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { categoryPayload, subCategoryPayload, uomPayload } from '../../helpers/test-data.js';

const S = Date.now().toString().slice(-6);

const itemModal = (page) =>
  page.locator('.ant-modal').filter({
    has: page.locator('.ant-modal-title', { hasText: /(Add Item|Edit Item)/ }),
  });

async function pick(page, fieldId, text) {
  await itemModal(page).locator(`.ant-select:has(#${fieldId})`).click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.type(text, { delay: 10 });
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Item Master → Add Item → the given chain; an occupied chain switches the form to Edit. */
async function openChain(page, chain) {
  await goToMasterEntity(page, 'Items');
  await page.getByRole('button', { name: /Add Item/i }).first().click();
  await itemModal(page).locator('#categoryId').waitFor({ state: 'visible', timeout: 20000 });
  await pick(page, 'categoryId', chain.cat);
  await pick(page, 'subCategoryId', chain.sub);
  await pick(page, 'itemTypeId', chain.type);
}

test.describe.serial('Item variants — shown for existing items, never duplicated', () => {
  let api;
  let fabric;   // a fabric chain whose item type has NO attributes, with an item of 2 variants
  let shaded;   // a chain whose item type has one attribute, with an item of 1 variant
  let kg;
  let shadeKey;

  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    ({ data: kg } = await api.post('/unit-of-measures', uomPayload({ name: `E2E Kilo ${S}`, symbol: `k${S.slice(-3)}` })));

    const { data: fCat } = await api.post('/categories', categoryPayload({ name: `E2E Fabric Var ${S}` }));
    const { data: fSub } = await api.post('/sub-categories', subCategoryPayload(fCat.id, { name: `E2E Knit Var ${S}` }));
    const { data: fType } = await api.post('/item-types', {
      name: `E2E Jersey Var ${S}`, subCategoryId: fSub.id, attributeIds: [], uomIds: [kg.id],
    });
    // An older fabric: saved without a secondary UOM, which Item Master now requires on create.
    const { data: fItem, status } = await api.post('/items', {
      categoryId: fCat.id, subCategoryId: fSub.id, itemTypeId: fType.id, uomId: kg.id,
      hsnCode: '6006', defaultAllowance: 0, isActive: true,
      variants: [
        { variantName: `Black Jersey ${S}`, isActive: true, attributes: {} },
        { variantName: `White Jersey ${S}`, isActive: true, attributes: {} },
      ],
    });
    expect(status, JSON.stringify(fItem).slice(0, 300)).toBeLessThan(300);
    fabric = { catId: fCat.id, cat: fCat.name, subId: fSub.id, sub: fSub.name, typeId: fType.id, type: fType.name, item: fItem };

    const attrName = `Shade${S}`;
    shadeKey = attrName.toLowerCase(); // one word → lower case, as Item Master keys it
    const { data: attr } = await api.post('/attribute-configs', { attributeName: attrName, dataType: 'string' });
    const { data: sCat } = await api.post('/categories', categoryPayload({ name: `E2E Trims Var ${S}` }));
    const { data: sSub } = await api.post('/sub-categories', subCategoryPayload(sCat.id, { name: `E2E Labels Var ${S}` }));
    const { data: sType } = await api.post('/item-types', {
      name: `E2E Woven Label ${S}`, subCategoryId: sSub.id, attributeIds: [attr.id], uomIds: [kg.id],
    });
    const { data: sItem } = await api.post('/items', {
      categoryId: sCat.id, subCategoryId: sSub.id, itemTypeId: sType.id, uomId: kg.id,
      hsnCode: '5807', defaultAllowance: 0, isActive: true,
      variants: [{ variantName: `Label Jet Black ${S}`, isActive: true, attributes: { [shadeKey]: 'Black' } }],
    });
    shaded = { catId: sCat.id, subId: sSub.id, typeId: sType.id, type: sType.name, attrId: attr.id, item: sItem };
  });

  test.afterAll(async () => { await api?.dispose(); });

  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  test('An existing item shows its variants, and one more can be added and saved', async ({ page }) => {
    await openChain(page, fabric);
    const modal = itemModal(page);
    await expect(modal.locator('.ant-modal-title')).toContainText(`Edit Item - ${fabric.item.itemCode}`);
    await expect(modal.getByText('Item Variants (2)')).toBeVisible();
    await expect(modal.getByText(`Black Jersey ${S}`).first()).toBeVisible();
    await expect(modal.getByText(`White Jersey ${S}`).first()).toBeVisible();

    await modal.getByRole('button', { name: /Add Variant/i }).click();
    await modal.locator('input[name="variantName"]').fill(`Charcoal Jersey ${S}`);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/items/${fabric.item.id}`) && r.request().method() === 'PUT'),
      modal.getByRole('button', { name: /Update/ }).click(),
    ]);
    expect(resp.status()).toBe(200);
    const saved = await resp.json();
    expect(saved.variants.map((v) => v.variantName)).toEqual(
      expect.arrayContaining([`Black Jersey ${S}`, `White Jersey ${S}`, `Charcoal Jersey ${S}`]),
    );
    await expect(modal).toBeHidden();
  });

  test('A variant name the item already has is refused', async ({ page }) => {
    await openChain(page, fabric);
    const modal = itemModal(page);
    await expect(modal.getByText('Item Variants (3)')).toBeVisible();

    let putSent = false;
    page.on('request', (r) => { if (r.method() === 'PUT' && r.url().endsWith(`/items/${fabric.item.id}`)) putSent = true; });
    await modal.getByRole('button', { name: /Add Variant/i }).click();
    await modal.locator('input[name="variantName"]').fill(`  black jersey ${S} `);
    await modal.getByRole('button', { name: /Update/ }).click();

    await expect(page.locator('.ant-message-notice').filter({ hasText: /Duplicate variant name/ })).toBeVisible();
    expect(putSent).toBe(false);
    await expect(modal).toBeVisible();
  });

  test('find-or-create reuses what exists instead of creating a duplicate', async () => {
    const base = { categoryId: fabric.catId, uomId: kg.id, defaultAllowance: 0 };

    // The same name in another case and spacing → the existing variant.
    const byName = await api.post('/items/find-or-create', {
      ...base, clientRef: 'name', subCategoryId: fabric.subId, itemTypeId: fabric.typeId,
      variant: { variantName: `  WHITE jersey ${S}`, attributes: {} },
    });
    expect(byName.status).toBe(200);
    expect(byName.data.variantCreated).toBe(false);
    expect(byName.data.variant.variantName).toBe(`White Jersey ${S}`);

    // Near-identical classifier names ("…-s", other case) → the existing sub-category and item type.
    const byClassifier = await api.post('/items/find-or-create', {
      ...base, clientRef: 'classifier',
      newSubCategoryName: `${fabric.sub.toUpperCase()}-s`,
      newItemType: { name: `${fabric.type}-s`, attributeIds: [shaded.attrId], uomIds: [] },
      variant: { variantName: `Black Jersey ${S}`, attributes: {} },
    });
    expect(byClassifier.status, JSON.stringify(byClassifier.data).slice(0, 300)).toBe(200);
    expect(byClassifier.data.classifiersCreated).toEqual([]);
    expect(byClassifier.data.item.id).toBe(fabric.item.id);
    expect(byClassifier.data.variantCreated).toBe(false);

    // The same attribute values under another name → the existing variant; another value → a new one.
    const shadedBase = {
      categoryId: shaded.catId, subCategoryId: shaded.subId, itemTypeId: shaded.typeId, uomId: kg.id, defaultAllowance: 0,
    };
    const sameShade = await api.post('/items/find-or-create', {
      ...shadedBase, clientRef: 'same', variant: { variantName: `Black Woven Label ${S}`, attributes: { [shadeKey]: ' black ' } },
    });
    expect(sameShade.status).toBe(200);
    expect(sameShade.data.variantCreated).toBe(false);
    expect(sameShade.data.variant.variantName).toBe(`Label Jet Black ${S}`);

    const newShade = await api.post('/items/find-or-create', {
      ...shadedBase, clientRef: 'new', variant: { variantName: `Label Navy ${S}`, attributes: { [shadeKey]: 'Navy' } },
    });
    expect(newShade.status).toBe(201);
    expect(newShade.data.variantCreated).toBe(true);
    expect(newShade.data.item.id).toBe(shaded.item.id);

    // Still one item per combination.
    const { data: items } = await api.get('/items/search', {
      categoryId: fabric.catId, subCategoryId: fabric.subId, itemTypeId: fabric.typeId, size: 10,
    });
    expect((items.content || items).length).toBe(1);
  });
});
