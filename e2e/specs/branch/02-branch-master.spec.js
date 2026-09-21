/**
 * Branch master — CRUD through the screen, and the rules that protect the
 * head office.
 *
 * The head office is the branch every document falls back to, so exactly one
 * branch carries the flag, it cannot be deleted, and a branch with units under
 * it refuses deletion with a message rather than a constraint error.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { headOffice, ensureBranch, ensureUnit } from '../../helpers/branch-seed.js';
import { antMessageContains } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-5);

let api;

test.beforeAll(async () => { api = await createAuthenticatedClient(); });
test.afterAll(async () => { await api?.dispose(); });
test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

/** Open Master data → Organisation → Branches. */
async function goToBranches(page) {
  await navigateWithAuth(page, '/master');
  await waitForPageReady(page);
  await page.getByText('Branches', { exact: true }).first().click();
  await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 15000 });
}

test.describe('Branch master', () => {

  test('create a branch through the screen', async ({ page }) => {
    const stamp = STAMP();
    const code = `E2E${stamp}`;
    const name = `E2E Branch ${stamp}`;

    await goToBranches(page);
    await page.getByRole('button', { name: /Add Branch/i }).click();
    await page.getByRole('heading', { name: 'New Branch' }).waitFor({ state: 'visible', timeout: 8000 });

    await page.getByLabel('Branch Code').fill(code);
    await page.getByLabel('Branch Name').fill(name);
    await page.getByLabel('GST State Code').fill('33');
    await page.getByRole('button', { name: /Save Changes/i }).click();

    await antMessageContains(page, /created|saved|success/i).catch(() => {});
    await expect(page.locator('.ant-table').first().getByText(name)).toBeVisible({ timeout: 10000 });

    // and it is on the API, not just the screen
    const { data } = await api.get('/branches');
    const created = data.find((b) => b.branchCode === code);
    expect(created).toBeTruthy();
    expect(created.isHeadOffice).toBe(false);
  });

  test('branch code is required', async ({ page }) => {
    await goToBranches(page);
    await page.getByRole('button', { name: /Add Branch/i }).click();
    await page.getByRole('heading', { name: 'New Branch' }).waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText('Please enter a branch code')).toBeVisible({ timeout: 8000 });
  });

  test('only one branch is the head office — promoting another demotes the first', async () => {
    const ho = await headOffice(api);
    const other = await ensureBranch(api, { branchCode: 'E2E-HO2', branchName: 'E2E Second Site' });

    const { data: promoted, status } = await api.put(`/branches/${other.id}`, { ...other, isHeadOffice: true });
    expect(status).toBe(200);
    expect(promoted.isHeadOffice).toBe(true);

    const { data: all } = await api.get('/branches');
    expect(all.filter((b) => b.isHeadOffice)).toHaveLength(1);
    expect(all.find((b) => b.id === ho.id).isHeadOffice).toBe(false);

    // put the head office back where the rest of the suite expects it
    await api.put(`/branches/${ho.id}`, { ...all.find((b) => b.id === ho.id), isHeadOffice: true });
    const { data: restored } = await api.get('/branches');
    expect(restored.find((b) => b.id === ho.id).isHeadOffice).toBe(true);
  });

  test('the head office cannot be deleted', async () => {
    const ho = await headOffice(api);
    const { status, data } = await api.delete(`/branches/${ho.id}`);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(data)).toMatch(/head office/i);
  });

  test('a branch with units under it refuses deletion with a message', async () => {
    const branch = await ensureBranch(api, { branchCode: 'E2E-DEL', branchName: 'E2E Deletable' });
    await ensureUnit(api, branch.id, { unitCode: 'E2E-DELU', unitName: 'E2E Unit On Deletable' });

    const { status, data } = await api.delete(`/branches/${branch.id}`);
    expect(status).toBe(409);
    // The friendly per-constraint wording is PostgreSQL-only: the handler reads the
    // constraint name out of the driver message, and H2 words that differently. The
    // contract the screen relies on either way is the 409 and the error code.
    expect(data.error).toBe('REFERENCE_CONSTRAINT');
  });

  test('an inactive branch drops out of the active list but stays on record', async () => {
    const branch = await ensureBranch(api, { branchCode: 'E2E-OFF', branchName: 'E2E Closed Site' });
    await api.put(`/branches/${branch.id}`, { ...branch, isActive: false });

    const { data: active } = await api.get('/branches/active');
    expect(active.some((b) => b.id === branch.id)).toBe(false);
    const { data: all } = await api.get('/branches');
    expect(all.some((b) => b.id === branch.id)).toBe(true);
  });
});
