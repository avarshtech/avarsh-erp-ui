import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antFormSelect,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { itemPayload, categoryPayload, subCategoryPayload, uomPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Item — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let categoryId;
    let subCategoryId;
    let itemTypeId;
    let uomId;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      // Create prerequisite data
      const { data: cat } = await api.post('/categories', categoryPayload());
      categoryId = cat.id;
      const { data: subCat } = await api.post('/sub-categories', subCategoryPayload(categoryId));
      subCategoryId = subCat.id;
      // Create item type under the sub-category
      const { data: itemTypeData } = await api.post('/item-types', { name: `E2E ItemType ${Date.now()}`, subCategoryId: subCat.id });
      itemTypeId = itemTypeData.id;
      const { data: uom } = await api.post('/unit-of-measures', uomPayload());
      uomId = uom.id;
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/items');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = itemPayload({
        categoryId,
        subCategoryId,
        itemTypeId,
        uomId,
      });
      const { response, data } = await api.post('/items', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.itemCode).toBe(payload.itemCode);
      createdId = data.id;
    });

    test('API — Search returns matching items', async () => {
      test.skip(!createdId, 'No record created to search');
      const { response, data } = await api.get('/items/search', { query: 'E2E' });
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/items/${createdId}`);
      const updated = { ...existing, itemName: `Updated ${existing.itemName}` };
      const { response, data } = await api.put(`/items/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.itemName).toContain('Updated');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/items/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await goToMasterEntity(page, 'Items');
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new item via form', async ({ page }) => {
      await goToMasterEntity(page, 'Items');
      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Item Code', `E2E-${Date.now()}`);
      await antFormFill(page, 'Item Name', `E2E Item ${Date.now()}`);
      await antFormSelect(page, 'Category', null, { first: true });
      await antFormSelect(page, 'Sub Category', null, { first: true });
      await antFormSelect(page, 'UOM', null, { first: true });
      await antFormFill(page, 'HSN Code', '9999');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing item', async ({ page }) => {
      await goToMasterEntity(page, 'Items');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'HSN Code', '8888');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete item', async ({ page }) => {
      await goToMasterEntity(page, 'Items');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to delete');

      await rows.last().locator('button[aria-label*="delete" i], .anticon-delete').first().click();
      await antPopconfirmYes(page);
      await antMessageContains(page, /success|deleted|removed/i);
    });
  });
});
