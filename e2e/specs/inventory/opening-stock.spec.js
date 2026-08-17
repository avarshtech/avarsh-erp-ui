/**
 * Opening stock (scenario I6) — batches, CSV, guards, post and finalize.
 *
 * Order matters (serial): finalize is a one-way system state, so it is the LAST test —
 * after it no further batches can be authored in this H2 session. The suite runs on a
 * fresh boot in the full-estate gate, so nothing downstream depends on the pre-finalize
 * state.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';

let api;
let fabricItem;   // seeded fabric item with its primary UOM
let wrongUom;     // a UOM that is neither primary nor secondary for fabricItem

const ROLL_A = `OS-ROLL-A-${Date.now()}`;
const ROLL_B = `OS-ROLL-B-${Date.now()}`;

function fabricLine(overrides = {}) {
  return {
    itemId: fabricItem.id,
    itemCode: fabricItem.itemCode,
    rollNumber: ROLL_A,
    quantity: 25,
    uomId: fabricItem.uomId,
    uomSymbol: fabricItem.uomSymbol,
    unitCost: 300,
    color: 'Navy',
    shadeLot: 'OS-SL-1',
    ...overrides,
  };
}

function batchPayload(lines, overrides = {}) {
  return {
    batchType: 'FABRIC',
    referenceDate: new Date().toISOString().split('T')[0],
    notes: 'E2E opening stock batch',
    fabricLines: lines,
    accessoriesLines: [],
    ...overrides,
  };
}

test.describe.configure({ mode: 'serial' });

test.describe('Opening stock', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    const { data } = await api.get('/items/search?size=50');
    const items = data.content || data;
    fabricItem = items.find((i) => (i.categoryName || '').toLowerCase().includes('fabric'));
    expect(fabricItem, 'a seeded fabric item is required').toBeTruthy();

    const { data: uoms } = await api.get('/unit-of-measures');
    wrongUom = (uoms.content || uoms).find(
      (u) => u.id !== fabricItem.uomId && u.id !== fabricItem.secondaryUomId,
    );
  });

  test.afterAll(async () => { await api?.dispose(); });

  test('CSV templates download with a header row', async () => {
    for (const kind of ['fabric', 'accessories']) {
      const res = await api.get(`/opening-stock/template/${kind}.csv`);
      expect(res.status).toBeLessThan(300);
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      expect(text.length, `${kind} template must not be empty`).toBeGreaterThan(10);
    }
  });

  test('a batch requires at least one line', async () => {
    const res = await api.post('/opening-stock/batches', batchPayload([]));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('a line UOM must be the item primary or secondary UOM', async () => {
    test.skip(!wrongUom, 'no third UOM available to provoke the mismatch');
    const res = await api.post('/opening-stock/batches', batchPayload([
      fabricLine({ uomId: wrongUom.id, uomSymbol: wrongUom.symbol }),
    ]));
    expect(res.status, 'mismatched UOM must be refused').toBeGreaterThanOrEqual(400);
  });

  test('duplicate roll numbers within one batch are refused', async () => {
    const res = await api.post('/opening-stock/batches', batchPayload([
      fabricLine(),
      fabricLine({ rollNumber: ROLL_A, color: 'Black' }),
    ]));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('draft → post moves the batch to POSTED, and its roll is claimed system-wide', async () => {
    const created = await api.post('/opening-stock/batches', batchPayload([fabricLine()]));
    expect(created.status, JSON.stringify(created.data).slice(0, 300)).toBeLessThan(300);
    const batchId = created.data.id;
    expect(String(created.data.status)).toMatch(/DRAFT/i);

    const posted = await api.post(`/opening-stock/batches/${batchId}/post`, {});
    expect(posted.status).toBeLessThan(300);
    const { data: after } = await api.get(`/opening-stock/batches/${batchId}`);
    expect(String(after.status)).toMatch(/POSTED/i);

    // The same roll in a NEW batch must now be refused (cross-batch uniqueness).
    const dup = await api.post('/opening-stock/batches', batchPayload([fabricLine()]));
    expect(dup.status, 'roll reuse across batches must be refused').toBeGreaterThanOrEqual(400);
  });

  test('a draft batch can be cancelled', async () => {
    const created = await api.post('/opening-stock/batches', batchPayload([
      fabricLine({ rollNumber: ROLL_B }),
    ]));
    expect(created.status).toBeLessThan(300);
    const cancel = await api.post(`/opening-stock/batches/${created.data.id}/cancel`, {});
    expect(cancel.status).toBeLessThan(300);
    const { data: after } = await api.get(`/opening-stock/batches/${created.data.id}`);
    expect(String(after.status)).toMatch(/CANCEL/i);
  });

  test('finalize refuses while a draft exists, succeeds once drafts are cleared', async () => {
    // Leave one draft behind deliberately.
    const draft = await api.post('/opening-stock/batches', batchPayload([
      fabricLine({ rollNumber: `OS-ROLL-C-${Date.now()}` }),
    ]));
    expect(draft.status).toBeLessThan(300);

    const refused = await api.post('/opening-stock/finalize', {});
    expect(refused.status, 'finalize with drafts outstanding must be refused').toBeGreaterThanOrEqual(400);

    await api.post(`/opening-stock/batches/${draft.data.id}/cancel`, {});

    const ok = await api.post('/opening-stock/finalize', {});
    expect(ok.status, `finalize failed: ${JSON.stringify(ok.data).slice(0, 300)}`).toBeLessThan(300);

    const { data: status } = await api.get('/opening-stock/status');
    expect(JSON.stringify(status)).toMatch(/final/i);
  });
});
