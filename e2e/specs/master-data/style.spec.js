/**
 * Style Master — E2E Tests (full field coverage)
 *
 * What this tests:
 *   - API CRUD (create/update both POST /styles, hard DELETE /styles/{id})
 *   - List (MasterSplitView): Style No / Garment / Buyer / Season / Status
 *     columns, Total footer, client search
 *   - Create: ALL fields — styleNo, garmentName, Buyer (Select, store-driven),
 *     Season (Select), Season Year (now a SELECT — the baseline failed here
 *     trying to fill it as an input), description, Active switch
 *   - Validation: required styleNo/garmentName/buyer
 *   - Duplicate styleNo guard (client-side, case-insensitive)
 *   - Edit via ROW CLICK (split view, 400ms dirty-suppression settle,
 *     Save Changes gated until dirty)
 *   - Delete via form Delete button + confirm modal (hard delete)
 *
 * IMPORTANT: buyers are NOT prefetched by MasterDashboard, so the Buyer
 * dropdown is empty unless the Buyers panel was visited first in the SAME page
 * session. goToStyles() therefore opens Buyers, then switches to Styles
 * without a reload. The buyer itself is seeded via API.
 *
 * Source of truth: e2e/plan/inventory-masters-core.md §3
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';
import { stylePayload, buyerPayload } from '../../helpers/test-data.js';

const STAMP = () => Date.now().toString().slice(-6);
const CURRENT_YEAR = String(new Date().getFullYear());

/** Type-to-filter Select helper (scrolls virtual lists for non-search selects). */
async function antSelectType(page, selectLocator, text) {
  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.type(String(text), { delay: 15 });
  await page.waitForTimeout(150);
  const byTitle = dropdown.locator(`.ant-select-item-option[title="${text}"]`).first();
  const byText = dropdown.locator('.ant-select-item-option').filter({ hasText: String(text) }).first();
  let option = (await byTitle.count()) ? byTitle : byText;
  for (let i = 0; i < 30 && !(await option.isVisible().catch(() => false)); i++) {
    await dropdown
      .locator('.rc-virtual-list-holder')
      .evaluate((el) => { el.scrollTop += 150; })
      .catch(() => {});
    await page.waitForTimeout(50);
    option = (await byTitle.count()) ? byTitle : byText;
  }
  await option.click();
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Open the Styles panel WITH the buyers store populated:
 * visit Buyers first (fetches GET /buyers into the store), then switch panels
 * in-page (no reload, which would wipe the store).
 */
async function goToStyles(page) {
  await goToMasterEntity(page, 'Buyers');
  await antTableWaitForData(page);
  await page.getByText('Styles', { exact: true }).first().click();
  await page.getByPlaceholder(/Search by style no/i).waitFor({ state: 'visible', timeout: 15000 });
  await antTableWaitForData(page);
}

async function openNewStyleForm(page) {
  await page.getByRole('button', { name: /Add Style/i }).first().click();
  await page.locator('#styleNo').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(400); // split-view dirty-suppression settle
}

const styleSearch = (page, text) => page.getByPlaceholder(/Search by style no/i).fill(text);

test.describe.serial('Style — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  });

  // ─── API Integration ────────────────────────────────────────────────
  test.describe('API Integration', () => {
    let api;
    let buyerId;
    let createdId;

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      const { data: buyer } = await api.post('/buyers', buyerPayload());
      buyerId = buyer.id;
    });

    test.afterAll(async () => { await api.dispose(); });

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

    test('API — Update modifies record (POST with id+version)', async () => {
      test.skip(!createdId, 'No record created to update');
      const { data: list } = await api.get('/styles');
      const styles = Array.isArray(list) ? list : list.content;
      const existing = styles.find((s) => s.id === createdId);
      expect(existing).toBeTruthy();
      const { response, data } = await api.post('/styles', { ...existing, garmentName: 'Updated Garment' });
      expect(response.ok()).toBeTruthy();
      expect(data.garmentName).toBe('Updated Garment');
    });

    test('API — Delete removes record', async () => {
      test.skip(!createdId, 'No record created to delete');
      const { response } = await api.delete(`/styles/${createdId}`);
      expect([200, 204].includes(response.status())).toBeTruthy();
    });
  });

  // ─── UI Operations ──────────────────────────────────────────────────
  test.describe('UI Operations', () => {
    let api;
    let buyer;     // seeded buyer used by every UI test
    let listStyle; // seeded style so the list is never empty

    test.beforeAll(async () => {
      api = await createAuthenticatedClient();
      const { data } = await api.post('/buyers', buyerPayload({ name: `E2E Style Buyer ${STAMP()}` }));
      buyer = data;
      expect(buyer?.id).toBeTruthy();
      listStyle = stylePayload(buyer.id, { styleNo: `E2E-LS-${STAMP()}` });
      const { response } = await api.post('/styles', listStyle);
      expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async () => { await api.dispose(); });

    test('List: columns, Total footer, search', async ({ page }) => {
      await goToStyles(page);
      for (const col of ['Style No', 'Garment', 'Buyer', 'Season', 'Status']) {
        await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
      }
      await expect(page.getByText(/Total:\s*\d+/)).toBeVisible();

      await styleSearch(page, listStyle.styleNo);
      const row = page.locator('.ant-table-row').filter({ hasText: listStyle.styleNo });
      await expect(row).toBeVisible();
      await expect(row.getByText(buyer.name)).toBeVisible(); // buyer name resolved from store

      await styleSearch(page, 'zzz-no-match-xyz');
      await expect(page.locator('.ant-table-row')).toHaveCount(0);

      await styleSearch(page, '');
      expect(await page.locator('.ant-table-row').count()).toBeGreaterThanOrEqual(1);
    });

    test('Create: all fields — Buyer select, Season + Year SELECTS, description', async ({ page }) => {
      const styleNo = `E2E-CR-${STAMP()}`;
      await goToStyles(page);
      await openNewStyleForm(page);

      await page.locator('#styleNo').fill(styleNo);
      await page.locator('#garmentName').fill('E2E Polo T-Shirt');
      await antSelectType(page, page.locator('.ant-select:has(#buyerId)'), buyer.name);
      await antSelectType(page, page.locator('.ant-select:has(#seasonCode)'), 'Spring/Summer');

      // Season Year is a SELECT (the old spec failed using antFormFill here)
      const yearSelect = page.locator('.ant-select:has(#seasonYear)');
      await expect(yearSelect).toBeVisible();
      await antSelectType(page, yearSelect, CURRENT_YEAR);

      await page.locator('#description').fill('Created by E2E UI test — full field coverage');
      await expect(page.locator('#isActive')).toHaveClass(/ant-switch-checked/); // Active defaults on

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/styles') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Style created successfully/i)).toBeVisible({ timeout: 8000 });

      await antTableWaitForData(page);
      const row = page.locator('.ant-table-row').filter({ hasText: styleNo });
      await expect(row).toBeVisible();
      await expect(row.getByText('E2E Polo T-Shirt')).toBeVisible();
      await expect(row.getByText(`Spring/Summer ${CURRENT_YEAR}`)).toBeVisible(); // season tag
      await expect(row.getByText('Active')).toBeVisible();
    });

    test('Validation: required styleNo, garmentName and buyer', async ({ page }) => {
      await goToStyles(page);
      await openNewStyleForm(page);
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Please enter Style No', { exact: true })).toBeVisible();
      await expect(page.getByText('Please enter Garment Name', { exact: true })).toBeVisible();
      await expect(page.getByText('Please select a Buyer', { exact: true })).toBeVisible();
    });

    test('Duplicate styleNo blocked (case-insensitive client check)', async ({ page }) => {
      const dup = stylePayload(buyer.id, { styleNo: `E2E-DUP-${STAMP()}` });
      const { response: seedResp } = await api.post('/styles', dup);
      expect(seedResp.ok()).toBeTruthy();

      await goToStyles(page); // fresh navigation → store includes the seeded style
      await openNewStyleForm(page);
      await page.locator('#styleNo').fill(dup.styleNo.toLowerCase());
      await page.locator('#garmentName').fill('Dup Garment');
      await antSelectType(page, page.locator('.ant-select:has(#buyerId)'), buyer.name);
      await page.getByRole('button', { name: /Save/i }).click();
      await expect(
        page.locator('.ant-message').getByText(/A style with this Style No already exists/i),
      ).toBeVisible({ timeout: 8000 });
    });

    test('Edit via row click: Save gated until dirty, change persists', async ({ page }) => {
      const seed = stylePayload(buyer.id, { styleNo: `E2E-ED-${STAMP()}` });
      const { response: seedResp } = await api.post('/styles', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToStyles(page);
      await styleSearch(page, seed.styleNo);
      await page.locator('.ant-table-row').filter({ hasText: seed.styleNo }).click();
      await page.locator('#garmentName').waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400); // dirty suppression

      await expect(page.getByRole('button', { name: /Save/i })).toBeDisabled();
      await page.locator('#garmentName').fill('Updated Garment E2E');
      await page.locator('#description').fill('Updated by E2E');
      await antSelectType(page, page.locator('.ant-select:has(#seasonYear)'), String(Number(CURRENT_YEAR) + 1));
      await expect(page.getByRole('button', { name: /Save/i })).toBeEnabled();

      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/styles') && r.request().method() === 'POST'),
        page.getByRole('button', { name: /Save/i }).click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Style updated successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(
        page.locator('.ant-table-row').filter({ hasText: seed.styleNo }).getByText('Updated Garment E2E'),
      ).toBeVisible();
    });

    test('Delete via form Delete button: hard delete removes row', async ({ page }) => {
      const seed = stylePayload(buyer.id, { styleNo: `E2E-DEL-${STAMP()}` });
      const { response: seedResp } = await api.post('/styles', seed);
      expect(seedResp.ok()).toBeTruthy();

      await goToStyles(page);
      await styleSearch(page, seed.styleNo);
      await page.locator('.ant-table-row').filter({ hasText: seed.styleNo }).click();
      await page.locator('#styleNo').waitFor({ state: 'visible', timeout: 10000 });
      // The form Delete button's accessible name is "delete Delete" (icon + label)
      await page.getByRole('button', { name: /Delete/i }).first().click();

      const confirm = page.getByRole('dialog', { name: /Delete Style/i });
      await expect(confirm).toBeVisible({ timeout: 5000 });
      const [resp] = await Promise.all([
        page.waitForResponse((r) => /\/styles\/\d+/.test(r.url()) && r.request().method() === 'DELETE'),
        confirm.getByRole('button', { name: /delete|ok|yes/i }).last().click(),
      ]);
      expect(resp.status()).toBeLessThan(300);
      await expect(page.locator('.ant-message').getByText(/Style deleted successfully/i)).toBeVisible({ timeout: 8000 });
      await antTableWaitForData(page);
      await expect(page.locator('.ant-table-row').filter({ hasText: seed.styleNo })).toHaveCount(0);
    });
  });
});
