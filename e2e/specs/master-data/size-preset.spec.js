/**
 * Size Preset Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD round-trip
 *   - List: Preset Name/Category/Region/Sizes/Status columns, Total footer,
 *     search by name AND by individual size token, clear restore
 *   - Create: required validation (name, sizes), defaults (Active=true, sizes empty),
 *     ALL fields — name, category (Select), region (Select), sizes (tags Select), status
 *   - Duplicate name blocked (inline validator, trim + case-insensitive)
 *   - Auto-populate: category+region → SIZE_DEFAULTS overwrite + info toast; "Clear All" link
 *   - Edit via ROW CLICK (split-view) with 400ms dirty-suppression settle,
 *     Save disabled until dirty
 *   - Delete via form Delete button + confirm modal (hard delete)
 *
 * Source of truth: e2e/plan/inventory-masters-support.md §5
 * NOTE: Category/Region are SELECTs (antSelect only — never antFormFill);
 *       Sizes is Select mode="tags" (#sizes inner input, Enter commits a token).
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antFormSelect } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { sizePresetPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);

/** Sizes form item (Select mode="tags") — label "Sizes" with embedded "Clear All" link */
const sizesItem = (page) => page.locator('.ant-form-item').filter({ hasText: 'Sizes' }).first();

/** Add size tokens into the tags Select: type each token + Enter, then close dropdown */
async function addSizes(page, sizes) {
  const input = page.locator('#sizes');
  await input.click();
  for (const s of sizes) {
    await input.fill(s);
    await input.press('Enter');
  }
  await page.keyboard.press('Escape'); // close the tags dropdown overlay
}

