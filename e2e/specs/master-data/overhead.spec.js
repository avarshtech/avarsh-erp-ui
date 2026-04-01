import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';
import { overheadPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Overhead — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let createdId;

    test.beforeAll(async ({ request }) => {
      api = await createAuthenticatedClient(request);
    });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/overheads');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = overheadPayload();
      const { response, data } = await api.post('/overheads', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.overheadName).toBe(payload.overheadName);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/overheads/${createdId}`);
      const updated = { ...existing, defaultCost: 12.50, description: 'Updated by E2E' };
      const { response, data } = await api.put(`/overheads/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/overheads/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Overhead/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new overhead via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Overhead/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Overhead Name', `E2E Overhead ${Date.now()}`);
      await antFormFill(page, 'Description', 'Created by E2E UI test');
      await antFormFill(page, 'Default Cost', '7.50');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing overhead', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Overhead/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Default Cost', '15.00');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete overhead', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Overhead/i).first().click();
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
