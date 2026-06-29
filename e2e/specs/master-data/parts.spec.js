/**
 * Parts Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (no GET-by-id endpoint exists — update built from create response)
 *   - T1 List: Part Name / Status columns, Total footer
 *   - T2 Search: matches partName ONLY (description deliberately NOT matched); clear restores
 *   - T3 Create: required validation ("Please enter a part name"), defaults (Active switch on),
 *        all fields saved, payload asserted
 *   - T4 Field constraints: partName maxlength 200, description maxlength 500
 *   - T5 Duplicate: server unique constraint on part_name → POST fails, error toast
 *   - T6 Edit via ROW CLICK (400ms settle, Save disabled until dirty): all fields incl.
 *        Active → Inactive switch
 *   - T7 Delete via form Delete button + confirm modal (hard delete)
 *   - T8/T9: n/a — Parts Master has no conditional sections and no numeric fields (inventory §3)
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §3
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { partPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe.serial('Parts — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let created;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
    });

    test.afterAll(async () => { await api.dispose(); });

    test('API — List returns data', async () => {
      const { response, data } = await api.get('/parts');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = partPayload();
      const { response, data } = await api.post('/parts', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.partName).toBe(payload.partName);
      created = data;
    });

    test('API — Update modifies record', async () => {
      test.skip(!created?.id, 'No record created to update');
      // No GET /parts/{id} endpoint — build the PUT body from the create response.
      const { response, data } = await api.put(`/parts/${created.id}`, {
        ...created,
        description: 'Updated by E2E',
        version: created.version ?? 0,
      });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record', async () => {
      test.skip(!created?.id, 'No record created to delete');
      const { response } = await api.delete(`/parts/${created.id}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let seed; // guarantees a known row for list/search assertions

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      const s = STAMP();
      const { data } = await api.post('/parts', partPayload({
        partName: `E2E Seed Part ${s}`,
        description: `seed-part-${s} description`,
      }));
      seed = data;
    });

    test.afterAll(async () => {
      if (seed?.id) {
        await api.delete(`/parts/${seed.id}`).catch(() => {});
      }
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Parts');
      await antTableWaitForData(page);
    });

    test('List: columns, Status tag, Total footer', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Part Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const row = page.locator('.ant-table-row').filter({ hasText: seed.partName });
      await expect(row).toBeVisible();
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Search matches partName only; clear restores', async ({ page }) => {
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      const total = await page.locator('.ant-table-row').count();

      // by part name (unique stamp → exactly one)
      await search.fill(seed.partName);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // description is NOT searched on this screen (matches partName only — inventory §3)
      await search.fill(seed.description);
      await expect(page.locator('.ant-table-row')).toHaveCount(0);

      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, defaults, all fields saved', async ({ page }) => {
      const name = `E2E Part ${STAMP()}`;
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // defaults on Add
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('#partName')).toHaveValue('');
      await expect(page.locator('#description')).toHaveValue('');

      // required-field validation
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter a part name/i)).toBeVisible();

      // all fields
      await page.locator('#partName').fill(name);
      await page.locator('#description').fill('Full-coverage E2E part');

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/parts') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);

      const body = resp.request().postDataJSON();
      expect(body.partName).toBe(name);
      expect(body.description).toBe('Full-coverage E2E part');
      expect(body.isActive).toBe(true);

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Field constraints: partName maxlength 200, description maxlength 500', async ({ page }) => {
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400);
      await expect(page.locator('#partName')).toHaveAttribute('maxlength', '200');
      await expect(page.locator('#description')).toHaveAttribute('maxlength', '500');
    });

    test('Duplicate part name blocked by server unique constraint', async ({ page }) => {
      const name = `E2E DupPart ${STAMP()}`;
      // first create succeeds
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#partName').fill(name);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/parts') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // duplicate (no client-side check — server unique on part_name)
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#partName').fill(name);
      const [dupResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/parts') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(dupResp.status()).toBeGreaterThanOrEqual(400);
      await expect(
        page.locator('.ant-message-error, .ant-notification-notice-error').first(),
      ).toBeVisible({ timeout: 8000 });
      // form stays open, no second row created
      await expect(page.locator('#partName')).toBeVisible();
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(1);
    });

    test('Edit via row click: change all fields and toggle inactive', async ({ page }) => {
      const name = `E2E EditPart ${STAMP()}`;
      const renamed = `${name} v2`;
      // create through UI first (self-sufficient)
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#partName').fill(name);
      await page.locator('#description').fill('Before edit');
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/parts') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#partName').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression

      // Save disabled on existing record until dirty
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      await page.locator('#partName').fill(renamed);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();
      await page.locator('#description').fill('After edit by E2E');
      await page.locator('#isActive').click(); // Active → Inactive
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'false');

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/parts\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);

      const body = putResp.request().postDataJSON();
      expect(body.partName).toBe(renamed);
      expect(body.description).toBe('After edit by E2E');
      expect(body.isActive).toBe(false);

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText('Inactive')).toBeVisible(); // Status tag flipped
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelPart ${STAMP()}`;
      await page.getByRole('button', { name: /Add Part/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#partName').fill(name);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/parts') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#partName').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/parts\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes|continue/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
