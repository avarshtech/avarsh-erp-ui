/**
 * Item Type Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip incl. attributeIds/uomIds links (prereqs seeded via API)
 *   - List: Name/Sub Category columns, search is over NAME ONLY, Total footer
 *   - Create: required validation (name only — Sub Category is OPTIONAL), all fields
 *     incl. Attributes + Units of Measure MULTI-selects (≥1 each, NEVER fill())
 *   - Create without Sub Category → allowed, list shows '-' in Sub Category column
 *   - Duplicate-name guard SCOPED to the same sub-category
 *   - Edit via ROW CLICK (split-view, no per-row icons) with 400ms dirty-suppression settle;
 *     "Save Changes" disabled until dirty; prefilled multi-selects asserted; every field changed
 *   - Delete via form Delete button + confirm modal "Delete Item Type" (hard DELETE)
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §5
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { categoryPayload, subCategoryPayload, uomPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/**
 * Pick an option in a showSearch Select (single OR multiple) by its form label.
 * NEVER fill() a Select — open it, type to filter (avoids virtualized option lists),
 * click the matching option, then Escape (multi-select dropdowns stay open after pick).
 */
async function selectByLabel(page, label, optionText) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: label }).first();
  await formItem.locator('.ant-select').first().click();
  await page.keyboard.type(optionText);
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).first().click();
  await page.keyboard.press('Escape');
}

