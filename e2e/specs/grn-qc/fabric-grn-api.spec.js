import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findPOByNumber, refreshPO, fabricGrnPayload,
  getPOReceipts, today,
} from '../../helpers/grn-qc-data.js';

/**
 * Fabric GRN API E2E Tests
 *
 * Seeded POs (V116__seed_grn_qc_masters.sql):
 *   E2E-FG-1 — 1 Fabric line, 5000 qty  → combos 1, 3, 4, 8
 *   E2E-FG-2 — 3 Fabric lines, 5000 each → combos 2, 5, 6, 7
 *
 * Strategy: Use small quantities (10-50) per test so POs never exhaust
 * across repeated test runs.
 */

let api;
let poSingle;   // E2E-FG-1 — 1 line, 5000 qty
let poMulti;    // E2E-FG-2 — 3 lines, 5000 each

const createdIds = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  poSingle = await findPOByNumber(api, 'E2E-FG-1');
  poMulti = await findPOByNumber(api, 'E2E-FG-2');
});

test.afterAll(async () => {
  for (const id of createdIds) {
    try { await api.delete(`/grns/${id}`); } catch { /* submitted GRNs can't be deleted */ }
  }
  await api.dispose();
});

// ─── PO Line Combinations ───────────────────────────────────────────────────

