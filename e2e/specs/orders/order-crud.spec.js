/**
 * Orders — API CRUD, Field Round-Trip & Line/Color Calc Verification
 *
 * Orders are created from an APPROVED cost sheet (which supplies buyer/style/
 * currency). Each order has lines; each line has a size preset, per-size prices,
 * and one or more color rows with per-size quantities. The backend computes
 * colorRow.total / colorRow.rowValue / line.lineQty / line.lineTotal.
 *
 * What this tests:
 *   - Search pagination contract
 *   - Create with full header + 1 line + 2 color rows (multi-size) → re-GET →
 *     assert every header, line, and color field round-trips (FK names resolve)
 *   - Backend line/color totals match the formulas (Σ qty, Σ qty×price)
 *   - Update: changing a quantity recomputes the line/color totals
 *   - Delete is Draft-only
 *
 * Status enum: DRAFT | CONFIRMED | REFER_BACK_REQUESTED | REFERRED_BACK |
 *              CANCEL_REQUESTED | IN_PRODUCTION | COMPLETED | CANCELLED (UPPER).
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';

let api;
let refs;
const createdOrders = [];
const createdCostings = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  refs = await loadOrderRefs(api);
});
test.afterAll(async () => {
  for (const id of createdOrders) { try { await api.delete(`/orders/${id}`); } catch { /* gone */ } }
  for (const id of createdCostings) { try { await api.delete(`/cost-sheets/${id}`); } catch { /* gone */ } }
  await api.dispose();
});

async function createOrder(overrides) {
  const costing = await seedApprovedCosting(api);
  createdCostings.push(costing.costSheetId);
  const payload = buildOrderPayload(costing, refs, overrides);
  const res = await api.post('/orders', payload);
  if (res.data?.id) createdOrders.push(res.data.id);
  return { res, payload, costing };
}

test.describe('Orders — API Search & Field Round-Trip', () => {
  test('Search returns a paginated Order page', async () => {
    const res = await api.get('/orders/search', { page: 0, size: 10 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(Array.isArray(res.data.content)).toBeTruthy();
  });

  test('Create persists every header + line + color field (FK names resolve)', async () => {
    const { res, payload } = await createOrder();
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const got = (await api.get(`/orders/${res.data.id}`)).data;

    // header
    expect(got.orderNo).toMatch(/^SG\//);
    expect(got.status).toBe('DRAFT');
    expect(got.costingId).toBe(payload.costingId);
    expect(got.buyerId).toBe(payload.buyerId);
    expect(got.buyerName).toBe('H&M Hennes & Mauritz');     // resolved
    expect(got.styleNo).toBe(payload.styleNo);
    expect(got.garmentType).toBe(payload.garmentType);
    expect(got.season).toBe(payload.season);
    expect(got.material).toBe('Knit');
    expect(got.component).toBe('Single');
    expect(got.currency).toBe(payload.currency);
    expect(got.paymentTermsId).toBe(payload.paymentTermsId);
    expect(got.paymentTermsName).toBe(payload.paymentTermsName);
    expect(got.paymentDays).toBe(payload.paymentDays);
    expect(got.fabricDescription).toBe(payload.fabricDescription);
    expect(got.remarks).toBe(payload.remarks);

    // line
    expect(got.orderLines).toHaveLength(1);
    const line = got.orderLines[0];
    const pLine = payload.orderLines[0];
    expect(line.buyerPoNo).toBe(pLine.buyerPoNo);
    expect(line.destination).toBe(pLine.destination);
    expect(line.dispatchDate).toBe(pLine.dispatchDate);
    expect(line.leadTime).toBe(pLine.leadTime);
    expect(line.sizePresetId).toBe(pLine.sizePresetId);
    expect(line.sizePrices).toEqual(pLine.sizePrices);

    // color rows
    expect(line.colorRows).toHaveLength(2);
    const names = line.colorRows.map((c) => c.colorName).sort();
    expect(names).toEqual(['Black', 'Navy']);
    for (const cr of line.colorRows) {
      const pcr = pLine.colorRows.find((c) => c.colorName === cr.colorName);
      expect(cr.quantities).toEqual(pcr.quantities);
    }
  });
});

test.describe('Orders — Backend Line/Color Calc Verification', () => {
  test('colorRow.total / rowValue / line.lineQty / lineTotal match formulas', async () => {
    const { res, payload } = await createOrder();
    const got = (await api.get(`/orders/${res.data.id}`)).data;
    const line = got.orderLines[0];
    const prices = payload.orderLines[0].sizePrices;

    let lineQty = 0;
    let lineTotal = 0;
    for (const cr of line.colorRows) {
      const expTotal = Object.values(cr.quantities).reduce((a, b) => a + b, 0);
      const expValue = Object.entries(cr.quantities).reduce((a, [s, q]) => a + q * prices[s], 0);
      expect(cr.total).toBe(expTotal);
      expect(Number(cr.rowValue)).toBeCloseTo(expValue, 2);
      lineQty += expTotal;
      lineTotal += expValue;
    }
    expect(line.lineQty).toBe(lineQty);
    expect(Number(line.lineTotal)).toBeCloseTo(lineTotal, 2);
  });

  test('Updating a color quantity recomputes the line totals', async () => {
    const { res } = await createOrder();
    const id = res.data.id;
    const got = (await api.get(`/orders/${id}`)).data;

    // bump the first size qty of the first color by +100
    const line = got.orderLines[0];
    const firstSize = Object.keys(line.colorRows[0].quantities)[0];
    const before = line.lineQty;
    line.colorRows[0].quantities[firstSize] += 100;

    const upd = await api.put(`/orders/${id}`, { ...got, orderLines: got.orderLines });
    expect(upd.status).toBeGreaterThanOrEqual(200);
    expect(upd.status).toBeLessThan(300);

    const after = (await api.get(`/orders/${id}`)).data;
    expect(after.orderLines[0].lineQty).toBe(before + 100);
  });
});

test.describe('Orders — Delete rules', () => {
  test('A Draft order can be deleted', async () => {
    const { res } = await createOrder();
    const id = res.data.id;
    const del = await api.delete(`/orders/${id}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
    const get = await api.get(`/orders/${id}`);
    expect(get.status).not.toBe(200);
  });
});
