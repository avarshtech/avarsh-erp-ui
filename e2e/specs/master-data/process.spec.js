/**
 * Process Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip (no GET-by-id endpoint exists — update built from create response)
 *   - T1 List: Process Name / Category / Type / Status columns, derived Type tag, Total footer
 *   - T2 Search: matches processName, description, category; clear restores
 *   - T3 Create: required validations ("Please enter a process name", "Please select a category"),
 *        defaults (Segmented=Cost, Active switch on, defaultCost empty, allowance hidden),
 *        maxlength constraints, all fields saved
 *        + SAVE-TIME AUTO-MUTATION: COST type → 4 allowance fields forced to 0,
 *          processDefaultType stripped from payload
 *   - T5 Duplicate: server unique constraint on process_name → POST fails, error toast
 *   - T6 Edit via ROW CLICK (400ms settle, Save disabled until dirty): all fields, switch
 *        to ALLOWANCE + SAVE-TIME AUTO-MUTATION: defaultCost forced to 0 in PUT payload
 *   - T7 Delete via form Delete button + confirm modal (hard delete)
 *   - T8 Conditional sections: Cost vs Allowance Segmented swaps fields + info Alerts
 *   - T9 Numeric: allowance fields 0–100 bounds, over-max clamp, blur-empty → 0, cost min 0
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §2
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antTableWaitForData,
  antInputNumberFill,
  antFormSelect,
} from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { processPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

const ALLOWANCE_IDS = [
  '#defaultShrinkageInches',
  '#defaultProcessLossPercent',
  '#defaultRejectionPercent',
  '#defaultShipmentAllowancePercent',
];

const pickSegment = (page, label) =>
  page.locator('.ant-segmented-item').filter({ hasText: label }).click();

test.describe.serial('Process — CRUD', () => {
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
      const { response, data } = await api.get('/processes');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = processPayload();
      const { response, data } = await api.post('/processes', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.processName).toBe(payload.processName);
      created = data;
    });

    test('API — Update modifies record', async () => {
      test.skip(!created?.id, 'No record created to update');
      // No GET /processes/{id} endpoint — build the PUT body from the create response.
      const { response, data } = await api.put(`/processes/${created.id}`, {
        ...created,
        description: 'Updated by E2E',
        defaultCost: 25.0,
        version: created.version ?? 0,
      });
      expect(response.ok()).toBeTruthy();
      expect(data.description).toBe('Updated by E2E');
    });

    test('API — Delete removes record', async () => {
      test.skip(!created?.id, 'No record created to delete');
      const { response } = await api.delete(`/processes/${created.id}`);
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
      const { data } = await api.post('/processes', processPayload({
        processName: `E2E Seed Process ${s}`,
        description: `seed-proc-${s} description`,
        category: 'Sewing',
        defaultCost: 10.0,
      }));
      seed = data;
    });

    test.afterAll(async () => {
      if (seed?.id) {
        await api.delete(`/processes/${seed.id}`).catch(() => {});
      }
      await api.dispose();
    });

    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Processes');
      await antTableWaitForData(page);
    });

    test('List: columns, derived Type/Status tags, Total footer', async ({ page }) => {
      for (const col of ['Process Name', 'Category', 'Type', 'Status']) {
        await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
      }
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const row = page.locator('.ant-table-row').filter({ hasText: seed.processName });
      await expect(row).toBeVisible();
      await expect(row.getByText('Sewing')).toBeVisible();   // Category tag
      await expect(row.getByText('Cost')).toBeVisible();     // Type derived: defaultCost > 0
      await expect(row.getByText('Active')).toBeVisible();   // Status tag
    });

    test('Search matches name, description, category; clear restores', async ({ page }) => {
      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
      const total = await page.locator('.ant-table-row').count();

      // by process name (unique stamp → exactly one)
      await search.fill(seed.processName);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // by description (unique seed token)
      await search.fill(seed.description);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // by category
      await search.fill('Sewing');
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);
      await expect(page.locator('.ant-table-row').filter({ hasText: seed.processName })).toBeVisible();

      // no match → empty
      await search.fill('zzz-no-match-zzz');
      await expect(page.locator('.ant-table-row')).toHaveCount(0);

      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, defaults, all fields, allowances zeroed in COST payload', async ({ page }) => {
      const name = `E2E Process ${STAMP()}`;
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // defaults on Add
      await expect(page.locator('.ant-segmented-item-selected').filter({ hasText: 'Cost' })).toBeVisible();
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('#defaultCost')).toHaveValue('');
      await expect(page.locator('#defaultShrinkageInches')).toHaveCount(0); // allowance hidden

      // maxlength constraints
      await expect(page.locator('#processName')).toHaveAttribute('maxlength', '200');
      await expect(page.locator('#description')).toHaveAttribute('maxlength', '500');

      // required-field validation
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter a process name/i)).toBeVisible();
      await expect(page.getByText(/please select a category/i)).toBeVisible();

      // all fields
      await page.locator('#processName').fill(name);
      await antFormSelect(page, 'Category', null, { first: true });
      await page.locator('#description').fill('Full-coverage E2E process');
      await antInputNumberFill(page, '#defaultCost', 123.45);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/processes') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      // category taken from the submitted payload (robust vs. DOM read)
      const category = resp.request().postDataJSON().category;
      expect(category).toBeTruthy();

      // Save-time auto-mutation: COST type forces all 4 allowance fields to 0
      // and strips the UI-only processDefaultType discriminator.
      const body = resp.request().postDataJSON();
      expect(body.defaultCost).toBe(123.45);
      expect(body.defaultShrinkageInches).toBe(0);
      expect(body.defaultProcessLossPercent).toBe(0);
      expect(body.defaultRejectionPercent).toBe(0);
      expect(body.defaultShipmentAllowancePercent).toBe(0);
      expect(body.processDefaultType).toBeUndefined();
      expect(body.isActive).toBe(true);

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(category)).toBeVisible();
      await expect(row.getByText('Cost')).toBeVisible(); // Type derived from defaultCost > 0
    });

    test('Duplicate process name blocked by server unique constraint', async ({ page }) => {
      const name = `E2E DupProc ${STAMP()}`;
      // first create succeeds
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#processName').fill(name);
      await antFormSelect(page, 'Category', null, { first: true });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/processes') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // duplicate (no client-side check — server unique on process_name)
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#processName').fill(name);
      await antFormSelect(page, 'Category', null, { first: true });
      const [dupResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/processes') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(dupResp.status()).toBeGreaterThanOrEqual(400);
      await expect(
        page.locator('.ant-message-error, .ant-notification-notice-error').first(),
      ).toBeVisible({ timeout: 8000 });
      // form stays open, no second row created
      await expect(page.locator('#processName')).toBeVisible();
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(1);
    });

    test('Edit via row click: all fields, switch to Allowance zeroes cost in payload', async ({ page }) => {
      const name = `E2E EditProc ${STAMP()}`;
      const renamed = `${name} v2`;
      // create a COST process through the UI first (self-sufficient)
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#processName').fill(name);
      await antFormSelect(page, 'Category', null, { first: true });
      await antInputNumberFill(page, '#defaultCost', 50);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/processes') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // edit = click the row (no per-row edit icon in split view)
      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#processName').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // dirty suppression

      // Save disabled on existing record until dirty
      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();

      await page.locator('#processName').fill(renamed);
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();
      await page.locator('#description').fill('Edited by E2E — switched to allowance');

      // flip the conditional section: Cost → Allowance
      await pickSegment(page, 'Allowance');
      await expect(page.locator('#defaultCost')).toHaveCount(0);
      await antInputNumberFill(page, '#defaultShrinkageInches', 1.25);
      await antInputNumberFill(page, '#defaultProcessLossPercent', 2.5);
      await antInputNumberFill(page, '#defaultRejectionPercent', 3.75);
      await antInputNumberFill(page, '#defaultShipmentAllowancePercent', 4);

      // Active → Inactive
      await page.locator('#isActive').click();
      await expect(page.locator('#isActive')).toHaveAttribute('aria-checked', 'false');

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/processes\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);

      // Save-time auto-mutation: ALLOWANCE type forces defaultCost to 0
      const body = putResp.request().postDataJSON();
      expect(body.defaultCost).toBe(0);
      expect(body.defaultShrinkageInches).toBe(1.25);
      expect(body.defaultProcessLossPercent).toBe(2.5);
      expect(body.defaultRejectionPercent).toBe(3.75);
      expect(body.defaultShipmentAllowancePercent).toBe(4);
      expect(body.isActive).toBe(false);
      expect(body.processDefaultType).toBeUndefined();

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText('Allowance')).toBeVisible(); // Type tag flipped
      await expect(row.getByText('Inactive')).toBeVisible();  // Status tag flipped
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelProc ${STAMP()}`;
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#processName').fill(name);
      await antFormSelect(page, 'Category', null, { first: true });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/processes') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#processName').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/processes\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes|continue/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });

    test('Conditional sections: Cost vs Allowance segments swap fields and hints', async ({ page }) => {
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);

      // COST default: cost field + cost hint visible, allowance fields hidden
      await expect(page.getByText(/auto-filled as the process cost/i)).toBeVisible();
      await expect(page.locator('#defaultCost')).toBeVisible();
      for (const id of ALLOWANCE_IDS) {
        await expect(page.locator(id)).toHaveCount(0);
      }

      // switch to ALLOWANCE: 4 fields appear pre-filled to 0, cost hidden
      await pickSegment(page, 'Allowance');
      await expect(page.getByText(/auto-applied to calculate purchase quantities/i)).toBeVisible();
      await expect(page.locator('#defaultCost')).toHaveCount(0);
      for (const id of ALLOWANCE_IDS) {
        await expect(page.locator(id)).toBeVisible();
        await expect(page.locator(id)).toHaveValue(/^0(\.00)?$/); // default 0.00
      }

      // back to COST: section swaps again
      await pickSegment(page, 'Cost');
      await expect(page.locator('#defaultCost')).toBeVisible();
      await expect(page.locator('#defaultShrinkageInches')).toHaveCount(0);
    });

    test('Numeric validation: allowance bounds 0–100, blur-empty resets to 0, cost min 0', async ({ page }) => {
      await page.getByRole('button', { name: /Add Process/i }).click();
      await page.waitForTimeout(400);
      await pickSegment(page, 'Allowance');

      const loss = page.locator('#defaultProcessLossPercent');
      await expect(loss).toHaveAttribute('aria-valuemin', '0');
      await expect(loss).toHaveAttribute('aria-valuemax', '100');
      await expect(page.locator('#defaultShrinkageInches')).toHaveAttribute('aria-valuemax', '100');

      // above max → clamped to 100 on blur
      await antInputNumberFill(page, '#defaultProcessLossPercent', 150);
      await expect(loss).toHaveValue(/^100(\.00)?$/);

      // negative input: decimal keystroke filter strips the sign,
      // so the committed value stays within 0–100 (no clamp-to-min expected)
      await antInputNumberFill(page, '#defaultProcessLossPercent', -7);
      const committed = Number(await loss.inputValue());
      expect(committed).toBeGreaterThanOrEqual(0);
      expect(committed).toBeLessThanOrEqual(100);

      // blur with empty value → onBlur resets the field to 0
      await loss.fill('');
      await loss.press('Tab');
      await expect(loss).toHaveValue(/^0(\.00)?$/);

      // cost field: min 0, negative input never commits below 0
      await pickSegment(page, 'Cost');
      const cost = page.locator('#defaultCost');
      await expect(cost).toHaveAttribute('aria-valuemin', '0');
      await antInputNumberFill(page, '#defaultCost', -42);
      expect(Number((await cost.inputValue()) || '0')).toBeGreaterThanOrEqual(0);
    });
  });
});
