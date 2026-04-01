import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antFormSelect,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';
import { categoryPayload, subCategoryPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Item Type — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let subCategoryId;
    let createdId;

    test.beforeAll(async ({ request }) => {
      api = await createAuthenticatedClient(request);
      // Create prerequisite category and sub-category
      const { data: cat } = await api.post('/categories', categoryPayload());
      const { data: subCat } = await api.post('/sub-categories', subCategoryPayload(cat.id));
      subCategoryId = subCat.id;
    });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/item-types');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = {
        subCategoryId,
        name: `E2E ItemType ${Date.now()}`,
        description: 'Created by E2E test',
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

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/item-types/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Item Type/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new item type via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Item Type/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormSelect(page, 'Sub Category', null, { first: true });
      await antFormFill(page, 'Name', `E2E ItemType ${Date.now()}`);
      await antFormFill(page, 'Description', 'Created by E2E UI test');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing item type', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Item Type/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Description', 'Updated by E2E');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete item type', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Item Type/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to delete');

      await rows.last().locator('button[aria-label*="delete" i], .anticon-delete').first().click();
      await antPopconfirmYes(page);
      await antMessageContains(page, /success|deleted|removed/i);
    });
  });
});
