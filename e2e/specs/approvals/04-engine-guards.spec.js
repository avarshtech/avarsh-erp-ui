/**
 * Approval engine — bypass guards and the level-edit fragility probe (AF11, AF12).
 *
 * AF12 proves the two "decision jump" guards: while an engine request is PENDING,
 * neither a cost sheet nor a PO may be moved to a decided status by a plain save —
 * the engine actions are the only door.
 *
 * AF11 deliberately edits a flow's levels UNDER a PENDING request. The schema has no
 * FK from apv_requests.current_level to apv_levels, so this is expected to misbehave;
 * the test records the observed behaviour and asserts only that the entity itself is
 * not corrupted. Findings feed the bug log rather than failing the build.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { loadPoRefs, buildGeneralPo } from '../../helpers/po-seed.js';
import { costSheetPayload, stylePayload } from '../../helpers/test-data.js';

let api;
let manager;
let refs;

test.describe('Approval engine — guards', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    manager = await createAuthenticatedClient('e2e-manager', 'Manager@123').catch(() => null);
    refs = await loadPoRefs(api);
  });

  test.afterAll(async () => {
    await api?.dispose();
    await manager?.dispose();
  });

  test('AF12a — PO: saving a decided status while PENDING is refused', async () => {
    const po = buildGeneralPo(refs.localSupplier, refs.item, refs.terms);
    const created = await api.post('/purchase-orders', po);
    const { data: cur } = await api.get(`/purchase-orders/${created.data.id}`);
    await api.post('/purchase-orders', { ...cur, id: created.data.id, status: 'Pending_Approval' });

    const req = await findPendingRequest(api, 'PURCHASE_ORDER', created.data.id);
    expect(req, 'seeded PO flow must have raised a request').toBeTruthy();

    const { data: pending } = await api.get(`/purchase-orders/${created.data.id}`);
    const bypass = await api.post('/purchase-orders', {
      ...pending, id: created.data.id, status: 'Sent_To_Supplier',
    });
    expect(bypass.status, 'status jump around the engine must be refused').toBeGreaterThanOrEqual(400);

    const { data: after } = await api.get(`/purchase-orders/${created.data.id}`);
    expect(after.status).toBe('Pending_Approval');

    if (manager) await actOnRequest(manager, req.id, 'REJECT', 'Cleanup rejection so no request stays pending.');
  });

  test('AF12b — cost sheet: Final→Approved by plain save while PENDING is refused (409)', async () => {
    // Needs an active COST_SHEET flow; create one scoped to this test.
    const { data: roles } = await api.get('/roles');
    const superRole = roles.find((r) => r.name === 'Super Admin');
    const flow = await api.post('/approval-flows', {
      name: `E2E DecisionJump ${Date.now()}`,
      entityType: 'COST_SHEET',
      active: true,
      priority: 40,
      levels: [{
        levelNumber: 1, levelName: 'Gate', approverType: 'ROLE',
        approverRoleId: superRole.id, allowReferBack: false, allowReject: true,
      }],
    });
    const flowId = flow.data.id;

    try {
      const { data: buyers } = await api.get('/buyers');
      const { data: style } = await api.post('/styles', stylePayload(buyers[0].id));
      const draft = await api.post(
        '/cost-sheets',
        costSheetPayload(buyers[0].id, style.id),
      );
      const sheetId = draft.data.id;

      const { data: cur } = await api.get(`/cost-sheets/${sheetId}`);
      await api.post('/cost-sheets', { ...cur, id: sheetId, status: 'Final' });
      const req = await findPendingRequest(api, 'COST_SHEET', sheetId);
      expect(req).toBeTruthy();

      const { data: fin } = await api.get(`/cost-sheets/${sheetId}`);
      const jump = await api.post('/cost-sheets', { ...fin, id: sheetId, status: 'Approved' });
      expect(jump.status, 'decision jump must be refused').toBe(409);

      expect((await api.get(`/cost-sheets/${sheetId}`)).data.status).toBe('Final');

      await actOnRequest(api, req.id, 'REJECT', 'Cleanup rejection: draining the pending request.');
    } finally {
      const { data } = await api.get(`/approval-flows/${flowId}`);
      if (data?.active) await api.patch(`/approval-flows/${flowId}/toggle`);
    }
  });

  test('AF11 — probe: editing flow levels under a PENDING request', async () => {
    const { data: roles } = await api.get('/roles');
    const superRole = roles.find((r) => r.name === 'Super Admin');
    const adminRole = roles.find((r) => r.name === 'Admin');

    const flow = await api.post('/approval-flows', {
      name: `E2E LevelEdit Probe ${Date.now()}`,
      entityType: 'PURCHASE_ORDER',
      active: true,
      priority: 50,
      levels: [
        { levelNumber: 1, levelName: 'First', approverType: 'ROLE', approverRoleId: adminRole.id, allowReferBack: false, allowReject: true },
        { levelNumber: 2, levelName: 'Second', approverType: 'ROLE', approverRoleId: superRole.id, allowReferBack: false, allowReject: true },
      ],
    });
    const flowId = flow.data.id;
    const notes = [];

    try {
      const po = buildGeneralPo(refs.localSupplier, refs.item, refs.terms);
      const created = await api.post('/purchase-orders', po);
      const { data: cur } = await api.get(`/purchase-orders/${created.data.id}`);
      await api.post('/purchase-orders', { ...cur, id: created.data.id, status: 'Pending_Approval' });

      const req = await findPendingRequest(api, 'PURCHASE_ORDER', created.data.id);
      expect(req).toBeTruthy();
      notes.push(`request ${req.id} pending at level ${req.currentLevel}`);

      // Under the pending request: rewrite the flow to a SINGLE level.
      const { data: cfg } = await api.get(`/approval-flows/${flowId}`);
      const editRes = await api.put(`/approval-flows/${flowId}`, {
        ...cfg,
        levels: [{ levelNumber: 1, levelName: 'Collapsed', approverType: 'ROLE', approverRoleId: superRole.id, allowReferBack: false, allowReject: true }],
      });
      notes.push(`level rewrite response: ${editRes.status}`);

      // Attempt to action the surviving request; record what the engine does.
      const act = await api.post(`/approval-requests/${req.id}/action`, {
        actionType: 'REJECT', comments: 'Probing level-edit behaviour under a pending request.',
      });
      notes.push(`action after rewrite: ${act.status} ${JSON.stringify(act.data)?.slice(0, 200)}`);

      // The one hard assertion: the PO must not be corrupted — it is either still
      // Pending_Approval (action failed) or cleanly Rejected (action succeeded).
      const { data: after } = await api.get(`/purchase-orders/${created.data.id}`);
      notes.push(`po status after probe: ${after.status}`);
      expect(['Pending_Approval', 'Rejected']).toContain(after.status);

      // If the request survived in PENDING, drain it through whoever now holds level 1.
      const still = await findPendingRequest(api, 'PURCHASE_ORDER', created.data.id);
      if (still) {
        const drain = await api.post(`/approval-requests/${still.id}/action`, {
          actionType: 'REJECT', comments: 'Cleanup rejection after the level-edit probe.',
        });
        notes.push(`drain attempt: ${drain.status}`);
        if (drain.status >= 400 && manager) {
          const viaManager = await manager.post(`/approval-requests/${still.id}/action`, {
            actionType: 'REJECT', comments: 'Cleanup rejection after the level-edit probe.',
          });
          notes.push(`drain via manager: ${viaManager.status}`);
        }
      }
    } finally {
      test.info().annotations.push({ type: 'af11-probe', description: notes.join(' | ') });
      const { data } = await api.get(`/approval-flows/${flowId}`);
      if (data?.active) await api.patch(`/approval-flows/${flowId}/toggle`);
    }
  });
});
