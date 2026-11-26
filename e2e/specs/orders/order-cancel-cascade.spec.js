/**
 * Orders — what a cancellation does to the documents raised against the order (API).
 *
 * A draft or pending supplier PO that buys for this order alone is cancelled with it; an approved PO
 * blocks the request (422 naming it) until it is cancelled; a rejected cancel request leaves the order
 * CONFIRMED and its documents untouched. GET /orders/{id}/cancel-impact shows the outcome beforehand.
 * With no ORDER flow the request waits for a manual decision (CANCEL_REQUESTED → CANCELLED, the order
 * screen's Approve); the reject case adds an ORDER flow and decides it in the approval engine.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';

let api;
let director;
let orderRefs;
let poRefs;

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  director = await createAuthenticatedClient('e2e-director', 'Director@123').catch(() => null);
  orderRefs = await loadOrderRefs(api);
  poRefs = await loadPoRefs(api);
});
test.afterAll(async () => {
  await api.dispose();
  await director?.dispose();
});

async function confirmedOrder() {
  const costing = await seedApprovedCosting(api);
  const draft = ok(await api.post('/orders', buildOrderPayload(costing, orderRefs, { remarks: 'E2E cancel cascade' })), 'create order');
  ok(await api.put(`/orders/${draft.id}/status`, { status: 'CONFIRMED', version: draft.version }), 'confirm');
  return ok(await api.get(`/orders/${draft.id}`), 'read order');
}

async function draftPo(order) {
  const body = buildGeneralPo(poRefs.localSupplier, poRefs.item, poRefs.terms, {
    orderReferences: [{ orderId: order.id, orderNo: order.orderNo, styleName: order.styleNo }],
  });
  return ok(await api.post('/purchase-orders', body), 'create supplier PO');
}

async function approvedPo(order) {
  let po = await draftPo(order);
  const now = ok(await api.get(`/purchase-orders/${po.id}`), 'read PO');
  po = ok(await api.post(`/purchase-orders/${po.id}/submit`, { version: now.version }), 'submit PO');
  for (let level = 0; po.status === 'Pending_Approval' && level < 5; level++) {
    po = ok(await (director || api).put(`/purchase-orders/${po.id}/approve`, { comment: 'e2e' }), 'approve PO');
  }
  expect(po.status).toBe('Sent_To_Supplier');
  return po;
}

/** Requests the cancellation and approves it the way the order screen does without a flow. */
async function cancelOrder(order) {
  ok(await requestCancel(order), 'request cancel');
  const requested = ok(await api.get(`/orders/${order.id}`), 'order');
  expect(requested.status).toBe('CANCEL_REQUESTED');
  ok(await api.put(`/orders/${order.id}/status`, { status: 'CANCELLED', version: requested.version }), 'approve cancel');
}

const requestCancel = (order, reason = 'Buyer dropped the programme for this season; cancel the order and its open documents.') =>
  api.put(`/orders/${order.id}/status`, { status: 'CANCEL_REQUESTED', version: order.version, reason });

test.describe('Orders — cancellation cascade', () => {
  test('a draft supplier PO for this order alone is cancelled with the order', async () => {
    const order = await confirmedOrder();
    const po = await draftPo(order);

    const impact = ok(await api.get(`/orders/${order.id}/cancel-impact`), 'impact');
    expect(impact.cancellable).toBe(true);
    expect(impact.items.find((i) => i.number === po.poNumber)?.action).toBe('AUTO_CANCEL');

    await cancelOrder(order);
    expect(ok(await api.get(`/orders/${order.id}`), 'order').status).toBe('CANCELLED');
    expect(ok(await api.get(`/purchase-orders/${po.id}`), 'PO').status).toBe('Cancelled');
  });

  test('an approved supplier PO blocks the cancellation until it is cancelled', async () => {
    const order = await confirmedOrder();
    const po = await approvedPo(order);

    const impact = ok(await api.get(`/orders/${order.id}/cancel-impact`), 'impact');
    expect(impact.cancellable).toBe(false);
    expect(impact.items.find((i) => i.number === po.poNumber)?.action).toBe('BLOCKS');

    const refused = await requestCancel(order);
    expect(refused.status).toBe(422);
    expect(refused.data.message).toContain(po.poNumber);
    expect(ok(await api.get(`/orders/${order.id}`), 'order').status).toBe('CONFIRMED');

    const fresh = ok(await api.get(`/purchase-orders/${po.id}`), 'PO');
    ok(await api.put(`/purchase-orders/${po.id}/cancel`, { reason: 'Supplier agreed to cancel', version: fresh.version }), 'cancel PO');
    await cancelOrder(ok(await api.get(`/orders/${order.id}`), 'order'));
    expect(ok(await api.get(`/orders/${order.id}`), 'order').status).toBe('CANCELLED');
  });

  test('a rejected cancel request leaves the order CONFIRMED and its draft PO alone', async () => {
    const { data: roles } = await api.get('/roles');
    const flow = ok(await api.post('/approval-flows', {
      name: `E2E ORDER cancel ${Date.now()}`, entityType: 'ORDER', active: true, priority: 60,
      levels: [{ levelNumber: 1, levelName: 'Single gate', approverType: 'ROLE',
        approverRoleId: roles.find((r) => r.name === 'Super Admin').id, allowReferBack: false, allowReject: true }],
    }), 'create ORDER flow');
    try {
      const order = await confirmedOrder();
      const po = await draftPo(order);
      ok(await requestCancel(order), 'request cancel');
      expect(ok(await api.get(`/orders/${order.id}`), 'order').status).toBe('CANCEL_REQUESTED');

      const req = await findPendingRequest(api, 'ORDER', order.id);
      expect(req, 'the ORDER flow holds the cancel request').toBeTruthy();
      await actOnRequest(director || api, req.id, 'REJECT', 'Buyer confirmed the order stands; keep producing it.');

      expect(ok(await api.get(`/orders/${order.id}`), 'order').status).toBe('CONFIRMED');
      expect(ok(await api.get(`/purchase-orders/${po.id}`), 'PO').status).toBe('Draft');
    } finally {
      const { data } = await api.get(`/approval-flows/${flow.id}`);
      if (data?.active) await api.patch(`/approval-flows/${flow.id}/toggle`);
    }
  });
});
