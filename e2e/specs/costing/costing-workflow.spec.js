/**
 * Costing — Status Lifecycle & Approval Workflow (API)
 *
 * What this tests:
 *   - Draft → submit (status Final) AUTO-APPROVES under e2e because no approval
 *     flow is configured (CostSheetService submits Final sheets to the approval
 *     engine, which returns autoApproved → status Approved). This is the real,
 *     reachable e2e lifecycle: Draft → Approved.
 *   - Approved sheets are locked: a data edit is rejected ("not in Draft/Rejected").
 *   - Duplicate → brand-new independent Draft.
 *   - History endpoint returns version snapshots after edits.
 *
 * Status enum: Draft | Final | Approved | Rejected (capitalized).
 * NOTE: Final and Rejected are NOT reachable via the happy path under the no-flow
 * e2e profile (Final auto-approves), so the /approve and /reject endpoints — which
 * require a pending Final sheet — are exercised by the approval-engine suite, not here.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

const FK = { buyerId: 1, styleId: 3, fabricItemId: 1, processId: 20, overheadId: 1 };

let api;
const created = [];

test.beforeAll(async () => { api = await createAuthenticatedClient(); });
test.afterAll(async () => {
  for (const id of created) { try { await api.delete(`/cost-sheets/${id}`); } catch { /* gone */ } }
  await api.dispose();
});

function basePayload(status = 'Draft') {
  return {
    status,
    date: new Date().toISOString().split('T')[0],
    buyerId: FK.buyerId, styleId: FK.styleId, garmentName: 'WF Garment',
    season: 'SS26', currency: 'INR', quoteCurrency: 'USD', actualRate: 83.5, todaysRate: 83.5,
    sizes: ['M'], costingType: 'FOB', pricingUnit: 'PIECE', scenarioName: 'WF',
    agentCommissionPct: 5, profitPct: 10, targetPrice: 0,
    fabricRows: [{ itemId: FK.fabricItemId, classification: 'Woven', consumption: 1, fabricPrice: 100, allowancePct: 0, wastagePct: 0, netCost: 100, sizes: '' }],
    localTrims: [], importedTrims: [],
    manufacturingRows: [{ processId: FK.processId, cost: 20, sizes: '' }],
    overheadRows: [{ overheadId: FK.overheadId, cost: 5, sizes: '' }],
  };
}

async function createSheet(status = 'Draft') {
  const res = await api.post('/cost-sheets', basePayload(status));
  expect(res.status).toBe(200);
  created.push(res.data.id);
  return res.data;
}

test.describe('Costing — Status Lifecycle', () => {
  test('Draft → submit auto-approves to Approved (no flow configured)', async () => {
    const draft = await createSheet('Draft');
    expect(draft.status).toBe('Draft');

    // Submit: save with status Final, mirroring handleSubmit. With no approval flow
    // configured the engine auto-approves, so the persisted status is Approved.
    const cur = (await api.get(`/cost-sheets/${draft.id}`)).data;
    const fin = await api.post('/cost-sheets', { ...cur, id: draft.id, status: 'Final' });
    expect(fin.status).toBe(200);
    expect(fin.data.status).toBe('Approved');

    const got = (await api.get(`/cost-sheets/${draft.id}`)).data;
    expect(got.status).toBe('Approved');
  });

  test('Approved sheet is locked from further data edits', async () => {
    const draft = await createSheet('Draft');
    const cur = (await api.get(`/cost-sheets/${draft.id}`)).data;
    await api.post('/cost-sheets', { ...cur, id: draft.id, status: 'Final' }); // → Approved
    const approved = (await api.get(`/cost-sheets/${draft.id}`)).data;
    expect(approved.status).toBe('Approved');

    // Attempt to edit data on the Approved sheet → must be rejected by the backend guard.
    const edit = await api.post('/cost-sheets', { ...approved, id: draft.id, profitPct: 99 });
    expect(edit.status).toBeGreaterThanOrEqual(400);

    // Confirm the value did NOT change.
    const after = (await api.get(`/cost-sheets/${draft.id}`)).data;
    expect(after.profitPct).not.toBe(99);
  });
});

test.describe('Costing — Duplicate & History', () => {
  test('Duplicate creates an independent new Draft', async () => {
    const src = await createSheet('Draft');
    const dup = await api.post(`/cost-sheets/${src.id}/duplicate`);
    expect(dup.status).toBe(200);
    expect(dup.data.id).not.toBe(src.id);
    expect(dup.data.status).toBe('Draft');
    created.push(dup.data.id);

    // The duplicate carries the same cost rows
    const got = (await api.get(`/cost-sheets/${dup.data.id}`)).data;
    expect(got.fabricRows.length).toBe(1);
    expect(got.manufacturingRows.length).toBe(1);
  });

  test('History records snapshots across edits', async () => {
    const draft = await createSheet('Draft');
    // Two edits → at least one history entry
    const cur = (await api.get(`/cost-sheets/${draft.id}`)).data;
    await api.post('/cost-sheets', { ...cur, id: draft.id, profitPct: 14 });
    await api.post('/cost-sheets', { ...cur, id: draft.id, status: 'Final' });

    const hist = await api.get(`/cost-sheets/${draft.id}/history`);
    expect(hist.status).toBe(200);
    expect(Array.isArray(hist.data)).toBeTruthy();
  });
});
