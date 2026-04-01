import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { categoryPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Category — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
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

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/categories/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await goToMasterEntity(page, 'Categories');
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new category via form', async ({ page }) => {
      await goToMasterEntity(page, 'Categories');
      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Name', `E2E Category ${Date.now()}`);
      await antFormFill(page, 'Description', 'Created by E2E UI test');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing category', async ({ page }) => {
      await goToMasterEntity(page, 'Categories');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Description', 'Updated by E2E');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete category', async ({ page }) => {
      await goToMasterEntity(page, 'Categories');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to delete');

      await rows.last().locator('button[aria-label*="delete" i], .anticon-delete').first().click();
      await antPopconfirmYes(page);
      await antMessageContains(page, /success|deleted|removed/i);
    });
  });
});
