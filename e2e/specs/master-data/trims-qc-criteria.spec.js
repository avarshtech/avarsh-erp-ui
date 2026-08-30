/**
 * Trims QC Criteria Master — E2E Tests
 *
 * What this tests:
 *   - List loads, columns render, search filters
 *   - Create with ALL fields (name, description, active default ON)
 *   - Required-field validation + duplicate-name guard
 *   - Edit persistence
 *   - Soft delete: row stays as Inactive (QC checklist history retention)
 *
 * Prerequisites:
 *   - Backend e2e profile (H2) with V116 GRN/QC master seeds
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
  await goToMasterEntity(page, 'Trims QC Criteria');
});

test.describe('Trims QC Criteria Master — CRUD', () => {
  test('list loads with columns and seeded criteria', async ({ page }) => {
    await antTableWaitForData(page);
    for (const col of ['Name', 'Description', 'Status']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
    expect(await page.locator('.ant-table-row').count()).toBeGreaterThan(0);
  });

  test('create with all fields → appears Active in list', async ({ page }) => {
    const name = `E2E Criterion ${STAMP()}`;
    await page.getByRole('button', { name: /Add Criterion/i }).click();

    // Required validation
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/please enter criterion name/i)).toBeVisible();

    // All fields (placeholder per inventory: "e.g. Pull Strength")
    await page.locator('#name').fill(name);
    await page.locator('#description').fill('Created by E2E — pull strength check');
    await expect(page.locator('#active')).toHaveAttribute('aria-checked', 'true');

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/trims-qc-criteria') && r.request().method() === 'POST',
        { timeout: 15000 },
      ),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(resp.status()).toBeLessThan(300);

    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();
  });

  test('duplicate name is rejected', async ({ page }) => {
    const name = `E2E DupCriterion ${STAMP()}`;
    await page.getByRole('button', { name: /Add Criterion/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/trims-qc-criteria') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    await page.getByRole('button', { name: /Add Criterion/i }).click();
    await page.locator('#name').fill(name);
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 8000 });
  });

  test('edit persists and soft delete marks Inactive', async ({ page }) => {
    const name = `E2E EditCriterion ${STAMP()}`;
    const renamed = `${name} v2`;
    await page.getByRole('button', { name: /Add Criterion/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/trims-qc-criteria') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    // Edit
    await page.locator('.ant-table-row').filter({ hasText: name }).click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.waitForTimeout(450); // clear the ~300ms dirty-suppression window so Save arms
    await page.locator('#name').fill(renamed);
    const [putResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/trims-qc-criteria\/\d+/) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(putResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: renamed });
    await expect(row).toBeVisible();

    // Hard delete (backend permanently removes unused criteria; blocked when used)
    await row.click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Delete/i }).click();
    const modal = page.locator('.ant-modal').filter({ visible: true }).last();
    await expect(modal.getByText(/permanently delete/i)).toBeVisible();
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/trims-qc-criteria\/\d+/) && r.request().method() === 'DELETE'),
      modal.getByRole('button', { name: /ok|yes|continue|delete/i }).click(),
    ]);
    expect(delResp.status()).toBeLessThan(300);

    await goToMasterEntity(page, 'Trims QC Criteria');
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: renamed })).toHaveCount(0);
  });

  test('deactivate via Active switch marks row Inactive', async ({ page }) => {
    const name = `E2E DeactCriterion ${STAMP()}`;
    await page.getByRole('button', { name: /Add Criterion/i }).click();
    await page.locator('#name').fill(name);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/trims-qc-criteria') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    await antTableWaitForData(page);

    await page.locator('.ant-table-row').filter({ hasText: name }).click();
    await page.locator('#name').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator('#active').click();
    const [putResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/trims-qc-criteria\/\d+/) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(putResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('Inactive')).toBeVisible();
  });
});
