/**
 * Orders — Status Lifecycle & Approval Workflow (API)
 *
 * Transitions (OrderService.validateStatusTransition):
 *   DRAFT → CONFIRMED (submit)
 *   REFERRED_BACK → CONFIRMED (resubmit)
 *   CONFIRMED → REFER_BACK_REQUESTED | CANCEL_REQUESTED (with reason)
 *   REFER_BACK_REQUESTED → REFERRED_BACK (approve)
 *   CANCEL_REQUESTED → CANCELLED (approve)
 *
 * Refer-back / cancel requests call submitForApproval. Under the no-flow e2e
 * profile the engine auto-resolves, so the request transition lands on its
 * target state directly (mirrors costing). The tests assert the reachable
 * e2e outcomes and accept the pending-request state where the engine may hold.
 *
 * Status change endpoint: PUT /orders/{id}/status { status, reason?, version }.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';

let api;
let refs;
const createdOrders = [];
const createdCostings = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  refs = await loadOrderRefs(api);
});
test.afterAll(async () => {
  for (const id of createdOrders) { try { await api.delete(`/orders/${id}`); } catch { /* gone */ } }
  for (const id of createdCostings) { try { await api.delete(`/cost-sheets/${id}`); } catch { /* gone */ } }
  await api.dispose();
});

async function newDraftOrder() {
  const costing = await seedApprovedCosting(api);
  createdCostings.push(costing.costSheetId);
  const res = await api.post('/orders', buildOrderPayload(costing, refs));
  if (res.data?.id) createdOrders.push(res.data.id);
  expect(res.data.status).toBe('DRAFT');
  return res.data;
}

const changeStatus = (id, status, version, reason) =>
  api.put(`/orders/${id}/status`, { status, reason, version });

test.describe('Orders — Status Lifecycle', () => {
  test('Draft → Confirmed (submit)', async () => {
    const o = await newDraftOrder();
    const r = await changeStatus(o.id, 'CONFIRMED', o.version);
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(300);
    const got = (await api.get(`/orders/${o.id}`)).data;
    expect(got.status).toBe('CONFIRMED');
  });

  test('Confirmed → Cancel requested → (auto-)Cancelled, reason persists', async () => {
    const o = await newDraftOrder();
    let got = (await api.get(`/orders/${o.id}`)).data;
    await changeStatus(o.id, 'CONFIRMED', got.version);
    got = (await api.get(`/orders/${o.id}`)).data;

    const reason = 'Buyer cancelled the program for this season — drop the order.';
    const r = await changeStatus(o.id, 'CANCEL_REQUESTED', got.version, reason);
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(300);

    got = (await api.get(`/orders/${o.id}`)).data;
    // no-flow engine auto-resolves the cancel → CANCELLED; otherwise it parks at CANCEL_REQUESTED
    expect(['CANCELLED', 'CANCEL_REQUESTED']).toContain(got.status);
    expect((got.cancelReason || got.referBackReason || '')).toContain('Buyer cancelled');
  });

  test('Confirmed → Refer-back requested → (auto-)Referred back', async () => {
    const o = await newDraftOrder();
    let got = (await api.get(`/orders/${o.id}`)).data;
    await changeStatus(o.id, 'CONFIRMED', got.version);
    got = (await api.get(`/orders/${o.id}`)).data;

    const reason = 'Costing needs revision — fabric price is stale, please re-quote.';
    const r = await changeStatus(o.id, 'REFER_BACK_REQUESTED', got.version, reason);
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(300);

    got = (await api.get(`/orders/${o.id}`)).data;
    expect(['REFERRED_BACK', 'REFER_BACK_REQUESTED']).toContain(got.status);
  });
});

test.describe('Orders — Edit/Delete guards', () => {
  test('Confirmed order can no longer be deleted (Draft-only)', async () => {
    const o = await newDraftOrder();
    const got = (await api.get(`/orders/${o.id}`)).data;
    await changeStatus(o.id, 'CONFIRMED', got.version);

    const del = await api.delete(`/orders/${o.id}`);
    expect(del.status).toBeGreaterThanOrEqual(400);
    const still = (await api.get(`/orders/${o.id}`)).data;
    expect(still.status).toBe('CONFIRMED');
  });
});
