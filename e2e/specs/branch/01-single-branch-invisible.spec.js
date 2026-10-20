/**
 * Branch hierarchy — the single-branch company never sees the layer.
 *
 * Most garment companies run one branch with a few units. For them the branch
 * work must be invisible: no header switcher, no Branch column on lists, no
 * Branch field on forms. There is no configuration flag behind this — the rule
 * is simply "more than one ACTIVE branch", so this spec runs first, while the
 * seeded company still has only its Head Office.
 *
 * Source of truth: the plan's "Rule: a single-branch company must never see the
 * branch layer".
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { activeBranches, restoreSingleBranch } from '../../helpers/branch-seed.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';

let api;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  // A previous run may have left a second branch behind; this suite's premise
  // is one active branch, so put the company back before asserting on it.
  await restoreSingleBranch(api);
});

test.afterAll(async () => { await api?.dispose(); });

test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

test.describe('Branch hierarchy — single-branch company', () => {

  test('the seeded company has exactly one active branch, and it is the head office', async () => {
    const branches = await activeBranches(api);
    expect(branches).toHaveLength(1);
    expect(branches[0].isHeadOffice).toBe(true);
  });

  test('no working-branch switcher in the header', async ({ page }) => {
    await navigateWithAuth(page, '/dashboard');
    await waitForPageReady(page);
    // The header renders, but the switcher inside it does not.
    await expect(page.locator('.ant-layout-header').first()).toBeVisible();
    await expect(page.getByLabel('Working branch')).toHaveCount(0);
  });

  test('order list shows no Branch column', async ({ page }) => {
    await navigateWithAuth(page, '/orders/list');
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('.ant-table-thead').first().getByText('Branch', { exact: true })).toHaveCount(0);
  });

  test('stock register shows no Branch column', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/stock');
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('.ant-table-thead').first().getByText('Branch', { exact: true })).toHaveCount(0);
  });

  test('units master shows no Branch picker on the form', async ({ page }) => {
    await navigateWithAuth(page, '/hr/masters');
    await waitForPageReady(page);
    await page.getByText('Units', { exact: true }).first().click();
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: /Add Unit/i }).click();
    await page.getByRole('heading', { name: /New Unit/i }).waitFor({ state: 'visible', timeout: 8000 });
    // Unit Type is on the form; Branch is not, because there is only one.
    await expect(page.getByLabel('Unit Type')).toBeVisible();
    await expect(page.locator('.ant-form-item-label').getByText('Branch', { exact: true })).toHaveCount(0);
  });

  test('a document created without a branch still lands at the head office', async () => {
    const [ho] = await activeBranches(api);
    // The GRN list is branch-aware; with one branch every row belongs to it.
    const { data } = await api.get('/grns', { size: '50' });
    const rows = data?.content || [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((g) => g.branchId === ho.id)).toBe(true);
  });

  test('the Branches master is still reachable — it is how a company grows', async ({ page }) => {
    await navigateWithAuth(page, '/master');
    await waitForPageReady(page);
    await page.getByText('Branches', { exact: true }).first().click();
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByRole('button', { name: /Add Branch/i })).toBeVisible();
  });
});
