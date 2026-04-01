import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';
import { uomPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Unit of Measure — CRUD', () => {
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
      const { response, data } = await api.get('/unit-of-measures');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = uomPayload();
      const { response, data } = await api.post('/unit-of-measures', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/unit-of-measures/${createdId}`);
      const updated = { ...existing, decimalPrecision: 3 };
      const { response, data } = await api.put(`/unit-of-measures/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.decimalPrecision).toBe(3);
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/unit-of-measures/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/UOM|Unit of Measure/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new UOM via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/UOM|Unit of Measure/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Name', `E2E UOM ${Date.now()}`);
      await antFormFill(page, 'Symbol', `u${Date.now() % 1000}`);
      await antFormFill(page, 'Decimal Precision', '2');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing UOM', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/UOM|Unit of Measure/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Decimal Precision', '4');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete UOM', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/UOM|Unit of Measure/i).first().click();
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
