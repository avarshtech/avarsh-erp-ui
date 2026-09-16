/**
 * Branch hierarchy — what a multi-branch company sees.
 *
 * The mirror of 01: once a second branch is active the switcher appears in the
 * header, lists gain a Branch column and forms gain a Branch field. Switching
 * the header re-fetches the list for that branch.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureBranch, headOffice } from '../../helpers/branch-seed.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';

let api;
let ho;
let second;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  ho = await headOffice(api);
  second = await ensureBranch(api, { branchCode: 'E2E-TIR', branchName: 'E2E Tirupur' });
});

test.afterAll(async () => { await api?.dispose(); });
test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

test.describe('Branch hierarchy — multi-branch company', () => {

  test('the header shows the working-branch switcher with an All Branches option', async ({ page }) => {
    await navigateWithAuth(page, '/');
    await waitForPageReady(page);

    const switcher = page.getByLabel('Working branch');
    await expect(switcher).toBeVisible({ timeout: 15000 });

    await switcher.click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });
    await expect(dropdown.getByText('All Branches')).toBeVisible();
    await expect(dropdown.getByText('E2E Tirupur')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('order list gains a Branch column', async ({ page }) => {
    await navigateWithAuth(page, '/orders/list');
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('.ant-table-thead').first().getByText('Branch', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('units master gains a required Branch picker', async ({ page }) => {
    await navigateWithAuth(page, '/hr/masters');
    await waitForPageReady(page);
    await page.getByText('Units', { exact: true }).first().click();
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: /Add Unit/i }).click();
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });

    await expect(page.locator('.ant-form-item-label').getByText('Branch', { exact: true })).toBeVisible();
    // and it is mandatory — a unit has to sit somewhere
    await page.getByLabel('Unit Code').fill('E2E-NB');
    await page.getByLabel('Unit Name').fill('E2E No Branch');
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText('Please select the branch this unit belongs to')).toBeVisible({ timeout: 8000 });
  });

  test('switching the working branch re-fetches the list for that branch', async ({ page }) => {
    await navigateWithAuth(page, '/orders/list');
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 20000 });

    // The seeded orders are all allocated to the head office, so the second
    // branch's list comes back empty while "All Branches" shows them again.
    const switcher = page.getByLabel('Working branch');
    await switcher.click();
    let dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dropdown.getByText('E2E Tirupur').click();
    await page.waitForResponse((r) => r.url().includes('/orders') && r.request().method() === 'GET', { timeout: 15000 }).catch(() => {});
    await expect(page.locator('.ant-table-placeholder, .ant-empty').first()).toBeVisible({ timeout: 15000 });

    await switcher.click();
    dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dropdown.getByText('All Branches').click();
    await page.waitForResponse((r) => r.url().includes('/orders') && r.request().method() === 'GET', { timeout: 15000 }).catch(() => {});
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible({ timeout: 15000 });
  });

  test('the working branch travels to the API as X-Branch-Id', async ({ page }) => {
    await navigateWithAuth(page, '/');
    await waitForPageReady(page);

    const switcher = page.getByLabel('Working branch');
    await switcher.click();
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await dropdown.getByText('E2E Tirupur').click();

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/v1/') && !!r.headers()['x-branch-id'], { timeout: 20000 }),
      page.goto('/inventory/stock'),
    ]);
    expect(request.headers()['x-branch-id']).toBe(String(second.id));

    // put the switcher back on the head office for the specs that follow
    await page.goto('/');
    await waitForPageReady(page);
    await page.getByLabel('Working branch').click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last()
      .getByText('All Branches').click();
  });

  test('master data ignores the branch — items are the company\'s, not a site\'s', async () => {
    const { data: atHo } = await api.get('/items', null, { 'X-Branch-Id': String(ho.id) });
    const { data: atSecond } = await api.get('/items', null, { 'X-Branch-Id': String(second.id) });
    expect(Array.isArray(atHo)).toBe(true);
    expect(atHo.length).toBeGreaterThan(0);
    expect(atSecond.length).toBe(atHo.length);
  });
});
