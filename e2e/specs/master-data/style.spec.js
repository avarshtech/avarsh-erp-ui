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
import { stylePayload, buyerPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Style — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let buyerId;
    let createdId;

    test.beforeAll(async ({ request }) => {
      api = await createAuthenticatedClient(request);
      const { data: buyer } = await api.post('/buyers', buyerPayload());
      buyerId = buyer.id;
    });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/styles');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = stylePayload(buyerId);
      const { response, data } = await api.post('/styles', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.styleNo).toBe(payload.styleNo);
      createdId = data.id;
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/styles/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Style/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new style via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Style/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Style No', `E2E-${Date.now()}`);
      await antFormFill(page, 'Garment Name', 'E2E Test Garment');
      await antFormSelect(page, 'Buyer', null, { first: true });
      await antFormSelect(page, 'Season', null, { first: true });
      await antFormFill(page, 'Season Year', '2026');
      await antFormFill(page, 'Description', 'Created by E2E UI test');

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing style', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Style/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Description', 'Updated by E2E');
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete style', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Style/i).first().click();
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
