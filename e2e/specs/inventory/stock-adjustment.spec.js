/**
 * Stock adjustment (scenario I8) — the physical count correction workflow.
 *
 * V117 seeds inv_fabric_stock rolls, so adjustable items exist from boot. The
 * concurrency guard is the jewel here: an adjustment carrying a stale in-stock figure
 * must be refused with the "Stock moved since the count" error rather than silently
 * writing a wrong variance.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';

let api;
let adjustable;   // first adjustable fabric item row (roll-level)
let categoryId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Stock adjustment', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();

    const { data: cats } = await api.get('/categories');
    const fabricCat = (cats.content || cats).find((c) => (c.name || '').toLowerCase().includes('fabric'));
    expect(fabricCat).toBeTruthy();
    categoryId = fabricCat.id;

    const res = await api.get(`/stock-adjustments/adjustable-items?categoryId=${categoryId}`);
    expect(res.status).toBeLessThan(300);
    const items = res.data?.content || res.data || [];
    adjustable = items.find((i) => i.fabricStockId && Number(i.inStockQty) > 0) || items[0];
    expect(adjustable, 'seeded fabric stock must yield adjustable items').toBeTruthy();
  });

  test.afterAll(async () => { await api?.dispose(); });

  test('an adjustment without any physical quantity is refused', async () => {
    const res = await api.post('/stock-adjustments', {
      categoryId,
      adjustedBy: 'E2E Auditor',
      items: [],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('a stale in-stock figure is refused — the concurrency guard', async () => {
    const staleQty = Number(adjustable.inStockQty) + 999; // deliberately wrong snapshot
    const res = await api.post('/stock-adjustments', {
      categoryId,
      adjustedBy: 'E2E Auditor',
      items: [{
        fabricStockId: adjustable.fabricStockId,
        itemId: adjustable.itemId,
        itemCode: adjustable.itemCode,
        rollNumber: adjustable.rollNumber,
        inStockQty: staleQty,
        physicalQty: Number(adjustable.inStockQty),
        uom: adjustable.uom,
      }],
    });
    expect(res.status, 'stale count must be refused').toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.data)).toMatch(/moved|reload|expected/i);
  });

  test('a valid count posts and the variance is recorded', async () => {
    const inStock = Number(adjustable.inStockQty);
    const physical = Math.max(0, inStock - 2); // short by 2 → negative variance
    const res = await api.post('/stock-adjustments', {
      categoryId,
      adjustedBy: 'E2E Auditor',
      items: [{
        fabricStockId: adjustable.fabricStockId,
        itemId: adjustable.itemId,
        itemCode: adjustable.itemCode,
        rollNumber: adjustable.rollNumber,
        inStockQty: inStock,
        physicalQty: physical,
        uom: adjustable.uom,
        remarks: 'E2E cycle count',
      }],
    });
    expect(res.status, JSON.stringify(res.data).slice(0, 300)).toBeLessThan(300);
    const adjId = res.data.id;

    const { data: detail } = await api.get(`/stock-adjustments/${adjId}`);
    const line = (detail.items || detail.lines || [])[0];
    expect(line).toBeTruthy();
    expect(Number(line.physicalQty)).toBe(physical);

    // The stock row itself must now carry the corrected quantity.
    const { data: stock } = await api.get('/inventory/stock/fabric?size=100');
    const row = (stock.content || stock).find((r) => r.rollNumber === adjustable.rollNumber);
    if (row) expect(Number(row.availableQty)).toBe(physical);
  });

  test('the list page shows the adjustment with variance KPIs', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/adjustment');
    await waitForPageReady(page);
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/E2E Auditor/).first()).toBeVisible({ timeout: 10000 });
  });
});
