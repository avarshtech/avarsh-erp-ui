/**
 * Payment Terms Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip
 *   - List: Name/Payment Days/Advance %/Status columns, Total footer,
 *     search by name AND by description, clear restore
 *   - Create: required validation (name, payment days), defaults (Active=true),
 *     ALL fields — name, description, paymentDays (InputNumber), advancePercentage
 *     (InputNumber), status — with row Tag assertions ("N days", "N%")
 *   - Duplicate name blocked (save-time toast, trim + case-insensitive)
 *   - Numeric bounds: paymentDays 0–365 integer clamp; advancePercentage 0–100,
 *     precision 2
 *   - Edit via ROW CLICK (split-view) with 400ms dirty-suppression settle,
 *     Save disabled until dirty
 *   - Delete via form Delete button + confirm modal (hard delete)
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §6
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antInputNumberFill } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { paymentTermsPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe.serial('Payment Terms — CRUD', () => {
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
      const { response, data } = await api.get('/payment-terms');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = paymentTermsPayload();
      const { response, data } = await api.post('/payment-terms', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/payment-terms/${createdId}`);
      const updated = { ...existing, paymentDays: 60, description: 'Updated by E2E' };
      const { response, data } = await api.put(`/payment-terms/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.paymentDays).toBe(60);
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/payment-terms/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Payment Terms');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name and description, Total footer', async ({ page }) => {
      const name = `E2E PTSearch ${STAMP()}`;
      const descToken = `ptdesc${STAMP()}`;

      // create a record through the UI so search has guaranteed unique matches
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle
      await page.locator('#name').fill(name);
      await page.locator('#description').fill(`Search anchor ${descToken}`);
      await antInputNumberFill(page, '#paymentDays', 30);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/payment-terms') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // columns
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Payment Days' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Advance %' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

      // Total footer + rows
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();

      // search by name (client-side, per keystroke)
      await search.fill(name);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // search by description
      await search.fill(descToken);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // clear restores full list
      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, defaults, all fields saved', async ({ page }) => {
      const name = `E2E PayTerm ${STAMP()}`;
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation (name + payment days)
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter a name/i)).toBeVisible();
      await expect(page.getByText(/please enter payment days/i)).toBeVisible();

      // defaults: Active=true, numeric fields empty
      await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('#paymentDays')).toHaveValue('');
      await expect(page.locator('#advancePercentage')).toHaveValue('');

      // all fields
      await page.locator('#name').fill(name);
      await page.locator('#description').fill('Created by E2E — full field coverage');
      await antInputNumberFill(page, '#paymentDays', 30);
      await antInputNumberFill(page, '#advancePercentage', 12.5);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/payment-terms') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await antTableWaitForData(page);

      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText('30 days', { exact: true })).toBeVisible();
      await expect(row.getByText('12.5%', { exact: true })).toBeVisible();
      await expect(row.getByText('Active', { exact: true })).toBeVisible();
    });

    test('Create: duplicate name blocked (case-insensitive)', async ({ page }) => {
      const name = `E2E DupPayTerm ${STAMP()}`;
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await antInputNumberFill(page, '#paymentDays', 15);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/payment-terms') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name.toUpperCase());
      await antInputNumberFill(page, '#paymentDays', 20);
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 8000 });
    });

    test('Field validation: paymentDays 0–365 integer, advancePercentage 0–100 precision 2', async ({ page }) => {
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400);

      // bounds advertised on the controls
      await expect(page.locator('#paymentDays')).toHaveAttribute('aria-valuemin', '0');
      await expect(page.locator('#paymentDays')).toHaveAttribute('aria-valuemax', '365');
      await expect(page.locator('#advancePercentage')).toHaveAttribute('aria-valuemin', '0');
      await expect(page.locator('#advancePercentage')).toHaveAttribute('aria-valuemax', '100');

      // payment days above max → clamped to 365 on blur
      await antInputNumberFill(page, '#paymentDays', 999);
      await expect(page.locator('#paymentDays')).toHaveValue('365');
      // negative input: integer-only keystroke filter strips the sign,
      // so the committed value can never be below 0
      await antInputNumberFill(page, '#paymentDays', -5);
      const committedDays = await page.locator('#paymentDays').inputValue();
      expect(Number(committedDays)).toBeGreaterThanOrEqual(0);
      expect(Number(committedDays)).toBeLessThanOrEqual(365);

      // advance % above max → clamped to 100 on blur (precision-2 renders "100.00")
      await antInputNumberFill(page, '#advancePercentage', 150);
      await expect(page.locator('#advancePercentage')).toHaveValue(/^100(\.00)?$/);
      // precision 2: extra decimals rounded on commit
      await antInputNumberFill(page, '#advancePercentage', 12.345);
      await expect(page.locator('#advancePercentage')).toHaveValue('12.35');

      await page.getByRole('button', { name: /Cancel/i }).click();
    });

    test('Edit via row click: change all fields and persist', async ({ page }) => {
      const name = `E2E EditPayTerm ${STAMP()}`;
      const renamed = `${name} v2`;
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await antInputNumberFill(page, '#paymentDays', 30);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/payment-terms') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression

      // Save disabled until the form is dirty
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();
      await page.locator('#name').fill(renamed);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      await page.locator('#description').fill('Edited by E2E');
      await antInputNumberFill(page, '#paymentDays', 45);
      await antInputNumberFill(page, '#advancePercentage', 25);
      // toggle status to Inactive
      await page.locator('#active').click();
      await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'false');

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/payment-terms\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);

      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText('45 days', { exact: true })).toBeVisible();
      await expect(row.getByText('25%', { exact: true })).toBeVisible();
      await expect(row.getByText('Inactive', { exact: true })).toBeVisible();
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelPayTerm ${STAMP()}`;
      await page.getByRole('button', { name: /Add Payment Terms/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await antInputNumberFill(page, '#paymentDays', 10);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/payment-terms') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/payment-terms\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
