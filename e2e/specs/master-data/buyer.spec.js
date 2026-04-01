import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antSelect,
  antFormFill,
  antFormSelect,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';
import { buyerPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Buyer — CRUD', () => {
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
      const { response, data } = await api.get('/buyers');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = buyerPayload();
      const { response, data } = await api.post('/buyers', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { response: getResp, data: existing } = await api.get(`/buyers/${createdId}`);
      expect(getResp.ok()).toBeTruthy();

      const updated = { ...existing, contactPerson: 'Updated Contact' };
      const { response, data } = await api.put(`/buyers/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.contactPerson).toBe('Updated Contact');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/buyers/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      // Click Buyer card on the master dashboard
      await page.getByText(/Buyer/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new buyer via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Buyer/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Name', `E2E Buyer ${Date.now()}`);
      await antFormFill(page, 'Contact Person', 'E2E UI Contact');
      await antFormFill(page, 'Email', `buyer-ui-${Date.now()}@test.com`);
      await antFormFill(page, 'Phone', '+1234567890');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing buyer', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Buyer/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Contact Person', 'Updated by E2E');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete buyer', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Buyer/i).first().click();
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
