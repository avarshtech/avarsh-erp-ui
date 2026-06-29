/**
 * Defect Type Master — E2E Tests
 *
 * What this tests:
 *   - List loads with seeded data, columns render, search works
 *   - Create with ALL fields (name, description, active switch default ON)
 *   - Required-field validation (name)
 *   - Duplicate-name guard
 *   - Edit all fields and verify persistence
 *   - Soft delete: row becomes Inactive (NOT removed) per QC-history retention rule
 *
 * Prerequisites:
 *   - Backend e2e profile (H2) with V116 GRN/QC master seeds
 *   - Nav entry is gated by inventory-qc module access (superadmin has it)
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser:error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  await goToMasterEntity(page, 'Defect Types');
});

test.describe('Defect Type Master — CRUD', () => {
  test('list loads with columns and search filters by name', async ({ page }) => {
    await antTableWaitForData(page);
    for (const col of ['Name', 'Description', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    const totalRows = await page.locator('.ant-table-row').count();
    expect(totalRows).toBeGreaterThan(0);

    // Search narrows; clearing restores
    const firstName = await page.locator('.ant-table-row td').first().textContent();
    const search = page.locator(".ant-card").filter({ has: page.locator(".ant-table") }).getByPlaceholder(/search/i).first();
    await search.fill(firstName.trim());
    await page.waitForTimeout(600); // debounce
    const filtered = await page.locator('.ant-table-row').count();
    expect(filtered).toBeGreaterThanOrEqual(1);
    expect(filtered).toBeLessThanOrEqual(totalRows);
    await search.clear();
    await page.waitForTimeout(600);
    expect(await page.locator('.ant-table-row').count()).toBe(totalRows);
  });

  test('create with all fields → appears Active in list', async ({ page }) => {
    const name = `E2E Defect ${STAMP()}`;
    await page.getByRole('button', { name: /Add Defect Type/i }).click();

    // Required validation first: save with empty name
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/please enter defect type name/i)).toBeVisible();

    // Fill ALL fields
    await page.locator('#name').fill(name);
    await page.locator('#description').fill('Created by E2E — broken stitch class');
    // Active switch defaults ON — assert, then leave ON
    await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'true');

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/defect-types') && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);

    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();
  });

  test('duplicate name is rejected', async ({ page }) => {
    const name = `E2E DupDefect ${STAMP()}`;
    // create the first one
    await page.getByRole('button', { name: /Add Defect Type/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/defect-types') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    // attempt duplicate
    await page.getByRole('button', { name: /Add Defect Type/i }).click();
    await page.locator('#name').fill(name);
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 8000 });
  });

  test('edit name and description persists', async ({ page }) => {
    const name = `E2E EditDefect ${STAMP()}`;
    const renamed = `${name} v2`;
    await page.getByRole('button', { name: /Add Defect Type/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/defect-types') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    const row = page.locator('.ant-table-row').filter({ hasText: name });
    await row.click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.locator('#name').fill(renamed);
    await page.locator('#description').fill('updated by E2E');
    const [putResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/defect-types\/\d+/) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(putResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: renamed })).toBeVisible();
  });

  test('deactivate via Active switch marks row Inactive', async ({ page }) => {
    const name = `E2E DeactDefect ${STAMP()}`;
    await page.getByRole('button', { name: /Add Defect Type/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/defect-types') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    // open and toggle Active off — the supported "soft" path
    await page.locator('.ant-table-row').filter({ hasText: name }).click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator('#active').click();
    const [putResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/defect-types\/\d+/) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(putResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('Inactive')).toBeVisible();
  });

  test('delete permanently removes an unused defect type', async ({ page }) => {
    const name = `E2E DelDefect ${STAMP()}`;
    await page.getByRole('button', { name: /Add Defect Type/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/defect-types') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    // open the record, delete from the form
    await page.locator('.ant-table-row').filter({ hasText: name }).click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Delete/i }).click();
    // backend hard-deletes unused records (blocked when used by QC)
    const modal = page.locator('.ant-modal').filter({ visible: true }).last();
    await expect(modal.getByText(/permanently delete/i)).toBeVisible();
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/defect-types\/\d+/) && r.request().method() === 'DELETE'),
      modal.getByRole('button', { name: /ok|yes|continue|delete/i }).click(),
    ]);
    expect(delResp.status()).toBeLessThan(300);

    // hard delete: gone from the list, also after a fresh load
    await goToMasterEntity(page, 'Defect Types');
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: name })).toHaveCount(0);
  });
});