test.describe.serial('Fabric GRN — PO Line Combinations (API)', () => {

  test('Combo 1: Single line, 1 roll, qty=50 — verify all GRN fields', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(50);

    const ts = Date.now();
    const payload = fabricGrnPayload(poSingle, [item], {
      [item.id]: [{ rollNumber: `R-C1-${ts}`, receivingQty: 50, shadeLot: 'SL-C1' }],
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    // Verify full GRN response has all fields populated
    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.grnType).toBe('Fabric');
    expect(grn.grnDate).toBeTruthy();
    expect(grn.poId).toBe(poSingle.id);
    expect(grn.challanNo).toBeTruthy();
    expect(grn.invoiceDate).toBeTruthy();
    expect(grn.deliveryChallanDate).toBeTruthy();
    expect(grn.vehicleNumber).toBeTruthy();
    expect(grn.transporter).toBeTruthy();
    expect(grn.lineItems).toHaveLength(1);
    expect(grn.lineItems[0].rolls).toHaveLength(1);
    expect(grn.lineItems[0].rolls[0].rollNumber).toContain('R-C1-');
    expect(Number(grn.lineItems[0].rolls[0].receivingQty)).toBe(50);
  });

  test('Combo 2: poMulti line[0], 3 rolls (20+15+15=50)', async () => {
    await refreshPO(api, poMulti);
    const item = poMulti.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(50);

    const ts = Date.now();
    const payload = fabricGrnPayload(poMulti, [item], {
      [item.id]: [
        { rollNumber: `R-C2A-${ts}`, receivingQty: 20, shadeLot: 'SL-C2' },
        { rollNumber: `R-C2B-${ts}`, receivingQty: 15, shadeLot: 'SL-C2' },
        { rollNumber: `R-C2C-${ts}`, receivingQty: 15, shadeLot: 'SL-C2' },
      ],
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(1);
    expect(grn.lineItems[0].rolls).toHaveLength(3);

    const totalReceived = grn.lineItems[0].rolls.reduce((s, r) => s + Number(r.receivingQty), 0);
    expect(totalReceived).toBe(50);
  });

  test('Combo 3: poSingle, partial qty=30 — verify cumulative receipts', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(30);

    const ts = Date.now();
    const payload = fabricGrnPayload(poSingle, [item], {
      [item.id]: [{ rollNumber: `R-C3-${ts}`, receivingQty: 30, shadeLot: 'SL-C3' }],
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    // Combo 1 sent 50, Combo 3 sends 30 => cumulative = 80
    const receipts = await getPOReceipts(api, poSingle.id);
    expect(Number(receipts[item.id] || 0)).toBeGreaterThanOrEqual(80);
  });

  test('Combo 4: poSingle, small additional qty — verify receipts increased', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    const receiptsBefore = await getPOReceipts(api, poSingle.id);
    const receivedBefore = Number(receiptsBefore[item.id] || 0);

    const addQty = 20;
    expect(item.pendingQty).toBeGreaterThanOrEqual(addQty);

    const ts = Date.now();
    const payload = fabricGrnPayload(poSingle, [item], {
      [item.id]: [{ rollNumber: `R-C4-${ts}`, receivingQty: addQty, shadeLot: 'SL-C4' }],
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    const receiptsAfter = await getPOReceipts(api, poSingle.id);
    const receivedAfter = Number(receiptsAfter[item.id] || 0);
    expect(receivedAfter).toBe(receivedBefore + addQty);
  });

  test('Combo 5: poMulti all 3 lines, 20 qty each, 1 roll per line', async () => {
    await refreshPO(api, poMulti);
    const selected = poMulti.items.filter((i) => i.pendingQty >= 20);
    expect(selected).toHaveLength(3);

    const ts = Date.now();
    const rollConfig = {};
    selected.forEach((item, i) => {
      rollConfig[item.id] = [{ rollNumber: `R-C5-${i}-${ts}`, receivingQty: 20, shadeLot: 'SL-C5' }];
    });

    const payload = fabricGrnPayload(poMulti, selected, rollConfig);
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(3);
    grn.lineItems.forEach((li) => {
      expect(li.rolls).toHaveLength(1);
      expect(Number(li.rolls[0].receivingQty)).toBe(20);
    });
  });

  test('Combo 6: poMulti 2 of 3 lines (subset)', async () => {
    await refreshPO(api, poMulti);
    const withBalance = poMulti.items.filter((i) => i.pendingQty >= 15);
    expect(withBalance.length).toBeGreaterThanOrEqual(2);

    const selected = withBalance.slice(0, 2);
    const ts = Date.now();
    const rollConfig = {};
    selected.forEach((item, i) => {
      rollConfig[item.id] = [{ rollNumber: `R-C6-${i}-${ts}`, receivingQty: 15, shadeLot: 'SL-C6' }];
    });

    const payload = fabricGrnPayload(poMulti, selected, rollConfig);
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(2);
  });

  test('Combo 7: poMulti line[0] full remaining + line[1] half remaining', async () => {
    await refreshPO(api, poMulti);
    const item0 = poMulti.items[0];
    const item1 = poMulti.items[1];
    expect(item0.pendingQty).toBeGreaterThan(0);
    expect(item1.pendingQty).toBeGreaterThan(0);

    // Take a small "full" chunk from item0 and half-chunk from item1
    const item0Qty = Math.min(40, item0.pendingQty);
    const item1Qty = Math.min(25, Math.floor(item1.pendingQty / 2));
    expect(item1Qty).toBeGreaterThan(0);

    const ts = Date.now();
    const rollConfig = {
      [item0.id]: [{ rollNumber: `R-C7-0-${ts}`, receivingQty: item0Qty, shadeLot: 'SL-C7' }],
      [item1.id]: [{ rollNumber: `R-C7-1-${ts}`, receivingQty: item1Qty, shadeLot: 'SL-C7' }],
    };

    const payload = fabricGrnPayload(poMulti, [item0, item1], rollConfig);
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    createdIds.push(res.data.id);

    // Verify mixed receipt state
    const receipts = await getPOReceipts(api, poMulti.id);
    expect(Number(receipts[item0.id] || 0)).toBeGreaterThan(0);
    expect(Number(receipts[item1.id] || 0)).toBeGreaterThan(0);
  });

  test('Combo 8: Verify cumulative receipts on poSingle match expectations', async () => {
    // Combos 1 (50) + 3 (30) + 4 (20) = 100 total across poSingle
    const receipts = await getPOReceipts(api, poSingle.id);
    const item = poSingle.items[0];
    const totalReceived = Number(receipts[item.id] || 0);
    expect(totalReceived).toBeGreaterThanOrEqual(100);
    // PO still has balance (5000 total) so it's not fully consumed
    expect(totalReceived).toBeLessThan(item.orderedQty);
  });
});

// ─── Validation Rules ───────────────────────────────────────────────────────

test.describe('Fabric GRN — Validation (API)', () => {
  let validPO;
  let validItem;

  test.beforeAll(async () => {
    await refreshPO(api, poMulti);
    validPO = poMulti;
    validItem = poMulti.items.find((i) => i.pendingQty > 0);
    expect(validItem).toBeTruthy();
  });

  function validPayload(overrides = {}) {
    return fabricGrnPayload(validPO, [validItem], {
      [validItem.id]: [{
        rollNumber: `R-VAL-${Date.now()}`,
        receivingQty: Math.min(10, validItem.pendingQty),
        shadeLot: 'SL-VAL',
      }],
    }, overrides);
  }

  test('missing poId → 4xx error', async () => {
    const payload = validPayload();
    delete payload.poId;
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('empty lineItems → 4xx error', async () => {
    const payload = validPayload();
    payload.lineItems = [];
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('missing challanNo → 4xx error', async () => {
    const payload = validPayload();
    payload.challanNo = '';
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('invalid challanNo format → 4xx error', async () => {
    const payload = validPayload({ challanNo: 'CH@#$!' });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('future invoiceDate → error', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const payload = validPayload({ invoiceDate: future.toISOString().split('T')[0] });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('invoiceDate outside PO range → error', async () => {
    const payload = validPayload({ invoiceDate: '2020-01-01' });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('future deliveryChallanDate → error', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const payload = validPayload({ deliveryChallanDate: future.toISOString().split('T')[0] });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    if (res.status === 200 && res.data?.id) createdIds.push(res.data.id);
  });

  test('missing vehicleNumber → 4xx error', async () => {
    const payload = validPayload({ vehicleNumber: '' });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('missing transporter → 4xx error', async () => {
    const payload = validPayload({ transporter: '' });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('submit: missing rollNumber → 4xx error', async () => {
    const payload = validPayload();
    payload.lineItems[0].rolls[0].rollNumber = '';
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('submit: receivingQty <= 0 → 4xx error', async () => {
    const payload = validPayload();
    payload.lineItems[0].rolls[0].receivingQty = 0;
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('submit: missing shadeLot → 4xx error', async () => {
    const payload = validPayload();
    payload.lineItems[0].rolls[0].shadeLot = '';
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('submit: receivingQty > balance → 4xx error', async () => {
    await refreshPO(api, validPO);
    const freshItem = validPO.items.find((i) => i.pendingQty > 0) || validItem;
    const payload = fabricGrnPayload(validPO, [freshItem], {
      [freshItem.id]: [{
        rollNumber: `R-BAL-${Date.now()}`,
        receivingQty: freshItem.orderedQty + 100, // exceeds total ordered
        shadeLot: 'SL-BAL',
      }],
    });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('submit: duplicate rollNumber within GRN → 4xx error', async () => {
    await refreshPO(api, validPO);
    const freshItem = validPO.items.find((i) => i.pendingQty >= 10) || validItem;
    const dupRoll = `R-DUP-${Date.now()}`;
    const payload = fabricGrnPayload(validPO, [freshItem], {
      [freshItem.id]: [
        { rollNumber: dupRoll, receivingQty: 5, shadeLot: 'SL-D1' },
        { rollNumber: dupRoll, receivingQty: 5, shadeLot: 'SL-D2' }, // same rollNumber
      ],
    });
    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('draft saves with missing shadeLot (partial roll data OK)', async () => {
    await refreshPO(api, validPO);
    const freshItem = validPO.items.find((i) => i.pendingQty > 0) || validItem;
    const payload = fabricGrnPayload(validPO, [freshItem], {
      [freshItem.id]: [{
        rollNumber: `R-DRAFT-${Date.now()}`,
        receivingQty: 5,
        shadeLot: null, // missing — acceptable for draft
      }],
    });
    const res = await api.post('/grns/draft', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdIds.push(res.data.id);
  });
});
