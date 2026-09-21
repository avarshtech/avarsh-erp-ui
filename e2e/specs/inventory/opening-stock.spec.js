/**
 * Opening stock (scenario I6) — batches, CSV, guards and post.
 *
 * The suite is serial because the tests share seeded roll numbers and a batch's
 * status moves under them. It used to end with a finalize test, which was the
 * real reason for the ordering: finalize was a one-way system state that barred
 * every later write in the session. That lock is gone — the screen stays open
 * indefinitely — so the last test now asserts the opposite, that authoring
 * still works once batches have been posted.
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
      // CSV is not JSON — read the raw body, not the parsed-data field.
      const text = await res.response.text();
      expect(text.length, `${kind} template must not be empty`).toBeGreaterThan(10);
      expect(text).toMatch(/,/);
    }
  });

  test('an empty batch can be drafted but not POSTED', async () => {
    // The at-least-one-line rule fires at posting time, not at draft creation.
    const res = await api.post('/opening-stock/batches', batchPayload([]));
    expect(res.status).toBeLessThan(300);
    const post = await api.post(`/opening-stock/batches/${res.data.id}/post`, {});
    expect(post.status, 'posting an empty batch must be refused').toBeGreaterThanOrEqual(400);
    await api.post(`/opening-stock/batches/${res.data.id}/cancel`, {});
  });

  test('a line UOM must be the item primary or secondary UOM', async () => {
    test.skip(!wrongUom, 'no third UOM available to provoke the mismatch');
    // The rule may fire at draft-create or at posting time — either is a pass; both
    // succeeding would mean mismatched units can reach stock.
    const res = await api.post('/opening-stock/batches', batchPayload([
      fabricLine({ rollNumber: `OS-UOM-${Date.now()}`, uomId: wrongUom.id, uomSymbol: wrongUom.symbol }),
    ]));
    if (res.status < 300) {
      const post = await api.post(`/opening-stock/batches/${res.data.id}/post`, {});
      expect(post.status, 'mismatched UOM must be refused at post').toBeGreaterThanOrEqual(400);
      await api.post(`/opening-stock/batches/${res.data.id}/cancel`, {});
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
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

    // Cross-batch roll uniqueness: enforced at draft-create OR at posting time.
    const dup = await api.post('/opening-stock/batches', batchPayload([fabricLine()]));
    if (dup.status < 300) {
      const dupPost = await api.post(`/opening-stock/batches/${dup.data.id}/post`, {});
      expect(dupPost.status, 'posting a duplicate roll must be refused').toBeGreaterThanOrEqual(400);
      await api.post(`/opening-stock/batches/${dup.data.id}/cancel`, {});
    } else {
      expect(dup.status).toBeGreaterThanOrEqual(400);
    }
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

  test('the feature stays open after stock has been posted', async () => {
    // The regression this guards: opening stock was once sealed by a finalize
    // call once anything had been posted, which is exactly the state reached by
    // the time this test runs. Authoring must still work.
    const { data: before } = await api.get('/opening-stock/status');
    expect(before.postedCount, 'earlier tests should have posted a batch').toBeGreaterThan(0);

    const created = await api.post('/opening-stock/batches', batchPayload([
      fabricLine({ rollNumber: `OS-ROLL-C-${Date.now()}` }),
    ]));
    expect(created.status, `authoring after a post must still be allowed: ${JSON.stringify(created.data).slice(0, 300)}`)
      .toBeLessThan(300);

    const posted = await api.post(`/opening-stock/batches/${created.data.id}/post`, {});
    expect(posted.status, `posting after a post must still be allowed: ${JSON.stringify(posted.data).slice(0, 300)}`)
      .toBeLessThan(300);

    // No lock is reported any more — the status is batch counts and nothing else.
    const { data: after } = await api.get('/opening-stock/status');
    expect(after.postedCount).toBeGreaterThan(before.postedCount);
    expect(JSON.stringify(after)).not.toMatch(/final/i);
  });
});
