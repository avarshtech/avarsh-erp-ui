/**
 * Process Master — 'Cut Panel' and 'Garment' categories
 *
 * The Cut Panel Requirement reads the process master's 'Cut Panel' category and the
 * Garment Process Requirement its 'Garment' category (no new master). Both categories
 * carry neither a cost nor allowances.
 *
 * What this tests:
 *   - API: /processes/active?category= returns the seeded rows of each category, and
 *     neither leaks into the Manufacturing list the cost sheet reads
 *   - UI: a 'Cut Panel' process shows no cost / allowance fields, explains where it is
 *     used, saves with every default at 0 and lists with a "Requirement" type tag
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData, antFormSelect } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';

const STAMP = () => `${Date.now()}`.slice(-6);
let api;

test.beforeAll(async () => { api = await createAuthenticatedClient(); });
test.afterAll(async () => { await api.dispose(); });
test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

test('API — each requirement category returns its own seeded processes', async () => {
  const names = async (category) => (await api.get(`/processes/active?category=${encodeURIComponent(category)}`)).data.map((p) => p.processName);

  const cutPanel = await names('Cut Panel');
  expect(cutPanel).toEqual(expect.arrayContaining(['Panel Printing', 'Panel Embroidery', 'Heat Transfer', 'Other']));

  const garment = await names('Garment');
  expect(garment).toEqual(expect.arrayContaining(['Enzyme Washing', 'Bleach Washing', 'Softener Washing', 'Other']));

  const manufacturing = await names('Manufacturing');
  expect(manufacturing).not.toContain('Panel Printing');
  expect(manufacturing).not.toContain('Enzyme Washing');
});

test('UI — a Cut Panel process carries no cost or allowance and lists as "Requirement"', async ({ page }) => {
  const name = `E2E Panel Process ${STAMP()}`;
  await goToMasterEntity(page, 'Processes');
  await antTableWaitForData(page);
  await page.getByRole('button', { name: /Add Process/i }).click();
  await page.waitForTimeout(400);

  await page.locator('#processName').fill(name);
  await antFormSelect(page, 'Category', 'Cut Panel');
  await expect(page.getByText(/Listed on the Cut Panel Requirement screen/)).toBeVisible();
  await expect(page.locator('#defaultCost')).toHaveCount(0);
  await expect(page.locator('#defaultShrinkageInches')).toHaveCount(0);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/processes') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Save/i }).click(),
  ]);
  expect(resp.status()).toBeLessThan(300);
  const body = resp.request().postDataJSON();
  expect(body.category).toBe('Cut Panel');
  for (const field of ['defaultCost', 'defaultShrinkageInches', 'defaultProcessLossPercent', 'defaultRejectionPercent', 'defaultShipmentAllowancePercent']) {
    expect(body[field]).toBe(0);
  }

  await antTableWaitForData(page);
  const row = page.locator('.ant-table-row').filter({ hasText: name });
  await expect(row.getByText('Requirement')).toBeVisible();

  const created = await resp.json();
  await api.delete(`/processes/${created.id}`).catch(() => {});
});
