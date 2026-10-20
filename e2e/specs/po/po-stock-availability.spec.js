import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

/**
 * Stock availability on the PO line.
 *
 * A buyer about to commit to a purchase quantity should see what is already on the rack
 * for that EXACT variant — not the item, and not its sibling colours. The figure is
 * informational: it reserves nothing, and the quantity only changes when the buyer says so.
 *
 * Seed fixtures this leans on (V113 + V117):
 *   PO/0001 is the only Draft (editable) PO.
 *     fabric line — FAB-SJ-001-NVY, 500 kg, and 1400 kg of navy is in stock in kg
 *                   → the figure shows and the reduce action is available
 *     trims line  — TRM-BTN-001-NAT bought in grs, stock held in pcs
 *                   → the figure shows but the action is not offered
 *   PO/0003 trims — TRM-BTN-001-BLK, a colour with no stock at all, even though 30000 pcs
 *                   of the NATURAL variant of the same item is on the rack
 *                   → nothing renders, which is the whole point of "exact variant"
 */

const AVAILABILITY = '/inventory/stock/availability';

/** The PO list takes no search parameter, so page wide and pick the one we want. */
async function variantOf(api, poNumber, itemCode) {
  const { data } = await api.get('/purchase-orders', { size: '100' });
  const po = (data.content || data || []).find((p) => p.poNumber === poNumber);
  expect(po, `${poNumber} should be seeded`).toBeTruthy();
  const { data: detail } = await api.get(`/purchase-orders/${po.id}`);
  const line = detail.lineItems.find((l) => l.itemCode === itemCode);
  expect(line, `${poNumber} should have a ${itemCode} line`).toBeTruthy();
  return { poId: po.id, line };
}

test.describe('PO — Stock availability', () => {
  test('availability is reported for the exact variant, never its siblings', async () => {
    const api = await createAuthenticatedClient();
    try {
      const navy = await variantOf(api, 'PO/0001', 'FAB-SJ-001');
      const blackButton = await variantOf(api, 'PO/0003', 'TRM-BTN-001');

      const { data: rows } = await api.get(AVAILABILITY, {
        variantIds: [navy.line.variantId, blackButton.line.variantId].join(','),
      });

      const forNavy = rows.find((r) => r.variantId === navy.line.variantId);
      expect(forNavy, 'navy jersey should report stock').toBeTruthy();
      expect(forNavy.uom).toBe('kg');
      expect(Number(forNavy.availableQty)).toBe(1400);
      expect(forNavy.variantCode).toBe('FAB-SJ-001-NVY');

      // The natural button of the SAME item has 30000 pcs on the rack. Matching on the
      // item would have reported it here; matching on the variant reports nothing.
      expect(rows.find((r) => r.variantId === blackButton.line.variantId)).toBeUndefined();
    } finally {
      await api.dispose();
    }
  });

  test('a variant with no stock is absent rather than zero', async () => {
    const api = await createAuthenticatedClient();
    try {
      const { data: rows } = await api.get(AVAILABILITY, { variantIds: '999999' });
      expect(rows).toEqual([]);
    } finally {
      await api.dispose();
    }
  });

  test('the PO form shows the stock and reduces the quantity only when asked', async ({ page }) => {
    await ensureSessionActive(page);

    const api = await createAuthenticatedClient();
    let poId;
    try {
      ({ poId } = await variantOf(api, 'PO/0001', 'FAB-SJ-001'));
    } finally {
      await api.dispose();
    }

    // navigateWithAuth, not a bare goto: a deep link lands on the login form when the
    // stored session has lapsed, and this signs back in rather than timing out on it.
    await navigateWithAuth(page, `/purchase-orders/supplier-po/edit/${poId}`);

    const fabricRow = page.locator('.ant-table-row').filter({ hasText: 'FAB-SJ-001' }).first();
    await expect(fabricRow).toBeVisible({ timeout: 20000 });

    // The figure, in the unit the stock is actually held in.
    await expect(fabricRow.getByText(/1,?400\.000 kg/)).toBeVisible({ timeout: 15000 });

    // Nothing has moved yet — the system never adjusts on its own.
    const qty = fabricRow.locator('.ant-input-number-input').first();
    await expect(qty).toHaveValue(/500/);

    // 500 ordered against 1400 already held leaves nothing to buy.
    await fabricRow.getByRole('button', { name: /reduce by stock/i }).click();
    await expect(qty).toHaveValue(/^0(\.0+)?$/);

    // The trims line buys in grs while its stock is held in pcs, so the figure is shown
    // but the action is withheld rather than silently converting between units.
    const trimsRow = page.locator('.ant-table-row').filter({ hasText: 'TRM-BTN-001' }).first();
    await expect(trimsRow.getByText(/different unit/i)).toBeVisible();
    await expect(trimsRow.getByRole('button', { name: /reduce by stock/i })).toHaveCount(0);
  });
});
