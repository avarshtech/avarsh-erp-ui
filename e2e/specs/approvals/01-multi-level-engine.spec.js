/**
 * Approval engine — multi-level flows end to end (scenarios AF2–AF6, AF10).
 *
 * Uses the seeded 2-level PO flow (V115): Level 1 "Manager Review" = Admin role,
 * Level 2 "Director Approval" = Super Admin role.
 *
 * The seed contains NO user with the Admin role — superadmin is Super Admin — so a
 * Level-1 approver ("e2e-manager") is created here first. Without one, every seeded
 * PO is structurally un-approvable, which is itself worth knowing.
 *
 * All flows here are API-driven: the engine's correctness is about state, not widgets.
 * The UI faces of the same engine are covered in 03-my-approvals-ui.spec.js.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';
import { costSheetPayload, stylePayload } from '../../helpers/test-data.js';

const MANAGER = { username: 'e2e-manager', password: 'Manager@123' };

let superadmin; // Super Admin — submitter and Level-2 approver
let manager;    // Admin — Level-1 approver
let refs;

async function ensureManagerUser(api) {
  const { data: users } = await api.get('/users');
  const existing = (Array.isArray(users) ? users : users?.content || []).find(
    (u) => u.username === MANAGER.username,
  );
  if (existing) return existing;

  const { data: roles } = await api.get('/roles');
  const adminRole = (Array.isArray(roles) ? roles : roles?.content || []).find((r) => r.name === 'Admin');
  expect(adminRole, 'seeded Admin role must exist (V100)').toBeTruthy();

  const res = await api.post('/users', {
    name: 'E2E Manager',
    username: MANAGER.username,
    password: MANAGER.password,
    email: 'e2e-manager@avarsh.com',
    roleId: adminRole.id,
    isActive: true,
  });
  expect(res.status, `manager user create failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);
  return res.data;
}

async function createDraftPo(api) {
  const po = buildGeneralPo(refs.localSupplier, refs.item, refs.terms);
  const res = await api.post('/purchase-orders', po);
  expect(res.status).toBeLessThan(300);
  expect(res.data.status).toBe('Draft');
  return res.data;
}

async function submitPo(api, poId) {
  const { data: cur } = await api.get(`/purchase-orders/${poId}`);
  const res = await api.post(`/purchase-orders/${poId}/submit`, { version: cur.version });
  expect(res.status).toBeLessThan(300);
  return res.data;
}

async function poStatus(api, poId) {
  const { data } = await api.get(`/purchase-orders/${poId}`);
  return data.status;
}

test.describe('Approval engine — multi-level PO flow', () => {
  test.beforeAll(async () => {
    superadmin = await createAuthenticatedClient();
    await ensureManagerUser(superadmin);
    manager = await createAuthenticatedClient(MANAGER.username, MANAGER.password);
    refs = await loadPoRefs(superadmin);
  });

  test.afterAll(async () => {
    await superadmin?.dispose();
    await manager?.dispose();
  });

  test('AF2 — submit → L1 approve → still PENDING at L2 → L2 approve → Sent_To_Supplier', async () => {
    const po = await createDraftPo(superadmin);
    await submitPo(superadmin, po.id);

    let req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req, 'submit must raise a PENDING request').toBeTruthy();
    expect(req.currentLevel).toBe(1);

    // Level 1: manager (Admin role) approves. The entity must NOT advance yet.
    await actOnRequest(manager, req.id, 'APPROVE', 'L1 manager approve');
    expect(await poStatus(superadmin, po.id)).toBe('Pending_Approval');

    req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req, 'request stays PENDING between levels').toBeTruthy();
    expect(req.currentLevel).toBe(2);

    // Level 2: superadmin (Super Admin role) approves → listener fires the transition.
    await actOnRequest(superadmin, req.id, 'APPROVE', 'L2 director approve');
    expect(await poStatus(superadmin, po.id)).toBe('Sent_To_Supplier');
    expect(await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id)).toBeNull();
  });

  test('AF3 — reject at L2 terminates immediately and the entity lands Rejected', async () => {
    const po = await createDraftPo(superadmin);
    await submitPo(superadmin, po.id);

    let req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    await actOnRequest(manager, req.id, 'APPROVE', 'L1 ok');

    req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    await actOnRequest(superadmin, req.id, 'REJECT', 'Rejecting: supplier pricing needs a full re-negotiation.');

    expect(await poStatus(superadmin, po.id)).toBe('Rejected');

    // Resubmit starts a FRESH request back at level 1 — the old one is spent.
    await submitPo(superadmin, po.id);
    const fresh = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(fresh).toBeTruthy();
    expect(fresh.currentLevel).toBe(1);
    // Leave nothing pending behind for later specs.
    await actOnRequest(manager, fresh.id, 'REJECT', 'Cleanup rejection so no request stays pending.');
  });

  test('AF4 — refer-back at L1 → entity Referred_Back → edit → resubmit', async () => {
    const po = await createDraftPo(superadmin);
    await submitPo(superadmin, po.id);

    const req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    await actOnRequest(manager, req.id, 'REFER_BACK', 'Referred back: please attach the supplier quotation first.');

    expect(await poStatus(superadmin, po.id)).toBe('Referred_Back');

    // Referred_Back is editable; an edit + resubmit must be accepted.
    const { data: cur } = await superadmin.get(`/purchase-orders/${po.id}`);
    const res = await superadmin.post('/purchase-orders', { ...cur, remarks: 'Quotation attached (e2e)' });
    expect(res.status).toBeLessThan(300);

    await submitPo(superadmin, po.id);
    const fresh = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(fresh).toBeTruthy();
    await actOnRequest(manager, fresh.id, 'REJECT', 'Cleanup rejection so no request stays pending.');
  });

  test('AF6 — a user whose role does not match the current level is refused', async () => {
    // Super Admin is a superuser and may act at any level, by design (the desk of last resort, API
    // 4410f7e), so the guard is proven with the Level-1 manager (Admin, an ordinary role) trying to
    // act at Level 2, which wants Super Admin.
    const po = await createDraftPo(superadmin);
    await submitPo(superadmin, po.id);

    let req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    await actOnRequest(manager, req.id, 'APPROVE', 'L1 manager approve');
    req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req.currentLevel).toBe(2);

    const res = await manager.post(`/approval-requests/${req.id}/action`, {
      actionType: 'APPROVE',
      comments: 'should not be allowed',
    });
    expect(res.status, 'wrong-role approval must be refused').toBeGreaterThanOrEqual(400);
    expect(await poStatus(superadmin, po.id)).toBe('Pending_Approval');
    expect((await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id)).currentLevel).toBe(2);

    await actOnRequest(superadmin, req.id, 'REJECT', 'Cleanup rejection so no request stays pending.');
  });

  test('AF10 — a second submit while a request is PENDING is refused', async () => {
    const po = await createDraftPo(superadmin);
    await submitPo(superadmin, po.id);
    const req = await findPendingRequest(superadmin, 'PURCHASE_ORDER', po.id);
    expect(req).toBeTruthy();

    const res = await superadmin.post('/approval-requests/submit', {
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      entityReference: po.poNumber,
      entityData: {},
    });
    expect(res.status, 'duplicate submit must be refused').toBeGreaterThanOrEqual(400);

    await actOnRequest(manager, req.id, 'REJECT', 'Cleanup rejection so no request stays pending.');
  });

  test('AF5 — preventSelfApproval blocks the submitter, a peer with the same role may act', async () => {
    // The seeded PO flow has preventSelfApproval unset; build a dedicated 1-level
    // COST_SHEET flow with the guard on, driven by a REAL cost sheet so the
    // CostSheetApprovalListener has an entity to transition. The level wants Admin, an
    // ordinary role: Super Admin is a superuser and no maker-checker guard stops it, by
    // design (API 4410f7e). The manager (Admin) submits; a second Admin user ("peer")
    // proves the guard blocks the submitter, not the role.
    const { data: roles } = await superadmin.get('/roles');
    const adminRole = (Array.isArray(roles) ? roles : roles?.content || []).find((r) => r.name === 'Admin');

    const peer = await ensureUser(superadmin, {
      name: 'E2E Peer Manager',
      username: 'e2e-manager-peer',
      password: 'Manager@123',
      email: 'e2e-manager-peer@avarsh.com',
      roleId: adminRole.id,
    });
    expect(peer).toBeTruthy();
    const peerApi = await createAuthenticatedClient('e2e-manager-peer', 'Manager@123');

    const flowRes = await superadmin.post('/approval-flows', {
      name: `E2E SelfApproval Guard ${Date.now()}`,
      entityType: 'COST_SHEET',
      active: true,
      priority: 99,
      preventSelfApproval: true,
      levels: [{
        levelNumber: 1,
        levelName: 'Only level',
        approverType: 'ROLE',
        approverRoleId: adminRole.id,
        allowReferBack: false,
        allowReject: true,
      }],
    });
    expect(flowRes.status).toBeLessThan(300);
    const flowId = flowRes.data.id;

    try {
      // Real cost sheet: Draft → submit as Final. With the flow active it must stay
      // Final with a PENDING request (not auto-approve).
      const { data: buyers } = await manager.get('/buyers');
      const { data: style } = await manager.post('/styles', stylePayload(buyers[0].id));
      const draft = await manager.post(
        '/cost-sheets',
        costSheetPayload(buyers[0].id, style.id),
      );
      expect(draft.status).toBeLessThan(300);
      const sheetId = draft.data.id;

      const { data: cur } = await manager.get(`/cost-sheets/${sheetId}`);
      await manager.post(`/cost-sheets/${sheetId}/submit`, { version: cur.version });
      const { data: afterSubmit } = await superadmin.get(`/cost-sheets/${sheetId}`);
      expect(afterSubmit.status, 'flow present → no auto-approve').toBe('Final');

      const req = await findPendingRequest(superadmin, 'COST_SHEET', sheetId);
      expect(req).toBeTruthy();

      // Submitter matches the approver role but the guard must refuse them.
      const selfRes = await manager.post(`/approval-requests/${req.id}/action`, {
        actionType: 'APPROVE',
        comments: 'self-approve attempt',
      });
      expect(selfRes.status, 'self-approval must be refused').toBeGreaterThanOrEqual(400);
      expect((await superadmin.get(`/cost-sheets/${sheetId}`)).data.status).toBe('Final');

      // A different user with the same role completes it — request drained, sheet Approved.
      await actOnRequest(peerApi, req.id, 'APPROVE', 'Peer approval (AF5)');
      expect((await superadmin.get(`/cost-sheets/${sheetId}`)).data.status).toBe('Approved');
      expect(await findPendingRequest(superadmin, 'COST_SHEET', sheetId)).toBeNull();
    } finally {
      // Toggle inactive rather than delete: completed requests hold FK references to
      // the flow, and an inactive flow no longer matches future submits — restoring
      // the "costing auto-approves" behaviour the rest of the estate expects.
      await superadmin.patch(`/approval-flows/${flowId}/toggle`);
      await peerApi.dispose();
    }
  });
});

/** Create a user if absent; returns the existing or created record. */
async function ensureUser(api, { name, username, password, email, roleId }) {
  const { data: users } = await api.get('/users');
  const existing = (Array.isArray(users) ? users : users?.content || []).find((u) => u.username === username);
  if (existing) return existing;
  const res = await api.post('/users', { name, username, password, email, roleId, isActive: true });
  if (res.status >= 300) throw new Error(`user create ${username} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}