test.describe.serial('Size Preset — CRUD', () => {
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
      const { response, data } = await api.get('/size-presets');
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data) || data.content).toBeTruthy();
    });

    test('API — Create returns created record', async () => {
      const payload = sizePresetPayload();
      const { response, data } = await api.post('/size-presets', payload);
      expect(response.ok()).toBeTruthy();
      expect(data).toBeTruthy();
      expect(data.name).toBe(payload.name);
      createdId = data.id;
    });

    test('API — Update modifies record', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: existing } = await api.get(`/size-presets/${createdId}`);
      const updated = { ...existing, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] };
      const { response, data } = await api.put(`/size-presets/${createdId}`, updated);
      expect(response.ok()).toBeTruthy();
      expect(data.sizes).toContain('XXL');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/size-presets/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    test.beforeEach(async ({ page }) => {
      await goToMasterEntity(page, 'Size Presets');
      await antTableWaitForData(page);
    });

    test('List: columns, search by name and size token, Total footer', async ({ page }) => {
      const name = `E2E PresetSearch ${STAMP()}`;
      const sizeToken = `zz${STAMP()}`;

      // create a record through the UI so search has guaranteed unique matches
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle
      await page.locator('#name').fill(name);
      await addSizes(page, ['XS', sizeToken]);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/size-presets') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      // columns
      await expect(page.getByRole('columnheader', { name: 'Preset Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Region' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Sizes' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

      // Total footer + rows
      const total = await page.locator('.ant-table-row').count();
      expect(total).toBeGreaterThan(0);
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();

      // search by name (client-side, per keystroke)
      await search.fill(name);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // search by individual size token (inventory: matches any size token)
      await search.fill(sizeToken);
      await expect(page.locator('.ant-table-row')).toHaveCount(1);

      // clear restores full list
      await search.clear();
      await expect(page.locator('.ant-table-row')).toHaveCount(total);
    });

    test('Create: required validation, defaults, all fields saved', async ({ page }) => {
      const name = `E2E Preset ${STAMP()}`;
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400); // dirty-suppression settle

      // required-field validation (name + at least one size)
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText(/please enter a preset name/i)).toBeVisible();
      await expect(page.getByText(/add at least one size/i)).toBeVisible();

      // defaults: Active=true, sizes empty
      await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'true');
      await expect(sizesItem(page).locator('.ant-select-selection-item')).toHaveCount(0);

      // all fields — Category/Region are SELECTs (never plain fill)
      await page.locator('#name').fill(name);
      await antFormSelect(page, 'Garment Category', 'Tops');
      await antFormSelect(page, 'Regional Standard', 'India');
      // category+region auto-populates the SIZE_DEFAULTS — replace with custom run
      await page.getByRole('button', { name: 'Clear All' }).click();
      await expect(sizesItem(page).locator('.ant-select-selection-item')).toHaveCount(0);
      await addSizes(page, ['XS', 'S', 'M']);
      await expect(sizesItem(page).locator('.ant-select-selection-item')).toHaveCount(3);

      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/size-presets') && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await antTableWaitForData(page);

      const row = page.locator('.ant-table-row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText('Tops', { exact: true })).toBeVisible();
      await expect(row.getByText('India', { exact: true })).toBeVisible();
      await expect(row.getByText('XS', { exact: true })).toBeVisible();
      await expect(row.getByText('Active', { exact: true })).toBeVisible();
    });

    test('Create: duplicate name blocked (inline validator, case-insensitive)', async ({ page }) => {
      const name = `E2E DupPreset ${STAMP()}`;
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await addSizes(page, ['M']);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/size-presets') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name.toUpperCase());
      await addSizes(page, ['L']);
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.getByText(/a preset with this name already exists/i).first(),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Sizes control: category+region auto-populates industry defaults, Clear All empties', async ({ page }) => {
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400);

      // selecting BOTH category & region overwrites sizes with SIZE_DEFAULTS + info toast
      await antFormSelect(page, 'Garment Category', 'Tops');
      await antFormSelect(page, 'Regional Standard', 'India');
      await expect(
        page.getByText(/sizes updated to industry standard/i).first(),
      ).toBeVisible({ timeout: 8000 });

      // Tops × India default run = XS S M L XL XXL 3XL (7 tokens)
      const tags = sizesItem(page).locator('.ant-select-selection-item');
      await expect(tags).toHaveCount(7);
      await expect(tags.filter({ hasText: 'XS' }).first()).toBeVisible();
      await expect(tags.filter({ hasText: '3XL' }).first()).toBeVisible();

      // "Clear All" link button inside the Sizes label empties the tag list
      await page.getByRole('button', { name: 'Clear All' }).click();
      await expect(tags).toHaveCount(0);

      await page.getByRole('button', { name: /Cancel/i }).click();
    });

    test('Edit via row click: change all fields and persist', async ({ page }) => {
      const name = `E2E EditPreset ${STAMP()}`;
      const renamed = `${name} v2`;
      // create through UI first (independent of other tests) — no category/region yet
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await addSizes(page, ['M']);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/size-presets') && r.request().method() === 'POST'),
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

      // change selects — picking both triggers auto-populate of sizes
      await antFormSelect(page, 'Garment Category', 'Bottoms');
      await antFormSelect(page, 'Regional Standard', 'EU (European)');
      await expect(
        sizesItem(page).locator('.ant-select-selection-item').filter({ hasText: '38' }).first(),
      ).toBeVisible();

      // toggle status to Inactive
      await page.locator('#active').click();
      await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'false');

      const [putResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/size-presets\/\d+/) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(putResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);

      const row = page.locator('.ant-table-row').filter({ hasText: renamed });
      await expect(row).toBeVisible();
      await expect(row.getByText('Bottoms', { exact: true })).toBeVisible();
      await expect(row.getByText('Inactive', { exact: true })).toBeVisible();
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const name = `E2E DelPreset ${STAMP()}`;
      await page.getByRole('button', { name: /Add Preset/i }).click();
      await page.waitForTimeout(400);
      await page.locator('#name').fill(name);
      await addSizes(page, ['S']);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/size-presets') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      await antTableWaitForData(page);

      await page.locator('.ant-table-row').filter({ hasText: name }).click();
      await page.locator('#name').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Delete/i }).click();

      const confirm = page.locator('.ant-modal-confirm, .ant-modal, .ant-popconfirm').last();
      await confirm.waitFor({ state: 'visible' });
      const [delResp] = await Promise.all([
        page.waitForResponse((r) => r.url().match(/\/size-presets\/\d+/) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(delResp.status()).toBeLessThan(300);
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
    });
  });
});
