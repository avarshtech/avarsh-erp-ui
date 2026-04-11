/**
 * GRN/QC Workflow E2E Tests (API)
 *
 * Covers state transitions, reversal flows, refer-back cycles,
 * delete constraints, optimistic locking, and PO status interlocks.
 *
 * EACH test uses its OWN dedicated PO to avoid conflicts:
 *   E2E-WF-1   — Combo 22: Full happy path (Draft → Submit → QC → Approve → Close)
 *   E2E-WF-2   — Combo 23: GRN reversal approve
 *   E2E-WF-3   — Combo 24: GRN reversal reject
 *   E2E-WF-4   — Combo 28: Delete draft GRN
 *   E2E-WF-5   — Cannot delete submitted GRN / Combo 25: QC reject & re-inspect
 *   E2E-WF-6   — Combo 26: QC refer-back full cycle
 *   E2E-WF-7   — Combo 27: QC refer-back reject
 *   E2E-WF-8   — Combo 29: Delete draft QC
 *   E2E-WF-9   — Cannot delete submitted QC + Optimistic lock conflict
 *   E2E-WF-10  — Combo 30: Partial GRN → PO Partially_Received
 *   E2E-WF-11  — Combo 32: Full receive + QC approve + close → PO Completed
 *   E2E-WF-12  — Combo 35: GRN reversed → PO status reverts
 *   E2E-WF-ML  — Combo 36: Multi-line PO, GRN for 2 of 3 lines → Partially_Received
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findPOByNumber, refreshPO, fabricGrnPayload, fabricQcPayload,
  submitGrn, draftGrn, submitQc, draftQc, approveQc,
  getDefectTypes, getPOStatus, getPOReceipts, today,
} from '../../helpers/grn-qc-data.js';

// ─── Shared State ───────────────────────────────────────────────────────────

let api;
let defectTypes;

// Track all created entities for cleanup
const createdGrnIds = [];
const createdQcIds = [];

// ─── Setup & Teardown ───────────────────────────────────────────────────────

test.beforeAll(async () => {
  api = await createAuthenticatedClient();

  // Load reference data for QC payloads
  defectTypes = await getDefectTypes(api);
});

test.afterAll(async () => {
  // Best-effort cleanup: drafts can be deleted, submitted entities will 4xx (expected)
  for (const id of createdQcIds) {
    try { await api.delete(`/qc/${id}`); } catch { /* ignore */ }
  }
  for (const id of createdGrnIds) {
    try { await api.delete(`/grns/${id}`); } catch { /* ignore */ }
  }
  await api.dispose();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fetch GRN by ID and return full entity. */
async function fetchGrn(id) {
  const { data, status } = await api.get(`/grns/${id}`);
  expect(status).toBe(200);
  return data;
}

/** Fetch QC by ID and return full entity. */
async function fetchQc(id) {
  const { data, status } = await api.get(`/qc/${id}`);
  expect(status).toBe(200);
  return data;
}

/** Fetch PO by ID and return full entity. */
async function fetchPO(id) {
  const { data, status } = await api.get(`/purchase-orders/${id}`);
  expect(status).toBe(200);
  return data;
}

/**
 * Submit a fresh Fabric GRN with 1 roll against the given PO number.
 * Each test calls this with its own dedicated PO.
 */
async function submitGrnForPO(api, poNumber, { qty } = {}) {
  const po = await findPOByNumber(api, poNumber);
  const item = po.items.find((i) => i.pendingQty > 0);
  if (!item) throw new Error(`PO '${poNumber}' has no line item with pending qty.`);

  const receivingQty = qty || 50;
  expect(item.pendingQty).toBeGreaterThanOrEqual(receivingQty);

  const ts = Date.now();
  const payload = fabricGrnPayload(po, [item], {
    [item.id]: [{ rollNumber: `R-WF-${ts}`, receivingQty, shadeLot: 'SL-WF' }],
  });

  const grn = await submitGrn(api, payload);
  createdGrnIds.push(grn.id);
  return { grn, poLineItemId: item.id, po };
}

/**
 * Draft a Fabric GRN against the given PO number.
 */
