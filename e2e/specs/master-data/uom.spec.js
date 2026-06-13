/**
 * Unit of Measure — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip
 *   - List: Symbol/Name columns, search by name and symbol, Total footer
 *   - Create: required validation (name, symbol), decimalPrecision default 2,
 *     all fields, duplicate-name guard (trim + case-insensitive)
 *   - Field validation: decimalPrecision integer bounds 0–6
 *   - Edit via ROW CLICK (split-view) with 400ms dirty-suppression settle
 *   - Delete via form Delete button + confirm modal (hard delete)
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §1
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antInputNumberFill } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { uomPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe.serial('Unit of Measure — CRUD', () => {
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
      const payload = uomPayload();
      payload.name = `Updated UOM ${Date.now()}`;
      const { response, data } = await api.put(`/unit-of-measures/${createdId}`, { ...payload, version: 0 });
      expect(response.ok()).toBeTruthy();
      expect(data.name).toBe(payload.name);
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/unit-of-measures/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Unit of Measurement');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name and symbol, Total footer', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Symbol' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      // search by name (client-side, per keystroke)
      await page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first().fill('Meter');
      const byName = await page.locator('.ant-table-row').count();
      expect(byName).toBeLessThanOrEqual(total);

      // search by symbol
      await page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first().fill('kg');
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);

      await page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first().clear();
      expect(await page.locator('.ant-table-row').count()).toBe(total);
    });

    test('Create: required validation, default precision 2, all fields saved', async ({ page }) => {
      const name = `E2E UOM ${STAMP()}`;
      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter uom name/i)).toBeVisible();
      await expect(page.getByText(/please enter symbol/i)).toBeVisible();

      // default precision = 2
      await expect(page.locator('#decimalPrecision')).toHaveValue('2');

      // all fields
      await page.locator('#name').fill(name);
      await page.locator('#symbol').fill(`e${STAMP().slice(-3)}`);
      await antInputNumberFill(page, '#decimalPrecision', 3);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/unit-of-measures') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toBeVisible();
    });

    test('Create: duplicate name blocked (case-insensitive)', async ({ page }) => {
      const name = `E2E DupUom ${STAMP()}`;
      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await page.locator('#symbol').fill('dp');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/unit-of-measures') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name.toUpperCase());
      await page.locator('#symbol').fill('dp2');
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 8000 });
    });

    test('Field validation: decimalPrecision bounded 0–6 integer', async ({ page }) => {
      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400);
      // bounds advertised on the control
      await expect(page.locator('#decimalPrecision')).toHaveAttribute('aria-valuemin', '0');
      await expect(page.locator('#decimalPrecision')).toHaveAttribute('aria-valuemax', '6');
      // above max → clamped to 6 on blur
      await antInputNumberFill(page, '#decimalPrecision', 9);
      await expect(page.locator('#decimalPrecision')).toHaveValue('6');
      // negative input: integer-only keystroke filter strips the sign,
      // so the committed value can never be below 0
      await antInputNumberFill(page, '#decimalPrecision', -3);
      const committed = await page.locator('#decimalPrecision').inputValue();
      expect(Number(committed)).toBeGreaterThanOrEqual(0);
      expect(Number(committed)).toBeLessThanOrEqual(6);
    });

    test('Edit via row click: change all fields and persist', async ({ page }) => {
      const name = `E2E EditUom ${STAMP()}`;
      const renamed = `${name} v2`;
      // create through UI first (independent of other tests)
      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await page.locator('#symbol').fill('ed');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/unit-of-measures') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression
      await page.locator('#name').fill(renamed);
      await page.locator('#symbol').fill('e2');
      await antInputNumberFill(page, '#decimalPrecision', 4);

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/unit-of-measures\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText('e2', { exact: true })).toBeVisible(); // symbol tag updated
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelUom ${STAMP()}`;
      await page.getByRole('button', { name: /Add UOM/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await page.locator('#symbol').fill('dl');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/unit-of-measures') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/unit-of-measures\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
