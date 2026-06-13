/**
 * PO — API CRUD, Field Round-Trip & Tax Verification (General PO)
 *
 * A General PO is free-form (supplier + manually-typed line items, no BOM).
 * Totals are CLIENT-computed and trusted by the backend. The tax model flips
 * on supplier.igstApplicable: IGST (single) vs SGST+CGST (split half each).
 * This suite covers BOTH supplier tax modes.
 *
 * What this tests:
 *   - Search contract
 *   - Create (SGST+CGST supplier) → re-GET → assert header + line fields + the
 *     split tax values round-trip and match the formula (base*gst/200 each half)
 *   - Create (IGST supplier) → assert single igstValue path round-trips
 *   - Header taxAmount/grandTotal == Σ line tax / subtotal+tax
 *   - Activity log: GET + POST a comment
 *   - Update + Delete (Draft-only)
 *
 * Payload sends `tax`; the response model exposes it as `taxAmount`.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { loadPoRefs, ensureIgstSupplier, buildGeneralPo, computeLine } from '../../helpers/po-seed.js';

let api;
let refs;
const createdPos = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  refs = await loadPoRefs(api);
});
test.afterAll(async () => {
  for (const id of createdPos) { try { await api.delete(`/purchase-orders/${id}`); } catch { /* gone */ } }
  await api.dispose();
});

async function createPo(supplier, opts) {
  const payload = buildGeneralPo(supplier, refs.item, refs.terms, opts);
  const res = await api.post('/purchase-orders', payload);
  if (res.data?.id) createdPos.push(res.data.id);
  return { res, payload };
}

