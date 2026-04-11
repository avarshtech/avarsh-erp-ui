/**
 * Accessories (Trims) GRN — API E2E Tests
 *
 * Seeded POs:
 *   E2E-AG-1 — 1 Trims line (5000 qty)  → Combos 9-11
 *   E2E-AG-2 — 3 Trims lines (5000 each) → Combos 12-14
 *
 * Strategy: Small quantities per test (20-50) so POs never exhaust.
 *
 * Trims GRN key differences from Fabric:
 *   - grnType = 'Trims'
 *   - Uses items (receivingQty per item) + cartons (packaging breakdown)
 *   - Carton sum per item MUST equal receivingQty on submit
 *   - No rolls, no rollNumber/shadeLot
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findPOByNumber, refreshPO, trimsGrnPayload,
  getPOReceipts, today,
} from '../../helpers/grn-qc-data.js';

// ─── PO Line Combinations ────────────────────────────────────────────────────

test.describe.serial('Accessories GRN — PO Line Combinations (API)', () => {
  let api, poSingle, poMulti;
  const createdIds = [];

  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    poSingle = await findPOByNumber(api, 'E2E-AG-1');
    poMulti = await findPOByNumber(api, 'E2E-AG-2');
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      try { await api.delete(`/grns/${id}`); } catch { /* submitted GRNs may not be deletable */ }
    }
    await api.dispose();
  });

  test('Combo 9: Single line, 1 item qty=50, 1 carton qty=50', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(50);

    const qty = 50;
    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-C9-${Date.now()}`, quantity: qty }],
    };

    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = qty;
    payload.lineItems[0].cartons = cartonConfig[item.id].map((c) => ({
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: c.cartonNumber,
      quantity: c.quantity,
      uom: item.uom,
    }));

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    expect(res.data.grnType).toBe('Trims');
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(1);

    const lineCartons = grn.lineItems[0].cartons || [];
    expect(lineCartons).toHaveLength(1);
    expect(lineCartons[0].quantity).toBe(qty);
  });

  test('Combo 10: Single line, 1 item qty=60, 3 cartons (20+20+20)', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(60);

    const qty = 60;
    const cartonConfig = {
      [item.id]: [
        { cartonNumber: `CTN-C10A-${Date.now()}`, quantity: 20 },
        { cartonNumber: `CTN-C10B-${Date.now()}`, quantity: 20 },
        { cartonNumber: `CTN-C10C-${Date.now()}`, quantity: 20 },
      ],
    };

    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = qty;
    payload.lineItems[0].cartons = cartonConfig[item.id].map((c) => ({
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: c.cartonNumber,
      quantity: c.quantity,
      uom: item.uom,
    }));

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    const lineCartons = grn.lineItems[0].cartons || [];
    expect(lineCartons).toHaveLength(3);

    const cartonSum = lineCartons.reduce((sum, c) => sum + c.quantity, 0);
    expect(cartonSum).toBe(qty);
  });

  test('Combo 11: Single line, partial qty=30, 1 carton=30', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(30);

    const qty = 30;
    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-C11-${Date.now()}`, quantity: qty }],
    };

    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = qty;
    payload.lineItems[0].cartons = cartonConfig[item.id].map((c) => ({
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: c.cartonNumber,
      quantity: c.quantity,
      uom: item.uom,
    }));

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    // Verify cumulative receipts reflect this partial GRN
    const receipts = await getPOReceipts(api, poSingle.id);
    const totalReceived = Number(receipts[item.id] || 0);
    expect(totalReceived).toBeGreaterThanOrEqual(qty);
  });

  test('Combo 12: Multi-line PO, all 3 items, 1 carton each, qty=30', async () => {
    await refreshPO(api, poMulti);
    const items = poMulti.items.filter((i) => i.pendingQty >= 30);
    expect(items.length).toBeGreaterThanOrEqual(3);

    const selected = items.slice(0, 3);
    const qty = 30;
    const cartonConfig = {};
    selected.forEach((item) => {
      cartonConfig[item.id] = [
        { cartonNumber: `CTN-C12-${item.id}-${Date.now()}`, quantity: qty },
      ];
    });

    const payload = trimsGrnPayload(poMulti, selected, cartonConfig);
    selected.forEach((item) => {
      const pi = payload.items.find((i) => i.poLineItemId === item.id);
      if (pi) pi.receivingQty = qty;
    });
    // Rebuild lineItems cartons to ensure all columns populated
    payload.lineItems.forEach((li) => {
      const item = selected.find((s) => s.id === li.poLineItemId);
      if (item) {
        li.cartons = cartonConfig[item.id].map((c) => ({
          poLineItemId: item.id,
          itemCode: item.itemCode,
          itemDescription: item.description,
          color: item.color,
          size: item.size,
          cartonNumber: c.cartonNumber,
          quantity: c.quantity,
          uom: item.uom,
        }));
      }
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(3);
  });

  test('Combo 13: Multi-line PO, subset 2 of 3 items', async () => {
    await refreshPO(api, poMulti);
    const items = poMulti.items.filter((i) => i.pendingQty >= 30);
    expect(items.length).toBeGreaterThanOrEqual(2);

    const selected = items.slice(0, 2);
    const qty = 30;
    const cartonConfig = {};
    selected.forEach((item) => {
      cartonConfig[item.id] = [
        { cartonNumber: `CTN-C13-${item.id}-${Date.now()}`, quantity: qty },
      ];
    });

    const payload = trimsGrnPayload(poMulti, selected, cartonConfig);
    selected.forEach((item) => {
      const pi = payload.items.find((i) => i.poLineItemId === item.id);
      if (pi) pi.receivingQty = qty;
    });
    payload.lineItems.forEach((li) => {
      const item = selected.find((s) => s.id === li.poLineItemId);
      if (item) {
        li.cartons = cartonConfig[item.id].map((c) => ({
          poLineItemId: item.id,
          itemCode: item.itemCode,
          itemDescription: item.description,
          color: item.color,
          size: item.size,
          cartonNumber: c.cartonNumber,
          quantity: c.quantity,
          uom: item.uom,
        }));
      }
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(2);
  });

  test('Combo 14: Multi-line PO, item[0] full 50 + item[1] half 25', async () => {
    await refreshPO(api, poMulti);
    const items = poMulti.items.filter((i) => i.pendingQty > 0);
    expect(items.length).toBeGreaterThanOrEqual(2);

    const fullItem = items[0];
    const halfItem = items[1];
    const fullQty = 50;
    const halfQty = 25;
    expect(fullItem.pendingQty).toBeGreaterThanOrEqual(fullQty);
    expect(halfItem.pendingQty).toBeGreaterThanOrEqual(halfQty);

    const selected = [fullItem, halfItem];
    const cartonConfig = {
      [fullItem.id]: [
        { cartonNumber: `CTN-C14F-${Date.now()}`, quantity: fullQty },
      ],
      [halfItem.id]: [
        { cartonNumber: `CTN-C14H-${Date.now()}`, quantity: halfQty },
      ],
    };

    const payload = trimsGrnPayload(poMulti, selected, cartonConfig);
    // Set explicit receivingQty per item
    const pi0 = payload.items.find((i) => i.poLineItemId === fullItem.id);
    if (pi0) pi0.receivingQty = fullQty;
    const pi1 = payload.items.find((i) => i.poLineItemId === halfItem.id);
    if (pi1) pi1.receivingQty = halfQty;

    // Rebuild lineItems cartons with all columns
    payload.lineItems.forEach((li) => {
      const item = selected.find((s) => s.id === li.poLineItemId);
      if (item) {
        const itemQty = item.id === fullItem.id ? fullQty : halfQty;
        li.cartons = cartonConfig[item.id].map((c) => ({
          poLineItemId: item.id,
          itemCode: item.itemCode,
          itemDescription: item.description,
          color: item.color,
          size: item.size,
          cartonNumber: c.cartonNumber,
          quantity: c.quantity,
          uom: item.uom,
        }));
      }
    });

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('QC_Pending');
    createdIds.push(res.data.id);

    const { data: grn } = await api.get(`/grns/${res.data.id}`);
    expect(grn.lineItems).toHaveLength(2);

    // Verify mixed receipt amounts
    const receipts = await getPOReceipts(api, poMulti.id);
    const fullReceived = Number(receipts[fullItem.id] || 0);
    const halfReceived = Number(receipts[halfItem.id] || 0);
    expect(fullReceived).toBeGreaterThanOrEqual(fullQty);
    expect(halfReceived).toBeGreaterThanOrEqual(halfQty);
  });
});

// ─── Validation Tests ────────────────────────────────────────────────────────

test.describe('Accessories GRN — Validation (API)', () => {
  let api, poSingle;
  const draftIds = [];

  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    poSingle = await findPOByNumber(api, 'E2E-AG-1');
  });

  test.afterAll(async () => {
    for (const id of draftIds) {
      try { await api.delete(`/grns/${id}`); } catch { /* ignore */ }
    }
    await api.dispose();
  });

  /** Build a valid single-item trims payload with explicit carton columns. */
  function validPayload(qty = 20) {
    const item = poSingle.items[0];
    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-VAL-${Date.now()}`, quantity: qty }],
    };
    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = qty;
    payload.lineItems[0].cartons = cartonConfig[item.id].map((c) => ({
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: c.cartonNumber,
      quantity: c.quantity,
      uom: item.uom,
    }));
    return payload;
  }

  test('submit: cartonNumber missing rejects with error', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThan(0);

    const qty = 20;
    const cartonConfig = {
      [item.id]: [{ cartonNumber: '', quantity: qty }],
    };
    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = qty;
    payload.lineItems[0].cartons = [{
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: '',
      quantity: qty,
      uom: item.uom,
    }];

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('submit: carton quantity <= 0 rejects with error', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThan(0);

    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-VAL-NEG-${Date.now()}`, quantity: 0 }],
    };
    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = 0;
    payload.lineItems[0].cartons = [{
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: cartonConfig[item.id][0].cartonNumber,
      quantity: 0,
      uom: item.uom,
    }];

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('submit: carton sum != receivingQty rejects with error', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThanOrEqual(40);

    // Build payload with carton qty=15, then override receivingQty to 40 → mismatch
    const payload = trimsGrnPayload(poSingle, [item], {
      [item.id]: [{ cartonNumber: `CTN-VAL-MIS-${Date.now()}`, quantity: 15 }],
    });
    // Force mismatch: lineItems receivingQty != carton sum
    payload.lineItems[0].receivingQty = 40;

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('submit: receivingQty > balance rejects with error', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThan(0);

    const overQty = item.pendingQty + 500;
    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-VAL-OVER-${Date.now()}`, quantity: overQty }],
    };
    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = overQty;
    payload.lineItems[0].cartons = [{
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: cartonConfig[item.id][0].cartonNumber,
      quantity: overQty,
      uom: item.uom,
    }];

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('submit: item receivingQty <= 0 rejects with error', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];

    const cartonConfig = {
      [item.id]: [{ cartonNumber: `CTN-VAL-ZERO-${Date.now()}`, quantity: 0 }],
    };
    const payload = trimsGrnPayload(poSingle, [item], cartonConfig);
    payload.items[0].receivingQty = 0;
    payload.lineItems[0].cartons = [{
      poLineItemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.description,
      color: item.color,
      size: item.size,
      cartonNumber: cartonConfig[item.id][0].cartonNumber,
      quantity: 0,
      uom: item.uom,
    }];

    const res = await api.post('/grns/submit', payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('draft saves without cartons', async () => {
    await refreshPO(api, poSingle);
    const item = poSingle.items[0];
    expect(item.pendingQty).toBeGreaterThan(0);

    // Build payload with empty cartons — draft should not require them
    const payload = trimsGrnPayload(poSingle, [item], {});
    payload.cartons = [];
    payload.lineItems.forEach((li) => { li.cartons = []; });

    const res = await api.post('/grns/draft', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    expect(res.data.status).toBe('Draft');
    expect(res.data.grnType).toBe('Trims');
    draftIds.push(res.data.id);
  });
});
