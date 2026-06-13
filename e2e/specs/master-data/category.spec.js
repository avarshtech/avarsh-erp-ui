/**
 * Category Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip
 *   - List: Name/Description columns, search by name AND description, Total footer
 *   - Create: required validation (name), all fields saved
 *   - Duplicate-name guard (trim + case-insensitive): "Category with this name already exists"
 *   - Edit via ROW CLICK (split-view, no per-row icons) with 400ms dirty-suppression settle;
 *     "Save Changes" disabled in edit until dirty
 *   - Delete via form Delete button + confirm modal "Delete Category" (hard DELETE)
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §7
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { categoryPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe.serial('Category — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/categories');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = categoryPayload();
      const { response, data } = await api.post('/categories', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      expect(data.description).toBe(payload.description);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const payload = categoryPayload();
      payload.description = 'Updated by E2E';
      const { response, data } = await api.put(`/categories/${createdId}`, { ...payload, version: 0 });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record (hard delete)', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/categories/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let seedName;
    let seedDesc;
    let seedId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      // Seed a known record so the search test is deterministic
      seedName = `E2E SearchCat ${STAMP()}`;
      seedDesc = `zzfindme${STAMP()}`;
      const { data } = await api.post('/categories', categoryPayload({ name: seedName, description: seedDesc }));
      seedId = data?.id;
    });

    test.afterAll(async () => {
      if (seedId) await api.delete(`/categories/${seedId}`).catch(() => {});
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Categories');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name and description, Total footer', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      // search by name (client-side, per keystroke)
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      await search.fill(seedName);
      const byName = await page.locator('.ant-table-row').count();
      expect(byName).toBeGreaterThanOrEqual(1);
      expect(byName).toBeLessThanOrEqual(total);
      await expect(page.locator('.ant-table-row').filter({ hasText: seedName })).toBeVisible();

      // search by description (description is part of the search scope)
      await search.fill(seedDesc);
      await expect(page.locator('.ant-table-row').filter({ hasText: seedName })).toBeVisible();

      // clear restores full list
      await search.clear();
      expect(await page.locator('.ant-table-row').count()).toBe(total);
    });

    test('Create: required validation, all fields saved', async ({ page }) => {
      const name = `E2E Category ${STAMP()}`;
      const description = 'Created by E2E UI test';
      await page.getByRole('button', { name: /Add Category/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation (description is optional — only name errors)
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter category name/i)).toBeVisible();

      // all fields
      await page.locator('#name').fill(name);
      await page.locator('#description').fill(description);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/api\/v1\/categories$/.test(r.url()) && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.getByText(/category created successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(description)).toBeVisible(); // Description column populated
    });

    test('Create: duplicate name blocked (case-insensitive)', async ({ page }) => {
      const name = `E2E DupCat ${STAMP()}`;
      await page.getByRole('button', { name: /Add Category/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add Category/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name.toUpperCase());
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/category with this name already exists/i)).toBeVisible({ timeout: 8000 });
    });

    test('Edit via row click: Save disabled until dirty, change all fields and persist', async ({ page }) => {
      const name = `E2E EditCat ${STAMP()}`;
      const renamed = `${name} v2`;
      const newDesc = 'Updated description by E2E';
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add Category/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await page.locator('#description').fill('initial description');
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression
      // Save Changes is disabled in edit mode until a change registers
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      await page.locator('#name').fill(renamed);
      await page.locator('#description').fill(newDesc);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/categories\/\d+$/.test(r.url()) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      await expect(page.getByText(/category updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText(newDesc)).toBeVisible();
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelCat ${STAMP()}`;
      await page.getByRole('button', { name: /Add Category/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/categories$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.getByRole('dialog', { name: /delete category/i });
      await expect(confirm).toBeVisible();
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/categories\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await expect(page.getByText(/category deleted successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