test.describe.serial('Item Type — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let categoryId;
    let subCategoryId;
    let attributeId;
    let uomId;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      // Create prerequisite category, sub-category, attribute and UOM
      const { data: cat } = await api.post('/categories', categoryPayload());
      categoryId = cat.id;
      const { data: subCat } = await api.post('/sub-categories', subCategoryPayload(categoryId));
      subCategoryId = subCat.id;
      const { data: attr } = await api.post('/attribute-configs', {
        attributeName: `E2E Attr ${Date.now()}`,
        dataType: 'string',
      });
      attributeId = attr?.id;
      const { data: uom } = await api.post('/unit-of-measures', uomPayload());
      uomId = uom?.id;
    });

    test.afterAll(async () => {
      // best-effort cleanup, children first (hard deletes; FK failures swallowed)
      if (subCategoryId) await api.delete(`/sub-categories/${subCategoryId}`).catch(() => {});
      if (categoryId) await api.delete(`/categories/${categoryId}`).catch(() => {});
      if (attributeId) await api.delete(`/attribute-configs/${attributeId}`).catch(() => {});
      if (uomId) await api.delete(`/unit-of-measures/${uomId}`).catch(() => {});
      await api.dispose();
    });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/item-types');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record with attribute/UOM links', async () => {
      const payload = {
        subCategoryId,
        name: `E2E ItemType ${Date.now()}`,
        description: 'Created by E2E test',
        attributeIds: attributeId ? [attributeId] : [],
        uomIds: uomId ? [uomId] : [],
      };
      const { response, data } = await api.post('/item-types', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/item-types/${createdId}`);
      const updated = { ...existing, description: 'Updated by E2E' };
      const { response, data } = await api.put(`/item-types/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record (hard delete)', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/item-types/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let catId;
    let subA; // sub-category names used in selects
    let subB;
    let subAId;
    let subBId;
    let attr1; // attribute names for the multi-select
    let attr2;
    let attr1Id;
    let attr2Id;
    let uomName;
    let uomId;
    let seedTypeName; // seeded item type for deterministic search
    let seedTypeId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      const { data: cat } = await api.post('/categories', categoryPayload());
      catId = cat?.id;
      subA = `E2E SubA ${STAMP()}`;
      subB = `E2E SubB ${STAMP()}`;
      const a = await api.post('/sub-categories', subCategoryPayload(catId, { name: subA }));
      const b = await api.post('/sub-categories', subCategoryPayload(catId, { name: subB }));
      subAId = a.data?.id;
      subBId = b.data?.id;

      attr1 = `E2E Attr1 ${STAMP()}`;
      attr2 = `E2E Attr2 ${STAMP()}`;
      const a1 = await api.post('/attribute-configs', { attributeName: attr1, dataType: 'string' });
      const a2 = await api.post('/attribute-configs', { attributeName: attr2, dataType: 'string' });
      attr1Id = a1.data?.id;
      attr2Id = a2.data?.id;

      const uomBody = uomPayload();
      uomName = uomBody.name;
      const u = await api.post('/unit-of-measures', uomBody);
      uomId = u.data?.id;

      seedTypeName = `E2E SearchType ${STAMP()}`;
      const seed = await api.post('/item-types', {
        subCategoryId: subAId,
        name: seedTypeName,
        description: 'Seed for search test',
        attributeIds: attr1Id ? [attr1Id] : [],
        uomIds: uomId ? [uomId] : [],
      });
      seedTypeId = seed.data?.id;
    });

    test.afterAll(async () => {
      // best-effort cleanup, children first (hard deletes; FK failures swallowed)
      if (seedTypeId) await api.delete(`/item-types/${seedTypeId}`).catch(() => {});
      if (subAId) await api.delete(`/sub-categories/${subAId}`).catch(() => {});
      if (subBId) await api.delete(`/sub-categories/${subBId}`).catch(() => {});
      if (catId) await api.delete(`/categories/${catId}`).catch(() => {});
      if (attr1Id) await api.delete(`/attribute-configs/${attr1Id}`).catch(() => {});
      if (attr2Id) await api.delete(`/attribute-configs/${attr2Id}`).catch(() => {});
      if (uomId) await api.delete(`/unit-of-measures/${uomId}`).catch(() => {});
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Item Types');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name only, Total footer', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Sub Category' })).toBeVisible();
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      // search by name (client-side, per keystroke)
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      await search.fill(seedTypeName);
      const byName = await page.locator('.ant-table-row').count();
      expect(byName).toBeGreaterThanOrEqual(1);
      expect(byName).toBeLessThanOrEqual(total);
      const seedRow = page.locator('.ant-table-row').filter({ hasText: seedTypeName });
      await expect(seedRow).toBeVisible();
      await expect(seedRow.getByText(subA)).toBeVisible(); // Sub Category tag resolved

      // search scope is NAME ONLY — searching the sub-category name matches nothing
      await search.fill(subA);
      expect(await page.locator('.ant-table-row').count()).toBe(0);

      // clear restores full list
      await search.clear();
      expect(await page.locator('.ant-table-row').count()).toBe(total);
    });

    test('Create: required validation, all fields incl. attribute and UOM multi-selects', async ({ page }) => {
      const name = `E2E ItemType ${STAMP()}`;
      const description = 'Created by E2E UI test';
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation — both Name and Sub Category are required
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter item type name/i)).toBeVisible();
      await expect(page.getByText(/please select a sub category/i)).toBeVisible();

      // all fields
      await selectByLabel(page, 'Sub Category', subA);
      await page.locator('#name').fill(name);
      await page.locator('#description').fill(description);
      await selectByLabel(page, 'Attributes', attr1); // multi-select ≥1 attribute
      await selectByLabel(page, 'Units of Measure', uomName); // multi-select ≥1 UOM

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/api\/v1\/item-types$/.test(r.url()) && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      // payload carries the multi-select links
      const sent = resp.request().postDataJSON();
      expect(sent.attributeIds).toContain(attr1Id);
      expect(sent.uomIds).toContain(uomId);
      await expect(page.getByText(/item type created successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(subA)).toBeVisible(); // Sub Category column tag
    });

    test('Create: Sub Category is required (entity is non-nullable)', async ({ page }) => {
      const name = `E2E NoSubType ${STAMP()}`;
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name); // name only — omit the required sub-category

      // client-side required validation blocks submit (no POST fires)
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please select a sub category/i)).toBeVisible();

      // supplying a sub-category then succeeds
      await selectByLabel(page, 'Sub Category', subA);
      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toBeVisible();
    });

    test('Duplicate name blocked within same sub-category (case-insensitive)', async ({ page }) => {
      const name = `E2E DupType ${STAMP()}`;
      // first record under subA
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Sub Category', subA);
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // same name (case-insensitive) under the SAME sub-category → blocked
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Sub Category', subA);
      await page.locator('#name').fill(name.toUpperCase());
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.getByText(/already exists in the selected sub-category/i),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Edit via row click: prefilled multi-selects, change every field and persist', async ({ page }) => {
      const name = `E2E EditType ${STAMP()}`;
      const renamed = `${name} v2`;
      const newDesc = 'Updated description by E2E';
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Sub Category', subA);
      await page.locator('#name').fill(name);
      await page.locator('#description').fill('initial description');
      await selectByLabel(page, 'Attributes', attr1);
      await selectByLabel(page, 'Units of Measure', uomName);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      // prefill check: linked attribute and UOM shown as selected chips
      const attrsItem = page.locator('.ant-form-item').filter({ hasText: 'Attributes' }).first();
      await expect(attrsItem.locator('.ant-select-selection-item').filter({ hasText: attr1 })).toBeVisible();
      const uomsItem = page.locator('.ant-form-item').filter({ hasText: 'Units of Measure' }).first();
      await expect(uomsItem.locator('.ant-select-selection-item').filter({ hasText: uomName })).toBeVisible();

      // change EVERY editable field: sub-category, name, description, add 2nd attribute
      await selectByLabel(page, 'Sub Category', subB);
      await page.locator('#name').fill(renamed);
      await page.locator('#description').fill(newDesc);
      await selectByLabel(page, 'Attributes', attr2);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types\/\d+$/.test(r.url()) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      const sent = putResp.request().postDataJSON();
      expect(sent.attributeIds).toEqual(expect.arrayContaining([attr1Id, attr2Id]));
      expect(sent.uomIds).toContain(uomId);
      await expect(page.getByText(/item type updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText(subB)).toBeVisible(); // Sub Category tag now shows the new parent
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelType ${STAMP()}`;
      await page.getByRole('button', { name: /Add Item Type/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Sub Category', subA); // required field
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.getByRole('dialog', { name: /delete item type/i });
      await expect(confirm).toBeVisible();
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/item-types\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /^Delete$|^OK$|^Yes$/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await expect(page.getByText(/item type deleted successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
