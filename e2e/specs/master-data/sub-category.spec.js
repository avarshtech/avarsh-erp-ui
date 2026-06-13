/**
 * Sub-Category Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (parent Category seeded via API)
 *   - List: Name/Category columns, search by name AND parent category name, Total footer
 *   - Create: required validation (categoryId + name), cascade — Parent Category Select
 *     (showSearch, NEVER fill()) must be picked before save; all fields saved
 *   - Duplicate-name guard SCOPED to the same category: blocked in same category,
 *     allowed under a different category
 *   - Edit via ROW CLICK (split-view, no per-row icons) with 400ms dirty-suppression settle;
 *     "Save Changes" disabled in edit until dirty; every field changed (category/name/description)
 *   - Delete via form Delete button + confirm modal "Delete Sub-Category" (hard DELETE)
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §8
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { subCategoryPayload, categoryPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/**
 * Pick an option in a showSearch Select by its form label.
 * NEVER fill() a Select — open it, type to filter (avoids virtualized option lists),
 * click the matching option, then Escape to make sure the dropdown is closed.
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

test.describe.serial('Sub-Category — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let categoryId;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      // Ensure a category exists for the sub-category
      const { data: cat } = await api.post('/categories', categoryPayload());
      categoryId = cat.id;
    });

    test.afterAll(async () => {
      if (categoryId) await api.delete(`/categories/${categoryId}`).catch(() => {});
      await api.dispose();
    });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/sub-categories');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = subCategoryPayload(categoryId);
      const { response, data } = await api.post('/sub-categories', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      expect(data.categoryId).toBe(categoryId);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const payload = subCategoryPayload(categoryId);
      payload.description = 'Updated by E2E';
      const { response, data } = await api.put(`/sub-categories/${createdId}`, { ...payload, version: 0 });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record (hard delete)', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/sub-categories/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let catA; // primary parent category (name)
    let catB; // secondary parent category — duplicate-scope + edit-cascade target
    let catAId;
    let catBId;
    let seedSubName; // seeded sub-category for deterministic search
    let seedSubId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      catA = `E2E ParentCat A ${STAMP()}`;
      catB = `E2E ParentCat B ${STAMP()}`;
      const a = await api.post('/categories', categoryPayload({ name: catA }));
      const b = await api.post('/categories', categoryPayload({ name: catB }));
      catAId = a.data?.id;
      catBId = b.data?.id;

      seedSubName = `E2E SearchSub ${STAMP()}`;
      const seed = await api.post('/sub-categories', subCategoryPayload(catAId, { name: seedSubName }));
      seedSubId = seed.data?.id;
    });

    test.afterAll(async () => {
      // best-effort cleanup, children first (hard deletes; FK failures swallowed)
      if (seedSubId) await api.delete(`/sub-categories/${seedSubId}`).catch(() => {});
      if (catAId) await api.delete(`/categories/${catAId}`).catch(() => {});
      if (catBId) await api.delete(`/categories/${catBId}`).catch(() => {});
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Sub Categories');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name and parent category, Total footer', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      // search by sub-category name (client-side, per keystroke)
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      await search.fill(seedSubName);
      const byName = await page.locator('.ant-table-row').count();
      expect(byName).toBeGreaterThanOrEqual(1);
      expect(byName).toBeLessThanOrEqual(total);
      await expect(page.locator('.ant-table-row').filter({ hasText: seedSubName })).toBeVisible();

      // search by PARENT CATEGORY name (search scope includes resolved category name)
      await search.fill(catA);
      await expect(page.locator('.ant-table-row').filter({ hasText: seedSubName })).toBeVisible();

      // clear restores full list
      await search.clear();
      expect(await page.locator('.ant-table-row').count()).toBe(total);
    });

    test('Create: required validation, cascade Parent Category select, all fields saved', async ({ page }) => {
      const name = `E2E SubCat ${STAMP()}`;
      const description = 'Created by E2E UI test';
      await page.getByRole('button', { name: /Add Sub Category/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation — both category and name (description optional)
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please select a category/i)).toBeVisible();
      await expect(page.getByText(/please enter name/i)).toBeVisible();

      // all fields — Parent Category is a readonly combobox: pick via dropdown, never fill()
      await selectByLabel(page, 'Parent Category', catA);
      await page.locator('#name').fill(name);
      await page.locator('#description').fill(description);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/api\/v1\/sub-categories$/.test(r.url()) && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.getByText(/sub-category created successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(catA)).toBeVisible(); // Category column tag shows parent name
    });

    test('Duplicate name blocked within same category, allowed under another', async ({ page }) => {
      const name = `E2E DupSub ${STAMP()}`;
      // first record under category A
      await page.getByRole('button', { name: /Add Sub Category/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Parent Category', catA);
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // same name (case-insensitive) under the SAME category → blocked
      await page.getByRole('button', { name: /Add Sub Category/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Parent Category', catA);
      await page.locator('#name').fill(name.toUpperCase());
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.getByText(/already exists in the selected category/i),
      ).toBeVisible({ timeout: 8000 });

      // same name under a DIFFERENT category → allowed (duplicate check is scoped)
      await selectByLabel(page, 'Parent Category', catB);
      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      // an earlier success toast may still be fading — match the most recent
      await expect(page.getByText(/sub-category created successfully/i).last()).toBeVisible({ timeout: 8000 });
    });

    test('Edit via row click: Save disabled until dirty, change all fields and persist', async ({ page }) => {
      const name = `E2E EditSub ${STAMP()}`;
      const renamed = `${name} v2`;
      const newDesc = 'Updated description by E2E';
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add Sub Category/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Parent Category', catA);
      await page.locator('#name').fill(name);
      await page.locator('#description').fill('initial description');
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      // change EVERY editable field: parent category, name, description
      await selectByLabel(page, 'Parent Category', catB);
      await page.locator('#name').fill(renamed);
      await page.locator('#description').fill(newDesc);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories\/\d+$/.test(r.url()) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      await expect(page.getByText(/sub-category updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText(catB)).toBeVisible(); // Category tag now shows the new parent
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelSub ${STAMP()}`;
      await page.getByRole('button', { name: /Add Sub Category/i }).click();
      await page.waitForTimeout(400);
      await selectByLabel(page, 'Parent Category', catA);
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.getByRole('dialog', { name: /delete sub-category/i });
      await expect(confirm).toBeVisible();
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/sub-categories\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /^Delete$|^OK$|^Yes$/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await expect(page.getByText(/sub-category deleted successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
