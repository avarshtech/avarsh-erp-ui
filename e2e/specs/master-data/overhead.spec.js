/**
 * Overhead Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (no GET-by-id endpoint exists — update built from create response)
 *   - T1 List: Overhead Name / Default Cost (₹ 2dp or —) / Status columns, Total footer
 *   - T2 Search: matches overheadName and description; clear restores
 *   - T3 Create: required validation ("Please enter an overhead name"), defaults (Active switch
 *        on, defaultCost empty), maxlength constraints, all fields saved, payload asserted
 *   - T5 Duplicate: server unique constraint on overhead_name → POST fails, error toast
 *   - T6 Edit via ROW CLICK (400ms settle, Save disabled until dirty): all fields incl.
 *        Active → Inactive switch, ₹ column re-rendered
 *   - T7 Delete via form Delete button + confirm modal (hard delete)
 *   - T8: n/a — no conditional sections (standalone CRUD; Costing's overhead dropdown reads
 *        Process master "Overheads" category, NOT this master — inventory §4)
 *   - T9 Numeric: defaultCost min 0, no negative commit, precision 2 rounding
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §4
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antInputNumberFill } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { overheadPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

test.describe.serial('Overhead — CRUD', () => {
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
      created = data;
    });

    test('API — Update modifies record', async () => {
      test.skip(!created?.id, 'No record created to update');
      // No GET /overheads/{id} endpoint — build the PUT body from the create response.
      const { response, data } = await api.put(`/overheads/${created.id}`, {
        ...created,
        description: 'Updated by E2E',
        defaultCost: 12.5,
        version: created.version ?? 0,
      });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record', async () => {
      test.skip(!created?.id, 'No record created to delete');
      const { response } = await api.delete(`/overheads/${created.id}`);
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
      const { data } = await api.post('/overheads', overheadPayload({
        overheadName: `E2E Seed Overhead ${s}`,
        description: `seed-ovh-${s} description`,
        defaultCost: 42.5,
      }));
      seed = data;
    });

    test.afterAll(async () => {
      if (seed?.id) {
        await api.delete(`/overheads/${seed.id}`).catch(() => {});
      }
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Overheads');
      await antTableWaitForData(page);
    });

    test('List: columns, ₹ cost render, Status tag, Total footer', async ({ page }) => {
      for (const col of ['Overhead Name', 'Default Cost', 'Status']) {
        await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
      }
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const row = page.locator('.ant-table-row').filter({ hasText: seed.overheadName });
      await expect(row).toBeVisible();
      await expect(row.getByText(/42\.50/)).toBeVisible(); // ₹ <2dp> render
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Search matches name and description; clear restores', async ({ page }) => {
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      const total = await page.locator('.ant-table-row').count();

      // by overhead name (unique stamp → exactly one)
      await search.fill(seed.overheadName);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // by description (unique seed token)
      await search.fill(seed.description);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // no match → empty
      await search.fill('zzz-no-match-zzz');
      await expect(page.locator('.ant-table-row')).toHaveCount(0);

      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, defaults, all fields saved', async ({ page }) => {
      const name = `E2E Overhead ${STAMP()}`;
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // defaults on Add
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('#defaultCost')).toHaveValue(''); // null on Add

      // maxlength constraints
      await expect(page.locator('#overheadName')).toHaveAttribute('maxlength', '200');
      await expect(page.locator('#description')).toHaveAttribute('maxlength', '500');

      // required-field validation
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter an overhead name/i)).toBeVisible();

      // all fields
      await page.locator('#overheadName').fill(name);
      await antInputNumberFill(page, '#defaultCost', 99.99);
      await page.locator('#description').fill('Full-coverage E2E overhead');

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/overheads') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);

      const body = resp.request().postDataJSON();
      expect(body.overheadName).toBe(name);
      expect(body.defaultCost).toBe(99.99);
      expect(body.description).toBe('Full-coverage E2E overhead');
      expect(body.isActive).toBe(true);

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(/99\.99/)).toBeVisible(); // ₹ 2dp column render
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Duplicate overhead name blocked by server unique constraint', async ({ page }) => {
      const name = `E2E DupOvh ${STAMP()}`;
      // first create succeeds
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#overheadName').fill(name);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/overheads') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // duplicate (no client-side check — server unique on overhead_name)
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#overheadName').fill(name);
      const [dupResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/overheads') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(dupResp.status()).toBeGreaterThanOrEqual(400);
      await expect(
        page.locator('.ant-message-error, .ant-notification-notice-error').first(),
      ).toBeVisible({ timeout: 8000 });
      // form stays open, no second row created
      await expect(page.locator('#overheadName')).toBeVisible();
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(1);
    });

    test('Edit via row click: change all fields and toggle inactive', async ({ page }) => {
      const name = `E2E EditOvh ${STAMP()}`;
      const renamed = `${name} v2`;
      // create through UI first (self-sufficient)
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#overheadName').fill(name);
      await antInputNumberFill(page, '#defaultCost', 5);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/overheads') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#overheadName').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression

      // Save disabled on existing record until dirty
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      await page.locator('#overheadName').fill(renamed);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();
      await antInputNumberFill(page, '#defaultCost', 11.5);
      await page.locator('#description').fill('After edit by E2E');
      await page.locator('#isActive').click(); // Active → Inactive
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'false');

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/overheads\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);

      const body = putResp.request().postDataJSON();
      expect(body.overheadName).toBe(renamed);
      expect(body.defaultCost).toBe(11.5);
      expect(body.description).toBe('After edit by E2E');
      expect(body.isActive).toBe(false);

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText(/11\.50/)).toBeVisible();   // ₹ column re-rendered 2dp
      await expect(row.getByText('Inactive')).toBeVisible(); // Status tag flipped
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelOvh ${STAMP()}`;
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#overheadName').fill(name);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/overheads') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#overheadName').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/overheads\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes|continue/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });

    test('Numeric validation: defaultCost min 0, precision 2, no negative commit', async ({ page }) => {
      await page.getByRole('button', { name: /Add Overhead/i }).click();
      await page.waitForTimeout(400);

      const cost = page.locator('#defaultCost');
      // min bound advertised on the control (no max on this field)
      await expect(cost).toHaveAttribute('aria-valuemin', '0');

      // precision 2 rounds on commit
      await antInputNumberFill(page, '#defaultCost', 12.3456);
      await expect(cost).toHaveValue(/^12\.3[45]$/);

      // negative input: decimal keystroke filter strips the sign,
      // so the committed value never goes below 0 (no clamp-to-min expected)
      await antInputNumberFill(page, '#defaultCost', -42);
      expect(Number((await cost.inputValue()) || '0')).toBeGreaterThanOrEqual(0);
    });
  });
});