test.describe('PO — API Search & Field Round-Trip', () => {
  test('Search returns a paginated PO page', async () => {
    const res = await api.get('/purchase-orders/search', { page: 0, size: 10 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(Array.isArray(res.data.content)).toBeTruthy();
  });

  test('Create (SGST+CGST supplier) persists header + line + split tax', async () => {
    const { res, payload } = await createPo(refs.localSupplier, { gst: 18, qty: 10, unitPrice: 100 });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const got = (await api.get(`/purchase-orders/${res.data.id}`)).data;

    // header
    expect(got.poNumber).toMatch(/^PO\//);
    expect(got.status).toBe('Draft');
    expect(got.poType).toBe('General');
    expect(got.supplierId).toBe(refs.localSupplier.id);
    expect(got.supplierName).toBe(refs.localSupplier.name);
    expect(got.remarks).toBe('E2E PO');
    expect(Number(got.subtotal)).toBeCloseTo(payload.subtotal, 2);     // 1000
    expect(Number(got.grandTotal)).toBeCloseTo(payload.grandTotal, 2); // 1180
    // split-mode header tax fields
    expect(Number(got.sgstValue)).toBeCloseTo(90, 2);                  // 1000*9% = 90
    expect(Number(got.cgstValue)).toBeCloseTo(90, 2);
    expect(got.igstValue == null || Number(got.igstValue) === 0).toBeTruthy();

    // line
    expect(got.lineItems).toHaveLength(1);
    const line = got.lineItems[0];
    expect(line.itemId).toBe(refs.item.id);
    expect(line.itemName).toBe(refs.item.name);
    expect(line.description).toBe(`${refs.item.name} — E2E`);
    expect(line.quantity).toBe(10);
    expect(line.unitPrice).toBe(100);
    expect(Number(line.cgst)).toBeCloseTo(9, 2);    // 18/2
    expect(Number(line.sgst)).toBeCloseTo(9, 2);
    expect(Number(line.cgstValue)).toBeCloseTo(90, 2);
    expect(Number(line.sgstValue)).toBeCloseTo(90, 2);
    expect(Number(line.taxValue)).toBeCloseTo(180, 2);
    expect(Number(line.totalAmount)).toBeCloseTo(1180, 2);
  });

  test('Create (IGST supplier) persists the single-IGST tax path', async () => {
    const igstSupplier = await ensureIgstSupplier(api);
    const { res } = await createPo(igstSupplier, { gst: 12, qty: 5, unitPrice: 200 });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const got = (await api.get(`/purchase-orders/${res.data.id}`)).data;
    const base = 5 * 200;                 // 1000
    const igst = base * 0.12;             // 120
    expect(Number(got.subtotal)).toBeCloseTo(base, 2);
    expect(Number(got.grandTotal)).toBeCloseTo(base + igst, 2);
    // header tax = grandTotal − subtotal for IGST (no header sgst/cgst/igstValue field)
    expect(Number(got.grandTotal) - Number(got.subtotal)).toBeCloseTo(igst, 2);
    expect(got.sgstValue == null || Number(got.sgstValue) === 0).toBeTruthy();
    expect(got.cgstValue == null || Number(got.cgstValue) === 0).toBeTruthy();

    // line-level IGST fields are preserved
    const line = got.lineItems[0];
    expect(Number(line.igst)).toBeCloseTo(12, 2);
    expect(Number(line.igstValue)).toBeCloseTo(igst, 2);
    expect(Number(line.totalAmount)).toBeCloseTo(base + igst, 2);
  });

  test('Header tax equals Σ line tax and grandTotal = subtotal + tax (multi-line)', async () => {
    const { res } = await createPo(refs.localSupplier, { gst: 5, qty: 4, unitPrice: 50, lines: 3 });
    const got = (await api.get(`/purchase-orders/${res.data.id}`)).data;
    const lineTaxSum = got.lineItems.reduce((a, l) => a + Number(l.taxValue), 0);
    const headerTax = Number(got.taxAmount ?? got.tax ?? (got.sgstValue || 0) + (got.cgstValue || 0) + (got.igstValue || 0));
    expect(headerTax).toBeCloseTo(lineTaxSum, 2);
    expect(Number(got.grandTotal)).toBeCloseTo(Number(got.subtotal) + headerTax, 2);
  });
});

test.describe('PO — Activity, Update & Delete', () => {
  test('Activity log: GET list and POST a comment', async () => {
    const { res } = await createPo(refs.localSupplier, {});
    const id = res.data.id;

    const before = await api.get(`/purchase-orders/${id}/activities`);
    expect(before.status).toBe(200);
    expect(Array.isArray(before.data)).toBeTruthy();

    const post = await api.post(`/purchase-orders/${id}/activities`, { comment: 'E2E review comment', status: 'Draft' });
    expect(post.status).toBeGreaterThanOrEqual(200);
    expect(post.status).toBeLessThan(300);

    const after = await api.get(`/purchase-orders/${id}/activities`);
    expect(after.data.length).toBeGreaterThan(before.data.length);
  });

  test('Update changes remarks + a line price and recomputes are persisted', async () => {
    const { res } = await createPo(refs.localSupplier, { gst: 18, qty: 10, unitPrice: 100 });
    const id = res.data.id;
    const got = (await api.get(`/purchase-orders/${id}`)).data;

    // change unit price to 150 and recompute the line + header (client-side, as the UI would)
    const newLine = computeLine(refs.item, 10, 150, 18, false);
    const upd = await api.post('/purchase-orders', {
      ...got, id, remarks: 'Edited PO',
      lineItems: [newLine],
      subtotal: 1500, tax: 270, sgstValue: 135, cgstValue: 135, igstValue: null, grandTotal: 1770,
    });
    expect(upd.status).toBeGreaterThanOrEqual(200);
    expect(upd.status).toBeLessThan(300);

    const after = (await api.get(`/purchase-orders/${id}`)).data;
    expect(after.remarks).toBe('Edited PO');
    expect(after.lineItems[0].unitPrice).toBe(150);
    expect(Number(after.grandTotal)).toBeCloseTo(1770, 2);
  });

  test('A Draft PO can be deleted', async () => {
    const { res } = await createPo(refs.localSupplier, {});
    const id = res.data.id;
    const del = await api.delete(`/purchase-orders/${id}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
    const get = await api.get(`/purchase-orders/${id}`);
    expect(get.status).not.toBe(200);
  });
});
