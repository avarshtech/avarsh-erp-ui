/**
 * Orders — Revised dispatch date driven by a supplier PO delay (API + UI)
 *
 * A supplier PO names the orders it feeds in order_references. When its delivery
 * date is re-agreed later, the worst such slip is written on the order as
 * dispatchDelayDays + dispatchDelaySource and every line's revisedDispatchDate
 * is derived from it; the committed dispatchDate never changes. Pulling the PO
 * back to its agreed date, or cancelling it, clears the shift again — the figure
 * is recomputed from live data, never remembered.
 *
 * The e2e seed configures an approval flow for POs and the superadmin is not
 * its approver (see po-workflow.spec.js), so the PO is moved to Sent_To_Supplier
 * by a direct status save — the generic save accepts a status transition.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage, navigateWithAuth } from '../../helpers/navigation.js';

const plusDays = (isoDate, days) => new Date(new Date(isoDate).getTime() + days * 864e5).toISOString().slice(0, 10);

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

let api;
let order;
let po;

const getOrder = async () => ok(await api.get(`/orders/${order.id}`), 'get order');
const getPo = async () => ok(await api.get(`/purchase-orders/${po.id}`), 'get po');
const revise = (date, reason) => api.put(`/purchase-orders/${po.id}/revise-delivery-date`, {
  revisedDeliveryDate: date, reason, stageUpdates: [],
});

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  const costing = await seedApprovedCosting(api);
  const refs = await loadOrderRefs(api, costing.buyerId);
  order = ok(await api.post('/orders', buildOrderPayload(costing, refs)), 'create order');

  const poRefs = await loadPoRefs(api);
  const draft = buildGeneralPo(poRefs.localSupplier, poRefs.item, poRefs.terms, {});
  draft.orderReferences = [{ orderId: order.id, orderNo: order.orderNo }];
  po = ok(await api.post('/purchase-orders', draft), 'create po');
  const current = await getPo();
  po = ok(await api.post('/purchase-orders', { ...current, id: po.id, status: 'Sent_To_Supplier' }), 'send po to supplier');
  expect(po.status).toBe('Sent_To_Supplier');
});

test.afterAll(async () => {
  try { const cur = await getPo(); await api.put(`/purchase-orders/${po.id}/cancel`, { reason: 'e2e cleanup', version: cur.version }); } catch { /* already cancelled */ }
  try { await api.delete(`/orders/${order.id}`); } catch { /* referenced by the PO — left behind like other specs */ }
  await api.dispose();
});

test.describe('Orders — dispatch shift from a supplier PO delay', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('revising the PO delivery date pushes every order line by the slip, original untouched', async () => {
    const before = await getOrder();
    expect(before.dispatchDelayDays).toBeUndefined();
    expect(before.orderLines.length).toBeGreaterThan(0);

    ok(await revise(plusDays(po.deliveryDate, 10), 'Supplier confirmed a 10 day slip'), 'revise delivery date');

    const after = await getOrder();
    expect(after.dispatchDelayDays).toBe(10);
    expect(after.dispatchDelaySource).toBe(`Supplier PO ${po.poNumber}`);
    for (const line of after.orderLines) {
      const original = before.orderLines.find((l) => l.lineNo === line.lineNo);
      expect(line.dispatchDate).toBe(original.dispatchDate);
      expect(line.revisedDispatchDate).toBe(plusDays(line.dispatchDate, 10));
    }
    // The old PO-side projection went with the card that rendered it.
    const gone = await api.get(`/purchase-orders/order-delays?orderId=${order.id}`);
    expect(gone.status).toBeGreaterThanOrEqual(400);
  });

  test('the Orders list and the order view show the revised date and never the PO', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);
    await expect(page.getByRole('columnheader', { name: 'Dispatch', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Supplier Delay', exact: true })).toHaveCount(0);

    await page.getByPlaceholder(/search/i).first().fill(order.orderNo);
    await page.waitForTimeout(900);
    const row = page.locator('.ant-table-row', { hasText: order.orderNo }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('+10d');

    await navigateWithAuth(page, `/orders/list?viewId=${order.id}`);
    const dialog = page.locator('.ant-modal-wrap:visible').first();
    await expect(dialog.getByText('Revised Dispatch').first()).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByText('Dispatch +10d').first()).toBeVisible();
    await expect(dialog.getByText('Supplier Delays')).toHaveCount(0);
    await expect(dialog.getByText(po.poNumber)).toHaveCount(0);
  });

  test('pulling the PO back to its agreed date clears the shift', async () => {
    ok(await revise(po.deliveryDate, 'Supplier recovered the slip'), 'revise back');

    const after = await getOrder();
    expect(after.dispatchDelayDays).toBeUndefined();
    expect(after.dispatchDelaySource).toBeUndefined();
    for (const line of after.orderLines) expect(line.revisedDispatchDate).toBeUndefined();
  });

  test('cancelling a delayed PO withdraws its slip from the order', async () => {
    ok(await revise(plusDays(po.deliveryDate, 5), 'Second slip'), 'revise again');
    expect((await getOrder()).dispatchDelayDays).toBe(5);

    const current = await getPo();
    ok(await api.put(`/purchase-orders/${po.id}/cancel`, {
      reason: 'Material re-sourced elsewhere', version: current.version,
    }), 'cancel po');
    expect((await getOrder()).dispatchDelayDays).toBeUndefined();
  });
});
