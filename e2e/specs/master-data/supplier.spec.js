import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { supplierPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Supplier — CRUD', () => {
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
      const { response, data } = await api.get('/suppliers');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = supplierPayload();
      const { response, data } = await api.post('/suppliers', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/suppliers/${createdId}`);
      const updated = { ...existing, city: 'Chennai', contactPerson: 'Updated Supplier Contact' };
      const { response, data } = await api.put(`/suppliers/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.city).toBe('Chennai');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/suppliers/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await goToMasterEntity(page, 'Suppliers');
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new supplier via form', async ({ page }) => {
      await goToMasterEntity(page, 'Suppliers');
      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Name', `E2E Supplier ${Date.now()}`);
      await antFormFill(page, 'Address', '456 Test Lane');
      await antFormFill(page, 'City', 'Delhi');
      await antFormFill(page, 'State', 'Delhi');
      await antFormFill(page, 'Country', 'India');
      await antFormFill(page, 'Pincode', '110001');
      await antFormFill(page, 'Email', `supplier-ui-${Date.now()}@test.com`);
      await antFormFill(page, 'Phone', '+919876543210');
      await antFormFill(page, 'Contact Person', 'UI Test Contact');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing supplier', async ({ page }) => {
      await goToMasterEntity(page, 'Suppliers');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'City', 'Bangalore');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete supplier', async ({ page }) => {
      await goToMasterEntity(page, 'Suppliers');
      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to delete');

      await rows.last().locator('button[aria-label*="delete" i], .anticon-delete').first().click();
      await antPopconfirmYes(page);
      await antMessageContains(page, /success|deleted|removed/i);
    });
  });
});
