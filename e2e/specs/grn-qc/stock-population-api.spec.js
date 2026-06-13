/**
 * Stock Population (Inventory) — the PO → GRN → QC → STOCK end of the chain.
 *
 * This is the piece the rest of the grn-qc suite did NOT cover: that approving a
 * QC actually MATERIALISES inventory stock rows (StockPopulationService).
 *
 * Flow per type:
 *   PO (Sent_To_Supplier) → submit GRN (→ QC_Pending) → submit QC (→ Pending_Approval)
 *   → approve QC (→ Approved, GRN → Closed) → stock row appears in
 *     GET /inventory/stock/{fabric|accessories} with the GRN number + received qty.
 *
 * Covers Fabric (rolls) and Accessories (cartons), plus a Conditional_Pass case.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findOrCreateTestPO, fabricGrnPayload, trimsGrnPayload, fabricQcPayload, trimsQcPayload,
  submitGrn, submitQc, getTrimsQCCriteria,
} from '../../helpers/grn-qc-data.js';

let api;
let trimsCriteria = [];

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  trimsCriteria = await getTrimsQCCriteria(api);
});
test.afterAll(async () => { await api.dispose(); });

const stamp = () => Date.now().toString().slice(-7);

// The stock list `search` param matches item code/description, NOT grnNumber, so
// fetch the page and filter by grnNumber in JS.
async function fabricStockRows() {
  const { data } = await api.get('/inventory/stock/fabric', { page: 0, size: 200 });
  return data?.content || [];
}
async function accessoriesStockRows() {
  const { data } = await api.get('/inventory/stock/accessories', { page: 0, size: 200 });
  return data?.content || [];
}

test.describe('Inventory — Stock Population from QC approval', () => {
  test('Fabric: PO → GRN → QC → APPROVE materialises a fabric stock row', async () => {
    const po = await findOrCreateTestPO(api, 'Fabric');
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();
    const s = stamp();
    const qty = Math.min(50, item.pendingQty);

    // 1) submit GRN with one roll
    const grn = await submitGrn(api, fabricGrnPayload(po, [item], {
      [item.id]: [{ rollNumber: `R-STK-${s}`, receivingQty: qty, shadeLot: `SL-${s}` }],
    }));
    expect(grn.status).toBe('QC_Pending');

    // 2) submit fabric QC, then 3) approve it
    const qc = await submitQc(api, fabricQcPayload(grn, item.id, { inspector: 'E2E Stock Inspector' }));
    const approved = await api.post(`/qc/${qc.id}/approve`, { reason: 'Stock-population check' });
    expect(approved.status).toBeGreaterThanOrEqual(200);
    expect(approved.status).toBeLessThan(300);

    // GRN closes on approval
    const { data: closedGrn } = await api.get(`/grns/${grn.id}`);
    expect(closedGrn.status).toBe('Closed');

    // 4) a fabric stock row now exists for this GRN, with the received qty
    const rows = await fabricStockRows();
    const mine = rows.filter((r) => r.grnNumber === grn.grnNumber);
    expect(mine.length).toBeGreaterThan(0);
    const totalQty = mine.reduce((a, r) => a + Number(r.totalQty ?? r.receivedQty ?? 0), 0);
    expect(totalQty).toBeCloseTo(qty, 1);
    // the roll we received is present
    const rollNumbers = mine.flatMap((r) => (r.rolls || []).map((x) => x.rollNumber));
    expect(rollNumbers).toContain(`R-STK-${s}`);
  });

  test('Accessories: PO → GRN → QC → APPROVE materialises an accessories stock row', async () => {
    const po = await findOrCreateTestPO(api, 'Trims');
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();
    const s = stamp();
    const qty = Math.min(100, item.pendingQty);

    // 1) submit Trims GRN with one carton
    const grnPayload = trimsGrnPayload(po, [item], { [item.id]: [{ cartonNumber: `CTN-STK-${s}`, quantity: qty }] });
    const pItem = (grnPayload.items || []).find((i) => i.poLineItemId === item.id);
    if (pItem) pItem.receivingQty = qty;
    const grn = await submitGrn(api, grnPayload);
    expect(grn.status).toBe('QC_Pending');

    // 2) submit accessories QC (all criteria OK, MATCHED), then 3) approve
    const criteriaRows = (trimsCriteria.length ? trimsCriteria : [{ id: 1, name: 'Visual' }]).map((c) => ({
      id: c.id, criteria: c.criteriaName || c.name, ok: true, notOk: false, remarks: '',
    }));
    const qc = await submitQc(api, trimsQcPayload(grn, item.id, criteriaRows, { inspector: 'E2E Stock Inspector', qtyVerdict: 'MATCHED' }));
    const approved = await api.post(`/qc/${qc.id}/approve`, { reason: 'Stock-population check' });
    expect(approved.status).toBeGreaterThanOrEqual(200);
    expect(approved.status).toBeLessThan(300);

    const { data: closedGrn } = await api.get(`/grns/${grn.id}`);
    expect(closedGrn.status).toBe('Closed');

    // 4) an accessories stock row now exists for this GRN with the received qty
    const rows = await accessoriesStockRows();
    const mine = rows.filter((r) => r.grnNumber === grn.grnNumber);
    expect(mine.length).toBeGreaterThan(0);
    const totalQty = mine.reduce((a, r) => a + Number(r.totalQty ?? r.availableQty ?? r.receivedQty ?? 0), 0);
    expect(totalQty).toBeCloseTo(qty, 1);
  });

  test('Conditional Pass: approving with conditionalPass tags the stock qcStatus', async () => {
    const po = await findOrCreateTestPO(api, 'Fabric');
    const item = po.items.find((i) => i.pendingQty > 0);
    expect(item).toBeDefined();
    const s = stamp();
    const qty = Math.min(30, item.pendingQty);

    const grn = await submitGrn(api, fabricGrnPayload(po, [item], {
      [item.id]: [{ rollNumber: `R-CP-${s}`, receivingQty: qty, shadeLot: `SL-${s}` }],
    }));
    const qc = await submitQc(api, fabricQcPayload(grn, item.id, { inspector: 'E2E CP Inspector' }));
    const approved = await api.post(`/qc/${qc.id}/approve`, { reason: 'Conditional', conditionalPass: true });
    expect(approved.status).toBeGreaterThanOrEqual(200);
    expect(approved.status).toBeLessThan(300);
    expect(approved.data.status).toBe('Conditional_Pass');

    const rows = await fabricStockRows();
    const mine = rows.filter((r) => r.grnNumber === grn.grnNumber);
    expect(mine.length).toBeGreaterThan(0);
  });
});