async function draftGrnForPO(api, poNumber) {
  const po = await findPOByNumber(api, poNumber);
  const item = po.items.find((i) => i.pendingQty > 0);
  if (!item) throw new Error(`PO '${poNumber}' has no line item with pending qty.`);

  const ts = Date.now();
  const payload = fabricGrnPayload(po, [item], {
    [item.id]: [{ rollNumber: `R-WF-D-${ts}`, receivingQty: 50, shadeLot: 'SL-WF-D' }],
  });

  const grn = await draftGrn(api, payload);
  createdGrnIds.push(grn.id);
  return { grn, poLineItemId: item.id, po, payload };
}

/**
 * Create, submit, and optionally approve a QC for a GRN.
 * Returns the QC entity at the requested stage.
 */
async function createQcForGrn(grn, { approve = false } = {}) {
  const grnFull = await fetchGrn(grn.id);
  const poLineItemId = grnFull.lineItems[0].poLineItemId;
  const qcPayload = fabricQcPayload(grnFull, poLineItemId);

  const qcDraft = await draftQc(api, qcPayload);
  createdQcIds.push(qcDraft.id);

  const qcForSubmit = await fetchQc(qcDraft.id);
  const qcSubmitted = await submitQc(api, {
    ...qcPayload,
    id: qcForSubmit.id,
    version: qcForSubmit.version,
  });

  if (!approve) return qcSubmitted;

  const qcBeforeApproval = await fetchQc(qcSubmitted.id);
  const qcApproved = await approveQc(api, qcBeforeApproval.id, 'E2E auto-approve');
  return qcApproved;
}

/**
 * Close a GRN after QC approval.
 */
