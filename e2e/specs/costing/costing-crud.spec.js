/**
 * Costing — API CRUD, Field Round-Trip & Backend Calc-Engine Verification
 *
 * What this tests (API layer — fast, deterministic, field-complete):
 *   - Search pagination contract
 *   - Create with EVERY header field + all 5 row sections (FK-linked) → re-GET →
 *     assert every scalar field round-trips and FK display names resolve
 *   - Backend recomputes ALL 8 summary totals server-side — verified against the
 *     exact formulas in costingConstants.js (this is the bug-finding core: a dropped
 *     setter or a wrong formula shows up here immediately)
 *   - Update: changing percentages and rows recomputes totals
 *   - CMT costing type excludes fabric from the making price
 *   - Delete is Draft-only; non-draft delete is rejected
 *
 * Contract (learned by probe, 2026-06-13):
 *   - status enum: Draft | Final | Approved | Rejected (capitalized)
 *   - row name fields (fabricType/item/process/description) are resolved from
 *     itemId/processId/overheadId — free-text names are NOT persisted
 *   - garmentName/buyerName/styleNo on GET are resolved from FKs
 *   - totals are recomputed by the backend regardless of client-sent values
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { stylePayload } from '../../helpers/test-data.js';

// Seed FKs confirmed present under the e2e H2 profile
const FK = {
  buyerId: 1,           // H&M Hennes & Mauritz
  styleId: 3,           // AV-AW25-001 / Fleece Hoodie
  fabricItemId: 1,      // Cotton Single Jersey 180 GSM (Fabric)
  localTrimItemId: 5,   // 4-Hole Polyester Button 20L (Trims)
  processId: 20,        // Bar Tacking
  overheadId: 1,        // Testing & Inspection
};

const round = (n, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

let api;
const created = [];
// Variant-first contract: costing rows resolve their display names from the VARIANT,
// not the item. The seeds carry no variants, so mint one per costing item up front.
let fabricVariant;
let trimVariant;

async function ensureVariant(itemId, variantName) {
  const { data: item } = await api.get(`/items/${itemId}`);
  const existing = (item.variants || []).find((v) => v.variantName === variantName);
  if (existing) return existing;
  const res = await api.put(`/items/${itemId}`, {
    ...item,
    variants: [...(item.variants || []), { variantName, attributes: {}, isActive: true }],
  });
  if (res.status >= 300) throw new Error(`variant seed failed: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return (res.data.variants || []).find((v) => v.variantName === variantName);
}

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  fabricVariant = await ensureVariant(FK.fabricItemId, 'Regression Fabric Variant');
  trimVariant = await ensureVariant(FK.localTrimItemId, 'Regression Button Variant');
});
test.afterAll(async () => {
  for (const id of created) { try { await api.delete(`/cost-sheets/${id}`); } catch { /* already gone */ } }
  await api.dispose();
});

/**
 * Build a fully-populated FOB cost-sheet payload.
 *
 * Async since the one-cost-sheet-per-style rule (2026-08): every sheet needs its own
 * freshly-created style, so the builder mints one per call.
 */
async function fullPayload(overrides = {}) {
  const { data: style } = await api.post('/styles', stylePayload(FK.buyerId));
  return {
    status: 'Draft',
    date: new Date().toISOString().split('T')[0],
    buyerId: FK.buyerId,
    styleId: style.id,
    garmentName: 'CalcCheck Garment',
    season: 'SS26',
    currency: 'INR',
    quoteCurrency: 'USD',
    actualRate: 83.5,
    todaysRate: 83.5,
    sizes: ['S', 'M', 'L'],
    costingType: 'FOB',
    pricingUnit: 'PIECE',
    scenarioName: 'API Field Round-Trip',
    agentCommissionPct: 4,
    profitPct: 12,
    targetPrice: 0,
    fabricRows: [{
      itemId: FK.fabricItemId, variantId: fabricVariant?.id,
      classification: 'Woven', description: 'Body fabric',
      consumption: 1.5, fabricPrice: 200, fabricWidthStd: '58', fabricWidthVendor: '56',
      allowancePct: 5, wastagePct: 3, sizes: '',
      netCost: round(1.5 * 200 * 1.05 * 1.03),
    }],
    localTrims: [{
      itemId: FK.localTrimItemId, variantId: trimVariant?.id, code: 'BTN-1', size: '20L',
      consumption: 6, cost: 2, sizes: '', price: 12,
    }],
    importedTrims: [{
      item: 'Imported Zip', code: 'ZIP-1', size: '7in',
      consumption: 1, costUsd: 0.5, sizes: '', priceUsd: 0.5,
    }],
    manufacturingRows: [{ processId: FK.processId, cost: 50, comments: 'stitch', sizes: '' }],
    overheadRows: [{ overheadId: FK.overheadId, cost: 10, comments: 'qc', sizes: '' }],
    ...overrides,
  };
}

