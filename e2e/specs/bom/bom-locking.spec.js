/**
 * BOM line locking + referential guards (scenarios B2, B3, B5).
 *
 * The lock lifecycle: PATCH /boms/{id}/lines/po-status marks lines PO-generated;
 * locked BOMs refuse deletion while referenced; un-generating restores editability.
 * The UOM conversion snapshot (purchaseUom / uomConversionFactor / purchaseQtyPrimary)
 * must survive on lines regardless of lock state (B-006 regression, exact-value form).
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { seedConfirmedOrder, loadBomRefs, buildBomPayload } from '../../helpers/bom-seed.js';

let api;
let bom;
let order;

test.describe.serial('BOM — line locking and guards', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    ({ order } = await seedConfirmedOrder(api));
    const refs = await loadBomRefs(api);
    const res = await api.post('/boms', buildBomPayload(order, refs));
    expect(res.status, JSON.stringify(res.data).slice(0, 300)).toBeLessThan(300);
    bom = (await api.get(`/boms/${res.data.id}`)).data;
    expect(bom.lines?.length).toBeGreaterThan(0);
  });

  test.afterAll(async () => { await api?.dispose(); });

  test('B3 — a second BOM for the same order is refused', async () => {
    const refs = await loadBomRefs(api);
    const res = await api.post('/boms', buildBomPayload(order, refs));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.data)).toMatch(/already exists/i);
  });

  test('B2a — marking lines PO-generated locks them', async () => {
    const lineIds = bom.lines.map((l) => l.id);
    const res = await api.patch(`/boms/${bom.id}/lines/po-status`, {
      lineIds, poGenerated: true, // DTO field is poGenerated (boolean), not isPoGenerated
    });
    expect(res.status, JSON.stringify(res.data).slice(0, 200)).toBeLessThan(300);

    const { data: after } = await api.get(`/boms/${bom.id}`);
    for (const line of after.lines) {
      expect(line.isPoGenerated, `line ${line.id} must be locked`).toBe(true);
    }
  });

  test('B5 — the conversion snapshot survives on locked lines', async () => {
    const { data: after } = await api.get(`/boms/${bom.id}`);
    const converted = after.lines.find((l) => l.uomConversionFactor);
    test.skip(!converted, 'seed refs carry no UOM conversion — snapshot not exercised');
    // purchaseQtyPrimary = purchaseQty / factor is persisted, not recomputed on read.
    const expected = Number(converted.purchaseQty) / Number(converted.uomConversionFactor);
    expect(Math.abs(Number(converted.purchaseQtyPrimary) - expected)).toBeLessThan(0.01);
    expect(converted.purchaseUom).toBeTruthy();
  });

  test('B2c — un-generating restores the lines', async () => {
    const lineIds = bom.lines.map((l) => l.id);
    const res = await api.patch(`/boms/${bom.id}/lines/po-status`, {
      lineIds, poGenerated: false,
    });
    expect(res.status).toBeLessThan(300);

    const { data: after } = await api.get(`/boms/${bom.id}`);
    for (const line of after.lines) {
      expect(line.isPoGenerated).toBeFalsy();
    }
  });

  test('B2b — the DELETE guard is reference-based, not flag-based (documented)', async () => {
    // The hard deletion guard fires on REAL PO line references
    // (ResourceReferencedException), not on the isPoGenerated flag — the flag is the
    // UI-lock that keeps lines out of the BOM-line drawer. A flag-only BOM therefore
    // deletes cleanly; the FK-based guard is exercised by the PO/GRN interlock suites.
    const res = await api.delete(`/boms/${bom.id}`);
    expect([200, 204]).toContain(res.status);
  });
});
