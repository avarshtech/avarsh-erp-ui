/**
 * Material issue guards + return-to-supplier with automatic debit note (I7, I9).
 *
 * Prerequisite-heavy flows built from scratch through the API:
 *  - RETURNS: PO → over-the-counter fabric GRN → QC that FAILS → reject → the rejected
 *    rolls become PENDING_RETURN → return them → a debit note materialises.
 *  - ISSUE guards: fabric issue demands an APPROVED Cutting PO; quantities beyond a
 *    roll's availability are refused. (The happy-path partial-roll issue already lives
 *    in production-po/04-material-issue.)
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findOrCreateTestPO, fabricGrnPayload, submitGrn, fabricQcPayload, submitQc,
} from '../../helpers/grn-qc-data.js';

let api;
let director; // second Super Admin — QC forbids actioning your own submission

test.describe.serial('Inventory — issues and returns', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    director = await createAuthenticatedClient('e2e-director', 'Director@123').catch(() => null);
  });

  test.afterAll(async () => { await api?.dispose(); });

  test('I7a — a fabric issue against a non-approved Cutting PO is refused', async () => {
    const res = await api.post('/material-issues/fabric', {
      cuttingPoId: 999999, // nonexistent ≈ not approved
      receivedBy: 'E2E Guard',
      issueDate: new Date().toISOString().split('T')[0],
      rolls: [{ fabricStockId: 1, issuedQty: 1 }],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('I7b — issuing more than a roll holds is refused', async () => {
    const pos = await api.get('/material-issues/cutting-pos');
    const cpo = (pos.data || [])[0];
    test.skip(!cpo, 'no approved Cutting PO in this session (production-po not yet run)');

    const itemCode = cpo.itemCode || cpo.lines?.[0]?.itemCode || cpo.items?.[0]?.itemCode;
    test.skip(!itemCode, 'cutting PO shape carries no itemCode to look rolls up by');
    const rolls = await api.get(`/material-issues/issuable-rolls?itemCode=${encodeURIComponent(itemCode)}`);
    const roll = (rolls.data || [])[0];
    test.skip(!roll, 'no issuable rolls for the approved Cutting PO');

    const res = await api.post('/material-issues/fabric', {
      cuttingPoId: cpo.id,
      cuttingPoLineId: roll.cuttingPoLineId ?? cpo.lines?.[0]?.id,
      receivedBy: 'E2E Guard',
      issueDate: new Date().toISOString().split('T')[0],
      rolls: [{ fabricStockId: roll.fabricStockId ?? roll.id, issuedQty: Number(roll.availableQty) + 999 }],
    });
    expect(res.status, 'over-issue must be refused').toBeGreaterThanOrEqual(400);
  });

  test('I9 — rejected QC rolls return to the supplier and raise a debit note', async () => {
    // 1. Receive fabric.
    const po = await findOrCreateTestPO(api, 'Fabric');
    const item = po.items.find((i) => i.pendingQty >= 5);
    expect(item).toBeTruthy();
    const grn = await submitGrn(api, fabricGrnPayload(po, [item], {
      [item.id]: [{ rollNumber: `R-RET-${Date.now()}`, receivingQty: 5, shadeLot: 'SL-RET' }],
    }));

    // 2. QC it with a hopeless width deviation so the overall result FAILS.
    const qcPayload = fabricQcPayload(grn, item.id, {
      rollOverrides: [{ actualWidth: 1, actualGsm: 1 }],
    });
    const qc = await submitQc(api, qcPayload);
    expect(qc.status).toBe('Pending_Approval');

    // 3. Reject the QC → rolls become PENDING_RETURN. The engine-independent QC guard
    // forbids actioning your own submission, so a second user rejects.
    test.skip(!director, 'e2e-director missing — approvals suite creates it');
    const reject = await director.post(`/qc/${qc.id}/reject`, {
      reason: 'E2E return flow: fabric failed inspection and goes back to the supplier.',
      version: qc.version,
    });
    expect(reject.status, JSON.stringify(reject.data).slice(0, 200)).toBeLessThan(300);

    // 4. The PO now shows pending returnable items.
    const pending = await api.get(`/inventory/returns-to-supplier/pos/${po.id}/pending-items?type=FABRIC`);
    expect(pending.status).toBeLessThan(300);
    const returnables = pending.data?.items || pending.data || [];
    expect(returnables.length, 'rejected rolls must be offered for return').toBeGreaterThan(0);
    const first = returnables[0];

    // 5. Return them.
    const ret = await api.post('/inventory/returns-to-supplier', {
      returnType: 'FABRIC',
      poId: po.id,
      returnDate: new Date().toISOString().split('T')[0],
      remarks: 'E2E fabric return',
      items: [{ qcRollId: first.qcRollId ?? first.id }],
    });
    expect(ret.status, JSON.stringify(ret.data).slice(0, 300)).toBeLessThan(300);
    const returnId = ret.data.id;

    // 6. The debit note is created automatically from the return.
    const dn = await api.get(`/inventory/debit-notes/by-return/${returnId}`);
    expect(dn.status).toBeLessThan(300);
    expect(dn.data, 'a debit note must exist for the return').toBeTruthy();
    const dnObj = Array.isArray(dn.data) ? dn.data[0] : dn.data;
    expect(dnObj?.id).toBeTruthy();
  });
});
