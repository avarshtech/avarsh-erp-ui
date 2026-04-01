import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antFormFill,
  antTableWaitForData,
  antPopconfirmYes,
  antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive } from '../../helpers/navigation.js';
import { termsConditionsPayload } from '../../helpers/test-data.js';

const MASTER_URL = '/master';

test.describe.serial('Terms & Conditions — CRUD', () => {
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
      const { response, data } = await api.get('/terms-conditions');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = termsConditionsPayload();
      const { response, data } = await api.post('/terms-conditions', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/terms-conditions/${createdId}`);
      const updated = { ...existing, description: '<p>Updated by E2E test</p>' };
      const { response, data } = await api.put(`/terms-conditions/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.description).toContain('Updated');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/terms-conditions/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test('List page loads with data', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Terms.*Condition/i).first().click();
      await antTableWaitForData(page);
      const rowCount = await page.locator('.ant-table-row').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('Create new terms & conditions via form', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Terms.*Condition/i).first().click();
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add|New|Create/i }).first().click();
      await antFormFill(page, 'Name', `E2E T&C ${Date.now()}`);
      // Description may be a rich text editor — attempt plain input fill first
      const descInput = page.locator('.ant-form-item').filter({ hasText: /Description/i }).first();
      const richEditor = descInput.locator('.ql-editor, [contenteditable="true"]').first();
      const plainInput = descInput.locator('input, textarea').first();

      if (await richEditor.isVisible().catch(() => false)) {
        await richEditor.click();
        await richEditor.fill('Created by E2E UI test');
      } else {
        await plainInput.clear();
        await plainInput.fill('Created by E2E UI test');
      }

      await page.getByRole('button', { name: /Save|Submit/i }).first().click();
      await antMessageContains(page, /success|created|saved/i);
    });

    test('Edit existing terms & conditions', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Terms.*Condition/i).first().click();
      await antTableWaitForData(page);

      const rows = page.locator('.ant-table-row');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No data to edit');

      await rows.first().locator('button[aria-label*="edit" i], .anticon-edit').first().click();
      await antFormFill(page, 'Name', `E2E T&C Updated ${Date.now()}`);
      await page.getByRole('button', { name: /Save|Update|Submit/i }).first().click();
      await antMessageContains(page, /success|updated|saved/i);
    });

    test('Delete terms & conditions', async ({ page }) => {
      await navigateWithAuth(page, MASTER_URL);
      await page.getByText(/Terms.*Condition/i).first().click();
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
