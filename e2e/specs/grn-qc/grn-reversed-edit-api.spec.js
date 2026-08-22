/**
 * GRN post-reversal edit (API)
 *
 * A GRN that has been reversed must be editable in place: the creator reopens it,
 * corrects the rolls, and re-submits. Keeping an existing roll number across that
 * edit is the normal case (only the quantity or shade lot was wrong), so it must
 * not collide with the row already stored for that roll.
 *
 *   E2E-REV-EDIT — Submit -> Request reversal -> Approve -> edit -> re-submit
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findPOByNumber, fabricGrnPayload, submitGrn, draftGrn, qcApproverClient,
} from '../../helpers/grn-qc-data.js';

let api;
const createdGrnIds = [];

test.beforeAll(async () => { api = await createAuthenticatedClient(); });

test.afterAll(async () => {
  for (const id of createdGrnIds) {
    try { await api.delete(`/grns/${id}`); } catch { /* submitted GRNs 4xx — expected */ }
  }
  await api.dispose();
});

async function fetchGrn(id) {
  const { data, status } = await api.get(`/grns/${id}`);
  expect(status).toBe(200);
  return data;
}

/** Rebuild a save payload from a fetched GRN, preserving its identity and rolls. */
function editPayloadFrom(grnFull, mutateRolls) {
  return {
    ...grnFull,
    lineItems: grnFull.lineItems.map((li) => ({
      ...li,
      rolls: mutateRolls(li.rolls || []),
    })),
  };
}

async function reverseGrn(grn) {
  const fresh = await fetchGrn(grn.id);
  const { status: reqStatus } = await api.post(
    `/grns/${grn.id}/reversal/request`,
    { reason: 'Roll quantity was captured incorrectly at the gate.', version: fresh.version },
  );
  expect(reqStatus).toBe(200);

  const pending = await fetchGrn(grn.id);
  expect(pending.status).toBe('Pending_Reversal');

  const { status: appStatus } = await (await qcApproverClient(api)).post(
    `/grns/${grn.id}/reversal/approve`,
    { reason: 'Agreed, reopen it so the qty can be corrected.', version: pending.version },
  );
  expect(appStatus).toBe(200);

  const reversed = await fetchGrn(grn.id);
  expect(reversed.status).toBe('Reversed');
  return reversed;
}

test('E2E-REV-EDIT: a reversed GRN can be edited and re-submitted with its existing roll numbers', async () => {
  const po = await findPOByNumber(api, 'E2E-WF-13');
  const item = po.items.find((i) => i.pendingQty > 0);
  expect(item).toBeDefined();

  const rollNumber = `R-REVEDIT-${Date.now()}`;
  const payload = fabricGrnPayload(po, [item], {
    [item.id]: [{ rollNumber, receivingQty: 50, shadeLot: 'SL-REV' }],
  });

  const grn = await submitGrn(api, payload);
  createdGrnIds.push(grn.id);
  expect(grn.status).toBe('QC_Pending');

  const reversed = await reverseGrn(grn);

  // Correct the quantity but keep the SAME roll number — the point of the edit.
  const edit = editPayloadFrom(reversed, (rolls) =>
    rolls.map((r) => ({ ...r, receivingQty: 40 })));

  const { status: draftStatus, data: draftBody } = await api.post('/grns/draft', edit);
  expect(draftStatus, `draft save failed: ${JSON.stringify(draftBody)}`).toBe(200);

  const afterEdit = await fetchGrn(grn.id);
  expect(afterEdit.lineItems[0].rolls).toHaveLength(1);
  expect(afterEdit.lineItems[0].rolls[0].rollNumber).toBe(rollNumber);
  expect(Number(afterEdit.lineItems[0].rolls[0].receivingQty)).toBe(40);

  // And it must still re-submit cleanly back into QC.
  const resubmit = editPayloadFrom(afterEdit, (rolls) => rolls);
  const { status: subStatus, data: subBody } = await api.post('/grns/submit', resubmit);
  expect(subStatus, `re-submit failed: ${JSON.stringify(subBody)}`).toBe(200);
  expect(subBody.status).toBe('QC_Pending');
});