async function closeGrn(grnId) {
  const grnFresh = await fetchGrn(grnId);
  const { data, status } = await api.post(
    `/grns/${grnId}/close-on-qc-approval`,
    { version: grnFresh.version },
  );
  expect(status).toBe(200);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// GRN WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('GRN Workflow (API)', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Combo 22 (E2E-WF-1): Full happy path ──────────────────────────────

  test('Combo 22 (E2E-WF-1): Full happy path — Submit GRN → Submit QC → Approve → Close', async () => {
    const po = await findPOByNumber(api, 'E2E-WF-1');
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();

    const ts = Date.now();

    // Step 1: Submit GRN directly
    const grnPayload = fabricGrnPayload(po, [item], {
      [item.id]: [{
        rollNumber: `R-C22-${ts}`,
        receivingQty: 50,
        shadeLot: `SL-C22-${ts % 10000}`,
      }],
    });

    const grnSubmitted = await submitGrn(api, grnPayload);
    createdGrnIds.push(grnSubmitted.id);
    expect(grnSubmitted.status).toBe('QC_Pending');

    // Step 2: Submit QC directly
    const grnFull = await fetchGrn(grnSubmitted.id);
    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcSubmitted = await submitQc(api, qcPayload);
    createdQcIds.push(qcSubmitted.id);
    expect(['Submitted', 'Pending_Approval']).toContain(qcSubmitted.status);

    // Step 5: Approve QC
    const qcBeforeApproval = await fetchQc(qcSubmitted.id);
    const qcApproved = await approveQc(api, qcBeforeApproval.id, 'E2E approved');
    expect(qcApproved.status).toBe('Approved');

    // Step 6: Close GRN on QC approval
    const closedGrn = await closeGrn(grnSubmitted.id);

    // Step 7: Verify final state
    const finalGrn = await fetchGrn(grnSubmitted.id);
    expect(finalGrn.status).toBe('Closed');
  });

  // ── Combo 23 (E2E-WF-2): GRN reversal approve ────────────────────────

  test('Combo 23 (E2E-WF-2): GRN reversal approve — Submit → Reverse → Re-submit', async () => {
    const { grn, poLineItemId, po } = await submitGrnForPO(api, 'E2E-WF-2');
    expect(grn.status).toBe('QC_Pending');

    // Request reversal
    const grnFresh = await fetchGrn(grn.id);
    const { status: reqStatus } = await api.post(
      `/grns/${grn.id}/reversal/request`,
      { reason: 'Wrong PO selected', version: grnFresh.version },
    );
    expect(reqStatus).toBe(200);

    const grnAfterReq = await fetchGrn(grn.id);
    expect(grnAfterReq.status).toBe('Pending_Reversal');

    // Approve reversal
    const { status: appStatus } = await api.post(
      `/grns/${grn.id}/reversal/approve`,
      { reason: 'Approved', version: grnAfterReq.version },
    );
    expect(appStatus).toBe(200);

    const grnAfterRev = await fetchGrn(grn.id);
    expect(grnAfterRev.status).toBe('Reversed');

    // Re-submit: refresh PO balances and create a new GRN
    const refreshedPO = await refreshPO(api, po);
    const item = refreshedPO.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();

    const resubmitPayload = fabricGrnPayload(po, [item], {
      [item.id]: [{
        rollNumber: `R-C23-RESUB-${Date.now()}`,
        receivingQty: Math.min(50, item.pendingQty),
        shadeLot: `SL-C23-${Date.now() % 10000}`,
      }],
    });

    const resubmitted = await submitGrn(api, resubmitPayload);
    createdGrnIds.push(resubmitted.id);
    expect(resubmitted.status).toBe('QC_Pending');
  });

  // ── Combo 24 (E2E-WF-3): GRN reversal reject ─────────────────────────

  test('Combo 24 (E2E-WF-3): GRN reversal reject — remains QC_Pending', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-3');
    expect(grn.status).toBe('QC_Pending');

    // Request reversal
    const grnFresh = await fetchGrn(grn.id);
    const { status: reqStatus } = await api.post(
      `/grns/${grn.id}/reversal/request`,
      { reason: 'Possible error', version: grnFresh.version },
    );
    expect(reqStatus).toBe(200);

    const grnPending = await fetchGrn(grn.id);
    expect(grnPending.status).toBe('Pending_Reversal');

    // Reject reversal
    const { status: rejStatus } = await api.post(
      `/grns/${grn.id}/reversal/reject`,
      { reason: 'No need to reverse', version: grnPending.version },
    );
    expect(rejStatus).toBe(200);

    // Verify reverted to QC_Pending
    const grnAfter = await fetchGrn(grn.id);
    expect(grnAfter.status).toBe('QC_Pending');
  });

  // ── Combo 28 (E2E-WF-4): Delete draft GRN ────────────────────────────

  test('Combo 28 (E2E-WF-4): Delete draft GRN — succeeds', async () => {
    const { grn } = await draftGrnForPO(api, 'E2E-WF-4');
    expect(grn.status).toBe('Draft');

    const { status: delStatus } = await api.delete(`/grns/${grn.id}`);
    expect([200, 204]).toContain(delStatus);

    // Verify deleted — GET should return 404
    const { status: getStatus } = await api.get(`/grns/${grn.id}`);
    expect([404, 400, 500]).toContain(getStatus);

    // Remove from cleanup list since already deleted
    const idx = createdGrnIds.indexOf(grn.id);
    if (idx !== -1) createdGrnIds.splice(idx, 1);
  });

  // ── Cannot delete submitted GRN (E2E-WF-5) ───────────────────────────

  test('Cannot delete submitted GRN (E2E-WF-5) — returns error', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-5');
    expect(grn.status).toBe('QC_Pending');

    const { status: delStatus } = await api.delete(`/grns/${grn.id}`);
    expect([400, 403, 409]).toContain(delStatus);

    // Verify still exists
    const grnStill = await fetchGrn(grn.id);
    expect(grnStill.status).toBe('QC_Pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QC WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QC Workflow (API)', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Combo 25 (E2E-WF-5): QC reject & re-inspect ──────────────────────

  test('Combo 25 (E2E-WF-5): QC reject & re-inspect — Submit → Reject → Re-submit → Approve', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-5');
    expect(grn.status).toBe('QC_Pending');

    // Submit QC directly
    const grnFull = await fetchGrn(grn.id);
    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcSubmitted = await submitQc(api, qcPayload);
    createdQcIds.push(qcSubmitted.id);
    expect(['Submitted', 'Pending_Approval']).toContain(qcSubmitted.status);

    // Reject QC
    const qcBeforeReject = await fetchQc(qcSubmitted.id);
    const { status: rejStatus } = await api.post(
      `/qc/${qcSubmitted.id}/reject`,
      { reason: 'Defects found — re-inspection needed', version: qcBeforeReject.version },
    );
    expect(rejStatus).toBe(200);

    const qcAfterReject = await fetchQc(qcSubmitted.id);
    expect(qcAfterReject.status).toBe('Rejected');

    // Re-submit — use the existing QC's ID+version so server updates it
    const updatedPayload = fabricQcPayload(grnFull, poLineItemId, {
      rollOverrides: [{ actualWidth: 44, actualGsm: 180 }],
      inspector: 'E2E Inspector Re-inspect',
    });
    updatedPayload.id = qcAfterReject.id;
    updatedPayload.version = qcAfterReject.version;
    // Carry over child IDs to avoid H2 orphanRemoval issues
    if (qcAfterReject.rolls?.length && updatedPayload.rolls?.length) {
      updatedPayload.rolls = updatedPayload.rolls.map((r, i) => ({ ...r, id: qcAfterReject.rolls[i]?.id }));
    }
    if (qcAfterReject.parameters?.length && updatedPayload.parameters?.length) {
      updatedPayload.parameters = updatedPayload.parameters.map((p, i) => ({ ...p, id: qcAfterReject.parameters[i]?.id }));
    }
    const qcResubmitted = await submitQc(api, updatedPayload);
    expect(['Submitted', 'Pending_Approval']).toContain(qcResubmitted.status);

    // Approve the re-submitted QC
    const qcBeforeApprove = await fetchQc(qcResubmitted.id);
    const qcApproved = await approveQc(api, qcBeforeApprove.id, 'Re-inspection passed');
    expect(qcApproved.status).toBe('Approved');
  });

  // ── Combo 26 (E2E-WF-6): QC refer-back full cycle ────────────────────

  test('Combo 26 (E2E-WF-6): QC refer-back full cycle — Approve → Refer-back → Edit → Submit → Approve', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-6');
    const grnFull = await fetchGrn(grn.id);

    // Create, submit, and approve QC
    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcDraft = await draftQc(api, qcPayload);
    createdQcIds.push(qcDraft.id);

    const qcForSubmit = await fetchQc(qcDraft.id);
    const qcSubmitted = await submitQc(api, {
      ...qcPayload,
      id: qcForSubmit.id,
      version: qcForSubmit.version,
    });

    const qcBeforeApproval = await fetchQc(qcSubmitted.id);
    const qcApproved = await approveQc(api, qcBeforeApproval.id, 'Initial approval');
    expect(qcApproved.status).toBe('Approved');

    // Request refer-back
    const qcBeforeReferBack = await fetchQc(qcApproved.id);
    const { status: rbReqStatus } = await api.post(
      `/qc/${qcApproved.id}/refer-back/request`,
      { reason: 'Need re-inspection after shade lot issue', version: qcBeforeReferBack.version },
    );
    expect(rbReqStatus).toBe(200);

    const qcAfterReq = await fetchQc(qcApproved.id);
    expect(qcAfterReq.status).toBe('Referred_Back_Pending');

    // Approve the refer-back
    const { status: rbAppStatus } = await api.post(
      `/qc/${qcApproved.id}/refer-back/approve`,
      { reason: 'Re-inspection warranted', version: qcAfterReq.version },
    );
    expect(rbAppStatus).toBe(200);

    const qcReferredBack = await fetchQc(qcApproved.id);
    expect(qcReferredBack.status).toBe('Referred_Back');

    // Edit & re-submit QC with updated data
    const updatedPayload = fabricQcPayload(grnFull, poLineItemId, {
      rollOverrides: [{ actualWidth: 44, actualGsm: 182 }],
      inspector: 'E2E Inspector Refer-back',
    });
    const qcResubmitted = await submitQc(api, {
      ...updatedPayload,
      id: qcReferredBack.id,
      version: qcReferredBack.version,
    });
    expect(['Submitted', 'Pending_Approval']).toContain(qcResubmitted.status);

    // Re-approve
    const qcBeforeReapproval = await fetchQc(qcResubmitted.id);
    const qcReapproved = await approveQc(api, qcBeforeReapproval.id, 'Re-approved after refer-back');
    expect(qcReapproved.status).toBe('Approved');
  });

  // ── Combo 27 (E2E-WF-7): QC refer-back reject ────────────────────────

  test('Combo 27 (E2E-WF-7): QC refer-back reject — stays Approved', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-7');
    const grnFull = await fetchGrn(grn.id);

    // Create, submit, and approve QC
    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcDraft = await draftQc(api, qcPayload);
    createdQcIds.push(qcDraft.id);

    const qcForSubmit = await fetchQc(qcDraft.id);
    const qcSubmitted = await submitQc(api, {
      ...qcPayload,
      id: qcForSubmit.id,
      version: qcForSubmit.version,
    });

    const qcBeforeApproval = await fetchQc(qcSubmitted.id);
    const qcApproved = await approveQc(api, qcBeforeApproval.id, 'Approved');
    expect(qcApproved.status).toBe('Approved');

    // Request refer-back
    const qcFresh = await fetchQc(qcApproved.id);
    const { status: rbReqStatus } = await api.post(
      `/qc/${qcApproved.id}/refer-back/request`,
      { reason: 'Possible shade mismatch', version: qcFresh.version },
    );
    expect(rbReqStatus).toBe(200);

    const qcPending = await fetchQc(qcApproved.id);
    expect(qcPending.status).toBe('Referred_Back_Pending');

    // Reject the refer-back request
    const { status: rbRejStatus } = await api.post(
      `/qc/${qcApproved.id}/refer-back/reject`,
      { reason: 'Original inspection was correct', version: qcPending.version },
    );
    expect(rbRejStatus).toBe(200);

    // QC should remain Approved
    const qcFinal = await fetchQc(qcApproved.id);
    expect(qcFinal.status).toBe('Approved');
  });

  // ── Combo 29 (E2E-WF-8): Delete draft QC ─────────────────────────────

  test('Combo 29 (E2E-WF-8): Delete draft QC — succeeds', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-8');
    const grnFull = await fetchGrn(grn.id);

    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcDraft = await draftQc(api, qcPayload);
    createdQcIds.push(qcDraft.id);
    expect(qcDraft.status).toBe('Draft');

    const { status: delStatus } = await api.delete(`/qc/${qcDraft.id}`);
    expect([200, 204]).toContain(delStatus);

    // Verify deleted — GET should return 404
    const { status: getStatus } = await api.get(`/qc/${qcDraft.id}`);
    expect([404, 400, 500]).toContain(getStatus);

    // Remove from cleanup
    const idx = createdQcIds.indexOf(qcDraft.id);
    if (idx !== -1) createdQcIds.splice(idx, 1);
  });

  // ── Cannot delete submitted QC (E2E-WF-9) ────────────────────────────

  test('Cannot delete submitted QC (E2E-WF-9) — returns error', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-9');
    const grnFull = await fetchGrn(grn.id);

    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcDraft = await draftQc(api, qcPayload);
    createdQcIds.push(qcDraft.id);

    const qcForSubmit = await fetchQc(qcDraft.id);
    const qcSubmitted = await submitQc(api, {
      ...qcPayload,
      id: qcForSubmit.id,
      version: qcForSubmit.version,
    });
    expect(['Submitted', 'Pending_Approval']).toContain(qcSubmitted.status);

    const { status: delStatus } = await api.delete(`/qc/${qcSubmitted.id}`);
    expect([400, 403, 409]).toContain(delStatus);

    // Verify still exists
    const qcStill = await fetchQc(qcSubmitted.id);
    expect(['Submitted', 'Pending_Approval']).toContain(qcStill.status);
  });

  // ── Optimistic lock conflict (E2E-WF-9) ──────────────────────────────

  test('Optimistic lock conflict (E2E-WF-9): wrong version on GRN reversal → 409', async () => {
    const { grn } = await submitGrnForPO(api, 'E2E-WF-9');
    expect(grn.status).toBe('QC_Pending');

    // Use a stale/wrong version number
    const { status: conflictStatus } = await api.post(
      `/grns/${grn.id}/reversal/request`,
      { reason: 'Testing optimistic lock', version: -1 },
    );
    expect(conflictStatus).toBe(409);

    // GRN should remain unchanged
    const grnAfter = await fetchGrn(grn.id);
    expect(grnAfter.status).toBe('QC_Pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PO STATUS INTERLOCKS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('PO Status Interlocks (API)', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Combo 30 (E2E-WF-10): Partial GRN → PO Partially_Received ────────

  test('Combo 30 (E2E-WF-10): Partial GRN (50 of 1000) → PO Partially_Received', async () => {
    const { po } = await submitGrnForPO(api, 'E2E-WF-10', { qty: 50 });

    // Verify PO status
    const poStatus = await getPOStatus(api, po.id);
    expect(poStatus).toBe('Partially_Received');
  });

  // ── Combo 32 (E2E-WF-11): Full receive + QC + close → PO Completed ───

  test('Combo 32 (E2E-WF-11): Full receive + QC approve + close → PO Completed', async () => {
    const po = await findPOByNumber(api, 'E2E-WF-11');
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();

    // Receive ALL pending qty in a single GRN
    const ts = Date.now();
    const payload = fabricGrnPayload(po, [item], {
      [item.id]: [{
        rollNumber: `R-C32-${ts}`,
        receivingQty: item.pendingQty,
        shadeLot: `SL-C32-${ts % 10000}`,
      }],
    });

    const grn = await submitGrn(api, payload);
    createdGrnIds.push(grn.id);

    // QC approve + close
    const qcApproved = await createQcForGrn(grn, { approve: true });
    expect(qcApproved.status).toBe('Approved');

    await closeGrn(grn.id);

    const finalGrn = await fetchGrn(grn.id);
    expect(finalGrn.status).toBe('Closed');

    // PO should be Completed since full qty received and GRN closed
    const poStatus = await getPOStatus(api, po.id);
    expect(poStatus).toBe('Completed');
  });

  // ── Combo 35 (E2E-WF-12): GRN reversed → PO status reverts ──────────

  test('Combo 35 (E2E-WF-12): GRN reversed → PO status reverts', async () => {
    const po = await findPOByNumber(api, 'E2E-WF-12');

    // Record initial PO status
    const initialPO = await fetchPO(po.id);
    const initialStatus = initialPO.status;

    // Submit partial GRN
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();

    const ts = Date.now();
    const payload = fabricGrnPayload(po, [item], {
      [item.id]: [{
        rollNumber: `R-C35-${ts}`,
        receivingQty: 50,
        shadeLot: `SL-C35-${ts % 10000}`,
      }],
    });

    const grn = await submitGrn(api, payload);
    createdGrnIds.push(grn.id);

    const poAfterGrn = await getPOStatus(api, po.id);
    expect(poAfterGrn).toBe('Partially_Received');

    // Request + approve reversal
    const grnFresh = await fetchGrn(grn.id);
    const { status: reqStatus } = await api.post(
      `/grns/${grn.id}/reversal/request`,
      { reason: 'Incorrect qty received', version: grnFresh.version },
    );
    expect(reqStatus).toBe(200);

    const grnPending = await fetchGrn(grn.id);
    const { status: approveStatus } = await api.post(
      `/grns/${grn.id}/reversal/approve`,
      { reason: 'Reversal approved', version: grnPending.version },
    );
    expect(approveStatus).toBe(200);

    const grnReversed = await fetchGrn(grn.id);
    expect(grnReversed.status).toBe('Reversed');

    // PO status should revert (no longer Partially_Received)
    const poAfterRev = await getPOStatus(api, po.id);
    expect(poAfterRev).not.toBe('Partially_Received');
  });

  // ── Combo 36 (E2E-WF-ML): Multi-line PO, partial lines → Partially_Received ──

  test('Combo 36 (E2E-WF-ML): Multi-line PO, GRN for 2 of 3 lines → Partially_Received', async () => {
    const po = await findPOByNumber(api, 'E2E-WF-ML');
    expect(po.items.length).toBeGreaterThanOrEqual(3);

    // Submit GRN for only 2 of 3 lines
    const selectedItems = [po.items[0], po.items[1]];
    const ts = Date.now();
    const rollConfig = {};
    selectedItems.forEach((item, i) => {
      rollConfig[item.id] = [{
        rollNumber: `R-C36-${i}-${ts}`,
        receivingQty: item.pendingQty,
        shadeLot: `SL-C36-${ts % 10000}`,
      }];
    });

    const payload = fabricGrnPayload(po, selectedItems, rollConfig);
    const grn = await submitGrn(api, payload);
    createdGrnIds.push(grn.id);

    // Verify PO status
    const poStatus = await getPOStatus(api, po.id);
    expect(poStatus).toBe('Partially_Received');

    // Verify receipts: 2 lines have qty, 3rd has 0
    const receipts = await getPOReceipts(api, po.id);
    expect(Number(receipts[po.items[0].id] || 0)).toBeGreaterThan(0);
    expect(Number(receipts[po.items[1].id] || 0)).toBeGreaterThan(0);
    expect(Number(receipts[po.items[2].id] || 0)).toBe(0);
  });
});
