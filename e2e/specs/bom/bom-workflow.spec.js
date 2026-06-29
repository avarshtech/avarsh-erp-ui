/**
 * BOM — Status Workflow (API)
 *
 * BOM has just two states: DRAFT → CREATED. The transition is carried in the
 * create/update payload `status` (there is no separate status endpoint used by
 * the UI). BOM is NOT wired to the approval engine — the approval gate is
 * upstream (only CONFIRMED orders can seed a BOM).
 *
 * What this tests:
 *   - Save as Draft → status DRAFT
 *   - Create/Submit → status CREATED
 *   - A CREATED BOM is still editable (re-save) but NOT deletable (Draft-only)
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder, loadBomRefs, buildBomPayload } from '../../helpers/bom-seed.js';

let api;
let refs;
const createdBoms = [];
const cleanup = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  refs = await loadBomRefs(api);
});
test.afterAll(async () => {
  for (const id of createdBoms) { try { await api.delete(`/boms/${id}`); } catch { /* gone */ } }
  for (const c of cleanup) {
    try { await api.delete(`/orders/${c.orderId}`); } catch { /* gone */ }
    try { await api.delete(`/cost-sheets/${c.costSheetId}`); } catch { /* gone */ }
  }
  await api.dispose();
});

async function createBom(status = 'DRAFT') {
  const { order, costSheetId } = await seedConfirmedOrder(api);
  cleanup.push({ orderId: order.id, costSheetId });
  const res = await api.post('/boms', buildBomPayload(order, refs, { status }));
  if (res.data?.id) createdBoms.push(res.data.id);
  return res.data;
}

test.describe('BOM — Status Workflow', () => {
  test('Save as Draft persists status DRAFT', async () => {
    const bom = await createBom('DRAFT');
    expect(bom.status).toBe('DRAFT');
  });

  test('Create BOM persists status CREATED', async () => {
    const bom = await createBom('CREATED');
    expect(bom.status).toBe('CREATED');
    const got = (await api.get(`/boms/${bom.id}`)).data;
    expect(got.status).toBe('CREATED');
  });

  test('Draft → Created via update payload status', async () => {
    const bom = await createBom('DRAFT');
    const got = (await api.get(`/boms/${bom.id}`)).data;
    const upd = await api.put(`/boms/${bom.id}`, { ...got, status: 'CREATED' });
    expect(upd.status).toBeGreaterThanOrEqual(200);
    expect(upd.status).toBeLessThan(300);
    const after = (await api.get(`/boms/${bom.id}`)).data;
    expect(after.status).toBe('CREATED');
  });

  test('A CREATED BOM is editable but not deletable', async () => {
    const bom = await createBom('CREATED');
    const got = (await api.get(`/boms/${bom.id}`)).data;

    // editable: re-save with new remarks succeeds
    const upd = await api.put(`/boms/${bom.id}`, { ...got, remarks: 'post-create edit' });
    expect(upd.status).toBeGreaterThanOrEqual(200);
    expect(upd.status).toBeLessThan(300);

    // not deletable: delete on a CREATED BOM is rejected
    const del = await api.delete(`/boms/${bom.id}`);
    expect(del.status).toBeGreaterThanOrEqual(400);
    const still = await api.get(`/boms/${bom.id}`);
    expect(still.status).toBe(200);
  });
});
