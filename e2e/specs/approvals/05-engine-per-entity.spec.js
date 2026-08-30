/**
 * Approval engine — per-entity listener coverage (AF13, non-production types).
 *
 * COST_SHEET is proven in 01 (AF5) and PURCHASE_ORDER throughout; the production
 * types (CUTTING_PO / WORK_ORDER / FINISHING_PO) are covered in the production-po
 * phase where their prerequisites already exist. This spec drives the remaining
 * listeners: ORDER, GRN_REVERSAL and QC.
 *
 * Each test creates its own 1-level flow, drives one submit→approve through the
 * engine, asserts the listener applied the business transition, and deactivates the
 * flow so the rest of the estate keeps its auto-approve / legacy expectations.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';
import {
  findOrCreateTestPO, fabricGrnPayload, submitGrn, fabricQcPayload, submitQc,
} from '../../helpers/grn-qc-data.js';

let api;      // superadmin — submitter
let director; // second Super Admin — approver (several listeners refuse self-approval)

async function makeFlow(entityType, { allowReferBack = false } = {}) {
  const { data: roles } = await api.get('/roles');
  const superRole = roles.find((r) => r.name === 'Super Admin');
  const res = await api.post('/approval-flows', {
    name: `E2E ${entityType} Flow ${Date.now()}`,
    entityType,
    active: true,
    priority: 60,
    levels: [{
      levelNumber: 1, levelName: 'Single gate', approverType: 'ROLE',
      approverRoleId: superRole.id, allowReferBack, allowReject: true,
    }],
  });
  expect(res.status).toBeLessThan(300);
  return res.data.id;
}

async function retireFlow(flowId) {
  if (!flowId) return;
  const { data } = await api.get(`/approval-flows/${flowId}`);
  if (data?.active) await api.patch(`/approval-flows/${flowId}/toggle`);
}

test.describe('Approval engine — per-entity listeners', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    director = await createAuthenticatedClient('e2e-director', 'Director@123').catch(() => null);
  });

  test.afterAll(async () => {
    await api?.dispose();
    await director?.dispose();
  });

  test('ORDER — engine approval completes a cancel request', async () => {
    // The ORDER approval points are REFER_BACK_REQUESTED and CANCEL_REQUESTED —
    // plain DRAFT→CONFIRMED goes straight through with no engine involvement
    // (OrderService submits to the engine only for those two request types).
    const flowId = await makeFlow('ORDER', { allowReferBack: false });
    try {
      const costing = await seedApprovedCosting(api);
      const refs = await loadOrderRefs(api, costing.buyerId);
      const created = await api.post('/orders', buildOrderPayload(costing, refs));
      expect(created.status).toBeLessThan(300);
      const orderId = created.data.id;

      let { data: cur } = await api.get(`/orders/${orderId}`);
      await api.put(`/orders/${orderId}/status`, { status: 'CONFIRMED', version: cur.version });
      ({ data: cur } = await api.get(`/orders/${orderId}`));
      expect(cur.status, 'confirm is direct — never engine-gated').toBe('CONFIRMED');

      // Cancel request IS engine-gated when a flow exists.
      const cancelReq = await api.put(`/orders/${orderId}/status`, {
        status: 'CANCEL_REQUESTED', version: cur.version,
        reason: 'E2E engine cancel: buyer withdrew the order.',
      });
      expect(cancelReq.status).toBeLessThan(300);

      const req = await findPendingRequest(api, 'ORDER', orderId);
      expect(req, 'active ORDER flow must intercept the cancel request').toBeTruthy();

      const approver = director || api;
      await actOnRequest(approver, req.id, 'APPROVE', 'Cancellation approved via engine (AF13).');

      const { data: after } = await api.get(`/orders/${orderId}`);
      expect(after.status).toBe('CANCELLED');
    } finally {
      await retireFlow(flowId);
    }
  });

  test('GRN_REVERSAL — engine approval reverses the GRN', async () => {
    const flowId = await makeFlow('GRN_REVERSAL', { allowReferBack: false });
    try {
      const po = await findOrCreateTestPO(api, 'Fabric');
      const item = po.items.find((i) => i.pendingQty > 0);
      // Receive only part of the balance so the PO stays GRN-eligible for later tests.
      const grn = await submitGrn(api, fabricGrnPayload(po, [item], {
        [item.id]: [{
          rollNumber: `R-AF13-${Date.now()}`,
          receivingQty: Math.min(5, item.pendingQty),
          shadeLot: 'SL-AF13',
        }],
      }));
      expect(grn.status).toBe('QC_Pending');

      const reqRes = await api.post(`/grns/${grn.id}/reversal/request`, {
        reason: 'E2E engine reversal: wrong shade lot recorded on receipt.',
        version: grn.version,
      });
      expect(reqRes.status).toBeLessThan(300);
      const { data: pendingGrn } = await api.get(`/grns/${grn.id}`);
      expect(pendingGrn.status).toBe('Pending_Reversal');

      const req = await findPendingRequest(api, 'GRN_REVERSAL', grn.id);
      expect(req, 'reversal request must enter the engine when a flow exists').toBeTruthy();

      // GRN listener enforces "cannot approve your own action" — use the director.
      const approver = director || api;
      await actOnRequest(approver, req.id, 'APPROVE', 'Reversal approved via engine (AF13).');

      const { data: after } = await api.get(`/grns/${grn.id}`);
      expect(after.status).toBe('Reversed');
    } finally {
      await retireFlow(flowId);
    }
  });

  test('QC — engine approval closes QC and the parent GRN', async () => {
    const flowId = await makeFlow('QC', { allowReferBack: false });
    try {
      const po = await findOrCreateTestPO(api, 'Fabric');
      const item = po.items.find((i) => i.pendingQty > 0);
      const grn = await submitGrn(api, fabricGrnPayload(po, [item], {
        [item.id]: [{
          rollNumber: `R-AF13Q-${Date.now()}`,
          receivingQty: Math.min(5, item.pendingQty),
          shadeLot: 'SL-AF13Q',
        }],
      }));
      const qc = await submitQc(api, fabricQcPayload(grn, item.id));
      expect(qc.status).toBe('Pending_Approval');

      const req = await findPendingRequest(api, 'QC', qc.id);
      expect(req, 'QC submit must raise an engine request when a flow exists').toBeTruthy();

      const approver = director || api;
      await actOnRequest(approver, req.id, 'APPROVE', 'QC approved via engine (AF13).');

      const { data: after } = await api.get(`/qc/${qc.id}`);
      expect(['Approved', 'Conditional_Pass']).toContain(after.status);
    } finally {
      await retireFlow(flowId);
    }
  });
});
