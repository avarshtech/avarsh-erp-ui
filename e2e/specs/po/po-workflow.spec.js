/**
 * PO — Status Lifecycle & Approval Workflow (API)
 *
 * Transitions (PurchaseOrderService.validatePoStatusTransition):
 *   Draft → Pending_Approval | Cancelled
 *   Pending_Approval → Sent_To_Supplier | Rejected | Referred_Back | Cancelled
 *   Rejected / Referred_Back → Pending_Approval (edit & resubmit)
 *
 * IMPORTANT (e2e): unlike costing/orders, the PURCHASE_ORDER module HAS a
 * configured approval flow in the e2e seed. So:
 *   - submitting (status Pending_Approval) creates a PENDING approval request and
 *     the PO stays Pending_Approval (it does NOT auto-approve).
 *   - approve/reject/refer-back route through the engine's processAction, which
 *     validates the approver ROLE. The e2e superadmin is not the configured
 *     approver for the PO flow level, so those decisions are correctly REFUSED
 *     ("You do not have the required role to approve at this level").
 *   - cancel is a direct module action (not engine-gated) and is reachable.
 *
 * These tests assert the reachable, correct behavior for this user.
 *
 * Status enum: Draft | Pending_Approval | Sent_To_Supplier | Rejected |
 *              Referred_Back | Cancelled | Partially_Received | Completed.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';

let api;
let refs;
const createdPos = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  refs = await loadPoRefs(api);
});
test.afterAll(async () => {
  for (const id of createdPos) { try { await api.delete(`/purchase-orders/${id}`); } catch { /* gone */ } }
  await api.dispose();
});

async function newDraftPo() {
  const res = await api.post('/purchase-orders', buildGeneralPo(refs.localSupplier, refs.item, refs.terms, {}));
  if (res.data?.id) createdPos.push(res.data.id);
  expect(res.data.status).toBe('Draft');
  return res.data;
}

const get = async (id) => (await api.get(`/purchase-orders/${id}`)).data;

async function submit(po) {
  const cur = await get(po.id);
  const res = await api.post('/purchase-orders', { ...cur, id: po.id, status: 'Pending_Approval' });
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  return get(po.id);
}

test.describe('PO — Status Lifecycle', () => {
  test('Draft → submit → Pending_Approval, and a PENDING approval request is raised', async () => {
    const po = await newDraftPo();
    const after = await submit(po);
    expect(after.status).toBe('Pending_Approval');

    // The centralized engine should now hold a request for this PO.
    const reqRes = await api.get(`/approval-requests/entity/PURCHASE_ORDER/${po.id}`);
    expect(reqRes.status).toBe(200);
    const requests = Array.isArray(reqRes.data) ? reqRes.data : [reqRes.data].filter(Boolean);
    const hasPending = requests.some((r) => String(r.status).toUpperCase().includes('PENDING'));
    expect(hasPending).toBeTruthy();
  });

  test('Draft → Cancel → Cancelled (direct module action)', async () => {
    const po = await newDraftPo();
    const r = await api.put(`/purchase-orders/${po.id}/cancel`, {
      reason: 'Created in error — cancel this draft.', version: po.version,
    });
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(300);
    expect((await get(po.id)).status).toBe('Cancelled');
  });

  test('Pending_Approval → Cancel → Cancelled', async () => {
    const po = await newDraftPo();
    const pending = await submit(po);
    expect(pending.status).toBe('Pending_Approval');
    const r = await api.put(`/purchase-orders/${po.id}/cancel`, {
      reason: 'Buyer cancelled the order — cancel the PO.', version: pending.version,
    });
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(300);
    expect((await get(po.id)).status).toBe('Cancelled');
  });

  test('Approve by a non-approver is refused by the engine (role guard)', async () => {
    const po = await newDraftPo();
    await submit(po);
    // superadmin is not the configured approver for the PO flow level → refused.
    const r = await api.put(`/purchase-orders/${po.id}/approve`, { comment: 'try approve' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    // PO remains pending (no unauthorized advance)
    expect((await get(po.id)).status).toBe('Pending_Approval');
  });
});

test.describe('PO — Version history & delete guard', () => {
  test('Version history is recorded after submit', async () => {
    const po = await newDraftPo();
    await submit(po);
    const res = await api.get(`/purchase-orders/${po.id}/versions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
  });

  test('A non-Draft PO cannot be deleted', async () => {
    const po = await newDraftPo();
    await submit(po); // → Pending_Approval
    const del = await api.delete(`/purchase-orders/${po.id}`);
    expect(del.status).toBeGreaterThanOrEqual(400);
    expect((await get(po.id)).status).toBe('Pending_Approval');
  });
});
