/**
 * BOM — API CRUD & Field Round-Trip
 *
 * A BOM is built from a CONFIRMED order. Each line links an item (category/
 * subcategory/itemType/uom all resolved from itemId by the backend), parts,
 * a consumption mode, processes and per-process allowances. BOM quantities
 * (totalQty / purchaseQty) are CLIENT-computed and trusted by the backend
 * (no server recompute — unlike costing/orders), so the header totalPurchaseQty
 * is just the sum of the line purchaseQty values.
 *
 * What this tests:
 *   - Search contract
 *   - Create with a full fabric line → re-GET → assert every header + line field
 *     round-trips and FK display names resolve (categoryName/itemName/itemTypeName/uom)
 *   - Header totalPurchaseQty == Σ line.purchaseQty
 *   - Update (consumption + remarks)
 *   - Delete is Draft-only
 *
 * Status enum: DRAFT | CREATED.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder, loadBomRefs, buildBomPayload } from '../../helpers/bom-seed.js';

let api;
let refs;
const createdBoms = [];
const cleanup = []; // {orderId, costSheetId}

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

async function createBom(overrides) {
  const { order, costSheetId } = await seedConfirmedOrder(api);
  cleanup.push({ orderId: order.id, costSheetId });
  const payload = buildBomPayload(order, refs, overrides);
  const res = await api.post('/boms', payload);
  if (res.data?.id) createdBoms.push(res.data.id);
  return { res, payload, order };
}

test.describe('BOM — API Search & Field Round-Trip', () => {
  test('Search returns a BOM list/page', async () => {
    const res = await api.get('/boms', { page: 0, size: 10 });
    expect(res.status).toBe(200);
    const list = res.data.content || res.data;
    expect(Array.isArray(list)).toBeTruthy();
  });

  test('Create persists every header + line field (FK names resolve)', async () => {
    const { res, payload, order } = await createBom();
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const got = (await api.get(`/boms/${res.data.id}`)).data;

    // header
    expect(got.status).toBe('DRAFT');
    expect(got.orderId).toBe(order.id);
    expect(got.orderNo).toBe(order.orderNo);
    expect(got.styleId).toBe(order.styleId);
    expect(got.styleName).toBeTruthy();
    expect(got.buyerName).toBeTruthy();
    expect(got.orderQty).toBe(payload.orderQty);
    expect(got.remarks).toBe('E2E BOM');
    expect(got.lineCount).toBe(1);

    // line — FK resolution
    expect(got.lines).toHaveLength(1);
    const line = got.lines[0];
    const pLine = payload.lines[0];
    expect(line.itemId).toBe(pLine.itemId);
    expect(line.itemName).toBe(refs.item.name);              // resolved
    expect(line.categoryName).toBe('Fabric');                // resolved from item
    expect(line.subCategoryName).toBeTruthy();               // resolved
    expect(line.itemTypeName).toBeTruthy();                  // resolved
    expect(line.uom).toBeTruthy();                           // item-derived
    expect(line.partsName).toEqual(pLine.partsName);
    expect(line.consumptionPerGarment).toBe(pLine.consumptionPerGarment);
    expect(line.consumptionMode).toBe('SIMPLE');
    expect(line.qtyCalcBasis).toBe('TOTAL');
    expect(line.baseQty).toBe(pLine.baseQty);
    expect(line.totalQty).toBe(pLine.totalQty);
    expect(line.purchaseQty).toBe(pLine.purchaseQty);

    // processes + allowances
    expect(line.processes).toHaveLength(1);
    expect(line.processes[0].processName).toBe(refs.process.name);
    expect(line.processAllowances).toHaveLength(1);
    const pa = line.processAllowances[0];
    expect(pa.processId).toBe(refs.process.id);
    expect(pa.rejectionPercent).toBe(refs.process.rej);
    expect(pa.shipmentAllowancePercent).toBe(refs.process.ship);
  });

  test('Header totalPurchaseQty equals the sum of line purchase quantities', async () => {
    const { res } = await createBom();
    const got = (await api.get(`/boms/${res.data.id}`)).data;
    const sum = got.lines.reduce((a, l) => a + Number(l.purchaseQty), 0);
    expect(Number(got.totalPurchaseQty)).toBeCloseTo(sum, 2);
  });
});

test.describe('BOM — Update & Delete', () => {
  test('Update changes consumption + remarks and persists', async () => {
    const { res } = await createBom();
    const id = res.data.id;
    const got = (await api.get(`/boms/${id}`)).data;

    got.remarks = 'Edited remarks';
    got.lines[0].consumptionPerGarment = 2.0;
    got.lines[0].totalQty = 2.0 * got.orderQty;
    const upd = await api.put(`/boms/${id}`, got);
    expect(upd.status).toBeGreaterThanOrEqual(200);
    expect(upd.status).toBeLessThan(300);

    const after = (await api.get(`/boms/${id}`)).data;
    expect(after.remarks).toBe('Edited remarks');
    expect(after.lines[0].consumptionPerGarment).toBe(2.0);
  });

  test('A Draft BOM can be deleted', async () => {
    const { res } = await createBom();
    const id = res.data.id;
    const del = await api.delete(`/boms/${id}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
    const get = await api.get(`/boms/${id}`);
    expect(get.status).not.toBe(200);
  });
});