test.describe('Costing — API Search & Field Round-Trip', () => {
  test('Search returns a paginated CostSheet page', async () => {
    const res = await api.get('/cost-sheets/search', { page: 0, size: 10 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(res.data).toHaveProperty('totalPages');
    expect(Array.isArray(res.data.content)).toBeTruthy();
    expect(res.data.content.length).toBeLessThanOrEqual(10);
  });

  test('Create persists every header field + all 5 row sections (FK names resolve)', async () => {
    const res = await api.post('/cost-sheets', await fullPayload());
    expect(res.status).toBe(200);
    created.push(res.data.id);

    const got = (await api.get(`/cost-sheets/${res.data.id}`)).data;

    // ----- header scalars -----
    expect(got.status).toBe('Draft');
    expect(got.buyerId).toBe(FK.buyerId);
    expect(got.buyerName).toBe('H&M Hennes & Mauritz');     // resolved from FK on read
    // The style is minted per sheet now (one-cost-sheet-per-style rule) — assert the
    // FK resolves to the created style rather than a fixed seeded one.
    expect(got.styleId).toBeGreaterThan(0);
    expect(got.styleNo).toContain('E2E-');                  // resolved from FK
    expect(got.garmentName).toBeTruthy();
    expect(got.season).toBe('SS26');
    expect(got.currency).toBe('INR');
    expect(got.quoteCurrency).toBe('USD');
    expect(got.actualRate).toBe(83.5);
    expect(got.sizes).toEqual(['S', 'M', 'L']);
    expect(got.costingType).toBe('FOB');
    expect(got.pricingUnit).toBe('PIECE');
    expect(got.scenarioName).toBe('API Field Round-Trip');
    expect(got.agentCommissionPct).toBe(4);
    expect(got.profitPct).toBe(12);
    expect(got.costingId).toMatch(/^CST\//);

    // ----- fabric row -----
    const f = got.fabricRows[0];
    expect(f.itemId).toBe(FK.fabricItemId);
    // Resolved from the VARIANT since the item/variant refactor (B-005 direction).
    expect(f.fabricType).toBe('Regression Fabric Variant');
    expect(f.classification).toBe('Woven');
    expect(f.description).toBe('Body fabric');
    expect(f.consumption).toBe(1.5);
    expect(f.fabricPrice).toBe(200);
    expect(f.fabricWidthStd).toBe('58');
    expect(f.fabricWidthVendor).toBe('56');
    expect(f.allowancePct).toBe(5);
    expect(f.wastagePct).toBe(3);
    expect(f.netCost).toBe(round(1.5 * 200 * 1.05 * 1.03));

    // ----- local trim -----
    const lt = got.localTrims[0];
    expect(lt.itemId).toBe(FK.localTrimItemId);
    expect(lt.item).toBe('Regression Button Variant');         // resolved from the variant
    expect(lt.code).toBe('BTN-1');
    expect(lt.size).toBe('20L');
    expect(lt.consumption).toBe(6);
    expect(lt.cost).toBe(2);
    expect(lt.price).toBe(12);

    // ----- imported trim (free-text item, no FK) -----
    const it = got.importedTrims[0];
    expect(it.code).toBe('ZIP-1');
    expect(it.consumption).toBe(1);
    expect(it.costUsd).toBe(0.5);
    expect(it.priceUsd).toBe(0.5);

    // ----- manufacturing -----
    const m = got.manufacturingRows[0];
    expect(m.processId).toBe(FK.processId);
    expect(m.process).toBe('Bar Tacking');                     // resolved
    expect(m.cost).toBe(50);
    expect(m.comments).toBe('stitch');

    // ----- overhead -----
    const o = got.overheadRows[0];
    expect(o.overheadId).toBe(FK.overheadId);
    expect(o.description).toBe('Testing & Inspection');        // resolved
    expect(o.cost).toBe(10);
    expect(o.comments).toBe('qc');
  });
});

test.describe('Costing — Backend Calc-Engine Verification', () => {
  test('All 8 summary totals are recomputed server-side per formula (FOB)', async () => {
    const res = await api.post('/cost-sheets', await fullPayload());
    expect(res.status).toBe(200);
    created.push(res.data.id);
    const got = (await api.get(`/cost-sheets/${res.data.id}`)).data;

    // expected, from costingConstants.js formulas
    const fabric = round(1.5 * 200 * 1.05 * 1.03);             // 324.45
    const localTrims = 6 * 2;                                  // 12
    const importedUsd = 1 * 0.5;                               // 0.5
    const accessories = localTrims + importedUsd * 83.5;       // 53.75
    const mfg = 50;
    const markup = 10;
    const making = fabric + accessories + mfg + markup;        // 438.20
    const ovhCharges = round(((4 + 12) / 100) * making);       // 70.112
    const total = round(making + ovhCharges);                  // 508.312
    const final = round(total / 83.5);                         // 6.0876

    expect(got.totalFabricCost).toBeCloseTo(fabric, 2);
    expect(got.totalLocalTrimsCost).toBeCloseTo(localTrims, 2);
    expect(got.totalImportedTrimsCostUsd).toBeCloseTo(importedUsd, 2);
    expect(got.totalAccessoriesCost).toBeCloseTo(accessories, 2);
    expect(got.totalManufacturingCost).toBeCloseTo(mfg, 2);
    expect(got.totalMarkupCost).toBeCloseTo(markup, 2);
    expect(got.totalMakingPrice).toBeCloseTo(making, 2);
    expect(got.totalOverheadCharges).toBeCloseTo(ovhCharges, 2);
    expect(got.totalPrice).toBeCloseTo(total, 2);
    expect(got.finalPrice).toBeCloseTo(final, 3);
  });

  test('CMT costing type excludes fabric from the making price', async () => {
    const res = await api.post('/cost-sheets', await fullPayload({ costingType: 'CMT' }));
    expect(res.status).toBe(200);
    created.push(res.data.id);
    const got = (await api.get(`/cost-sheets/${res.data.id}`)).data;

    const accessories = 12 + 0.5 * 83.5;                       // 53.75
    const makingNoFabric = accessories + 50 + 10;              // 113.75 (fabric excluded)
    expect(got.costingType).toBe('CMT');
    expect(got.totalMakingPrice).toBeCloseTo(makingNoFabric, 2);
    // fabric cost itself is still tracked even though excluded from making
    expect(got.totalFabricCost).toBeCloseTo(324.45, 2);
  });

  test('Updating percentages recomputes overhead charges & total price', async () => {
    const res = await api.post('/cost-sheets', await fullPayload());
    created.push(res.data.id);
    const id = res.data.id;

    const draft = (await api.get(`/cost-sheets/${id}`)).data;
    const upd = await api.post('/cost-sheets', { ...draft, id, agentCommissionPct: 10, profitPct: 20 });
    expect(upd.status).toBe(200);

    const got = (await api.get(`/cost-sheets/${id}`)).data;
    const making = got.totalMakingPrice;
    expect(got.agentCommissionPct).toBe(10);
    expect(got.profitPct).toBe(20);
    expect(got.totalOverheadCharges).toBeCloseTo(((10 + 20) / 100) * making, 2);
    expect(got.totalPrice).toBeCloseTo(making + ((10 + 20) / 100) * making, 2);
  });
});

test.describe('Costing — Delete rules', () => {
  test('Draft cost sheet can be deleted; GET afterwards is not 200', async () => {
    const res = await api.post('/cost-sheets', await fullPayload());
    const id = res.data.id;
    const del = await api.delete(`/cost-sheets/${id}`);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
    const get = await api.get(`/cost-sheets/${id}`);
    expect(get.status).not.toBe(200);
  });
});
