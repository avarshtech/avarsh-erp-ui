/**
 * BOM — Create BOM's "Recently created" orders (the history icon in the Order No box).
 *
 * Defect (2026-11-21): staff could not find their new orders there, as they find costings on the New Order
 * screen. The list was the newest five confirmed orders of every branch, with or without a BOM — an order still
 * waiting for its BOM was pushed off by orders whose BOM was made, which create refuses anyway — and under
 * RBAC ENFORCE a BOM user without the Orders permission was refused it, so the icon never showed.
 *
 * What this tests:
 *   - GET /orders/recent lists a newly confirmed order with no BOM, and leaves out a newer one that has its BOM
 *   - Create BOM's history icon offers the same, and picking the order fills the order's facts
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder, loadBomRefs, buildBomPayload } from '../../helpers/bom-seed.js';

let api;
let waiting; // confirmed, no BOM: must be suggested
let done; // confirmed later, BOM made: must not be
let bomId;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  waiting = await seedConfirmedOrder(api);
  done = await seedConfirmedOrder(api);
  bomId = (await api.post('/boms', buildBomPayload(done.order, await loadBomRefs(api)))).data.id;
});

test.afterAll(async () => {
  try { await api.delete(`/boms/${bomId}`); } catch { /* gone */ }
  for (const seeded of [done, waiting]) {
    try { await api.delete(`/orders/${seeded.order.id}`); } catch { /* gone */ }
    try { await api.delete(`/cost-sheets/${seeded.costSheetId}`); } catch { /* gone */ }
  }
  await api.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('the recent orders are confirmed orders still waiting for their BOM', async () => {
  const recent = (await api.get('/orders/recent')).data.map((o) => o.orderNo);
  expect(recent).toContain(waiting.order.orderNo);
  expect(recent).not.toContain(done.order.orderNo);
  expect(recent.length).toBeLessThanOrEqual(5);
});

test('Create BOM offers the waiting order under the history icon, and picking it loads the order', async ({ page }) => {
  await navigateWithAuth(page, '/bom/new');
  const recentButton = page.getByRole('button', { name: /history/i }).or(page.locator('button[title="Recently created"]')).first();
  await expect(recentButton).toBeVisible({ timeout: 30000 });
  await recentButton.click();

  const menu = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText(waiting.order.orderNo);
  await expect(menu).not.toContainText(done.order.orderNo);

  await menu.locator('.ant-dropdown-menu-item').filter({ hasText: waiting.order.orderNo }).click();
  await expect(page.locator('input[name="orderNo"]')).toHaveValue(waiting.order.orderNo);
  await expect(page.locator('input[name="styleNo"]')).toHaveValue(waiting.order.styleNo, { timeout: 15000 });
});
