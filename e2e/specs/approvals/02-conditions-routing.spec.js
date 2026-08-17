/**
 * Approval engine — condition routing and the auto-approve hazard (AF7, AF8).
 *
 * The engine picks the highest-priority ACTIVE flow whose conditions all pass against
 * the entityData the module submits — for PURCHASE_ORDER that is {grandTotal, poType}
 * (PurchaseOrderService:173). When nothing matches, the module AUTO-APPROVES.
 *
 * Which flow matched is asserted behaviourally — by who is allowed to approve — not by
 * inspecting DTO internals: the high-value flow's approver is Super Admin, the low-value
 * flow's is Admin, so a wrong routing shows up as the wrong person having power.
 *
 * Order in this file matters (serial): the AF8 test deactivates every PO flow and must
 * restore the seeded one afterwards, so it runs last.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';

const MANAGER = { username: 'e2e-manager', password: 'Manager@123' };
const THRESHOLD = 1000000;

let superadmin;
let manager;
let refs;
let highFlowId;
let lowFlowId;
let roleId = {};

async function createDraftPo(api, { unitPrice }) {
  // qty is fixed at 10, so unitPrice is the lever for grandTotal: 90,000 × 10 clears
  // the 1M threshold with tax on top; 10 × 10 stays far below it.
  const po = buildGeneralPo(refs.localSupplier, refs.item, refs.terms, { unitPrice });
  const res = await api.post('/purchase-orders', po);
  expect(res.status).toBeLessThan(300);
  return res.data;
}

async function submitPo(api, poId) {
  const { data: cur } = await api.get(`/purchase-orders/${poId}`);
  const res = await api.post('/purchase-orders', { ...cur, id: poId, status: 'Pending_Approval' });
  expect(res.status).toBeLessThan(300);
  return res.data;
}

test.describe('Approval engine — condition routing', () => {
  test.beforeAll(async () => {
    superadmin = await createAuthenticatedClient();
    manager = await createAuthenticatedClient(MANAGER.username, MANAGER.password).catch(() => null);
    expect(manager, 'run 01-multi-level-engine first — it creates e2e-manager').toBeTruthy();
    refs = await loadPoRefs(superadmin);

    const { data: roles } = await superadmin.get('/roles');
    for (const r of Array.isArray(roles) ? roles : roles?.content || []) roleId[r.name] = r.id;

    // High-value flow: only POs with grandTotal >= THRESHOLD, approver Super Admin.
    const high = await superadmin.post('/approval-flows', {
      name: `E2E High Value PO ${Date.now()}`,
      entityType: 'PURCHASE_ORDER',
      active: true,
      priority: 20,
      levels: [{
        levelNumber: 1, levelName: 'Finance head', approverType: 'ROLE',
        approverRoleId: roleId['Super Admin'], allowReferBack: false, allowReject: true,
      }],
      conditions: [{ field: 'grandTotal', operator: 'GTE', value: String(THRESHOLD) }],
    });
    expect(high.status).toBeLessThan(300);
    highFlowId = high.data.id;

    // Low-value flow: no conditions, lower priority, approver Admin.
    const low = await superadmin.post('/approval-flows', {
      name: `E2E Low Value PO ${Date.now()}`,
      entityType: 'PURCHASE_ORDER',
      active: true,
      priority: 10,
      levels: [{
        levelNumber: 1, levelName: 'Manager', approverType: 'ROLE',
        approverRoleId: roleId['Admin'], allowReferBack: false, allowReject: true,
      }],
    });
    expect(low.status).toBeLessThan(300);
    lowFlowId = low.data.id;
  });

  test.afterAll(async () => {
    // Deactivate (not delete — historical requests reference the flows).
    for (const id of [highFlowId, lowFlowId]) {
      if (id) {
        const { data } = await superadmin.get(`/approval-flows/${id}`);
        if (data?.active) await superadmin.patch(`/approval-flows/${id}/toggle`);
      }
    }
    await superadmin?.dispose();
    await manager?.dispose();
  });

  test('AF7a — a PO above the threshold routes to the high-value flow (Super Admin approver)', async () => {
    const po = await createDraftPo(superadmin, { unitPrice: 90000 }); // pushes grandTotal past 1M
    await submitPo(superadmin, po.id);

    const req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req).toBeTruthy();

    // Manager (Admin) must be refused — proof the low flow did NOT match.
    const wrong = await manager.post(`/approval-requests/${req.id}/action`, {
      actionType: 'APPROVE', comments: 'manager should not hold this level',
    });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    await actOnRequest(superadmin, req.id, 'APPROVE', 'High-value approval');
    expect((await superadmin.get(`/purchase-orders/${po.id}`)).data.status).toBe('Sent_To_Supplier');
  });

  test('AF7b — a PO below the threshold falls to the low-value flow (Admin approver)', async () => {
    const po = await createDraftPo(superadmin, { unitPrice: 10 });
    await submitPo(superadmin, po.id);

    const req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req).toBeTruthy();

    // Superadmin must be refused — proof the high flow's condition excluded this PO.
    const wrong = await superadmin.post(`/approval-requests/${req.id}/action`, {
      actionType: 'APPROVE', comments: 'super admin should not hold this level',
    });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    await actOnRequest(manager, req.id, 'APPROVE', 'Low-value approval');
    expect((await superadmin.get(`/purchase-orders/${po.id}`)).data.status).toBe('Sent_To_Supplier');
  });

  test('AF8 — with every PO flow inactive, submit silently auto-approves (the hazard)', async () => {
    // Deactivate ALL active PURCHASE_ORDER flows (ours + the seeded one), remembering
    // which we toggled so the seeded flow can be restored afterwards.
    const { data: flows } = await superadmin.get('/approval-flows');
    const toggled = [];
    for (const f of flows.filter((f) => f.entityType === 'PURCHASE_ORDER' && f.active)) {
      await superadmin.patch(`/approval-flows/${f.id}/toggle`);
      toggled.push(f.id);
    }

    try {
      const po = await createDraftPo(superadmin, { unitPrice: 50 });
      const after = await submitPo(superadmin, po.id);

      // No flow matched → the module auto-approves in the same call.
      expect(after.status).toBe('Sent_To_Supplier');
      expect(await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id)).toBeNull();
    } finally {
      for (const id of toggled) {
        // Restore only the seeded flow; leave the two test flows inactive.
        if (id !== highFlowId && id !== lowFlowId) {
          await superadmin.patch(`/approval-flows/${id}/toggle`);
        }
      }
    }
  });
});
