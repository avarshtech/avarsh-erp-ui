/**
 * Branch hierarchy — stock is held per branch, and moving it needs a transfer.
 *
 * Each site has its own store: a lot belongs to a branch, the registers answer
 * for the working branch, an issue cannot pull a roll held somewhere else, and
 * the only way a roll crosses a branch is an inter-branch transfer that reduces
 * the source and creates a lot at the destination.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureBranch, headOffice, branchHeader } from '../../helpers/branch-seed.js';

let api;
let ho;
let second;

const rowsOf = (data) => (Array.isArray(data) ? data : data?.content || []);

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  ho = await headOffice(api);
  second = await ensureBranch(api, { branchCode: 'E2E-TIR', branchName: 'E2E Tirupur' });
});

test.afterAll(async () => { await api?.dispose(); });

test.describe('Inventory per branch', () => {

  test('seeded stock and GRNs belong to the head office', async () => {
    const { data: atHo } = await api.get('/inventory/stock/fabric', { size: '100' }, branchHeader(ho.id));
    const { data: atSecond } = await api.get('/inventory/stock/fabric', { size: '100' }, branchHeader(second.id));
    expect(rowsOf(atHo).length).toBeGreaterThan(0);
    expect(rowsOf(atHo).every((r) => r.branchId === ho.id)).toBe(true);
    expect(rowsOf(atSecond)).toHaveLength(0);

    const { data: grnsHo } = await api.get('/grns', { size: '100' }, branchHeader(ho.id));
    const { data: grnsSecond } = await api.get('/grns', { size: '100' }, branchHeader(second.id));
    expect(rowsOf(grnsHo).length).toBeGreaterThan(0);
    expect(rowsOf(grnsSecond)).toHaveLength(0);
  });

  test('the registers answer for the whole company when no branch is named', async () => {
    const { data: all } = await api.get('/inventory/stock/fabric', { size: '100' });
    const { data: atHo } = await api.get('/inventory/stock/fabric', { size: '100' }, branchHeader(ho.id));
    expect(rowsOf(all).length).toBeGreaterThanOrEqual(rowsOf(atHo).length);
  });

  test('a stock count sheet is of one store', async () => {
    const { data: items } = await api.get('/items/autocomplete', { q: 'FAB-SJ-001' });
    const item = rowsOf(items)[0];
    test.skip(!item?.categoryId, 'no fabric item in the seed');

    const { data: sheetHo } = await api.get('/stock-adjustments/adjustable-items', { categoryId: String(item.categoryId), branchId: String(ho.id) });
    const { data: sheetSecond } = await api.get('/stock-adjustments/adjustable-items', { categoryId: String(item.categoryId), branchId: String(second.id) });
    expect(rowsOf(sheetHo).length).toBeGreaterThan(0);
    expect(rowsOf(sheetSecond)).toHaveLength(0);
  });

  test('opening stock lands at the branch on the batch and the lot inherits it', async () => {
    const { data: items } = await api.get('/items/autocomplete', { q: 'FAB-SJ-001' });
    const item = rowsOf(items)[0];
    test.skip(!item?.id, 'no fabric item in the seed');
    const roll = `E2E-BR-${Date.now().toString().slice(-6)}`;

    const { data: batch, status } = await api.post('/opening-stock/batches', {
      batchType: 'FABRIC', referenceDate: new Date().toISOString().slice(0, 10),
      notes: 'e2e branch opening', branchId: second.id,
      fabricLines: [{ itemId: item.id, itemCode: item.itemCode, rollNumber: roll, quantity: 60, uomId: item.uomId, unitCost: 100 }],
    });
    expect(status).toBeLessThan(300);
    expect(batch.branchId).toBe(second.id);

    const { status: postStatus } = await api.post(`/opening-stock/batches/${batch.id}/post`, {});
    expect(postStatus).toBeLessThan(300);

    const { data: atSecond } = await api.get('/inventory/stock/fabric', { size: '100' }, branchHeader(second.id));
    const landed = rowsOf(atSecond).find((r) => (r.rolls || []).some((x) => x.rollNumber === roll));
    expect(landed).toBeTruthy();
    expect(landed.branchId).toBe(second.id);
  });

  test('a roll held at another branch cannot be issued to a cutting PO', async () => {
    const { data: cuttingPos } = await api.get('/material-issues/cutting-pos');
    const po = rowsOf(cuttingPos)[0];
    test.skip(!po, 'no approved cutting PO to issue against');

    const { data: rollsHere } = await api.get('/material-issues/issuable-rolls', { itemCode: 'FAB-SJ-001', branchId: String(po.branchId ?? ho.id) });
    const { data: rollsThere } = await api.get('/material-issues/issuable-rolls', { itemCode: 'FAB-SJ-001', branchId: String(second.id) });
    // the two stores answer with different rolls
    const here = rowsOf(rollsHere).map((r) => r.rollNumber);
    const there = rowsOf(rollsThere).map((r) => r.rollNumber);
    expect(here.some((r) => there.includes(r))).toBe(false);

    const foreign = rowsOf(rollsThere)[0];
    test.skip(!foreign, 'the second branch holds no roll of this item');
    const { status, data } = await api.post('/material-issues/fabric', {
      cuttingPoId: po.id, itemId: foreign.itemId, itemCode: 'FAB-SJ-001',
      receivedBy: 'e2e', issueDate: new Date().toISOString().slice(0, 10),
      rolls: [{ fabricStockId: foreign.fabricStockId ?? foreign.rollId ?? foreign.id, issuedQty: 1 }],
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(data)).toMatch(/another branch/i);
  });
});

test.describe('Inter-branch stock transfer', () => {

  test('draft, dispatch and receive moves a roll between branches', async () => {
    const { data: items } = await api.get('/items/autocomplete', { q: 'FAB-SJ-001' });
    const item = rowsOf(items)[0];
    test.skip(!item?.categoryId, 'no fabric item in the seed');

    const { data: sheet } = await api.get('/stock-transfers/transferable-items', { categoryId: String(item.categoryId), branchId: String(ho.id) });
    const roll = rowsOf(sheet).find((r) => r.fabricStockId && Number(r.inStockQty) > 1);
    test.skip(!roll, 'the head office holds no fabric roll to transfer');
    const before = Number(roll.inStockQty);
    const moveQty = Math.max(1, Math.floor(before / 4));

    const { data: draft, status } = await api.post('/stock-transfers', {
      toBranchId: second.id, challanNo: 'E2E-DC-1', transporter: 'E2E Transport',
      lines: [{ lineType: 'FABRIC', fabricStockId: roll.fabricStockId, qty: moveQty }],
    }, branchHeader(ho.id));
    expect(status).toBe(201);
    expect(draft.status).toBe('DRAFT');
    expect(draft.fromBranchId).toBe(ho.id);
    expect(draft.toBranchId).toBe(second.id);

    // a roll already on an open transfer cannot go on a second one
    const { status: dupStatus } = await api.post('/stock-transfers', {
      fromBranchId: ho.id, toBranchId: second.id,
      lines: [{ lineType: 'FABRIC', fabricStockId: roll.fabricStockId, qty: 1 }],
    });
    expect(dupStatus).toBe(409);

    // receiving before dispatch is refused
    const { status: earlyStatus } = await api.post(`/stock-transfers/${draft.id}/receive`, {});
    expect(earlyStatus).toBe(409);

    const { data: dispatched } = await api.post(`/stock-transfers/${draft.id}/dispatch`, {});
    expect(dispatched.status).toBe('DISPATCHED');

    const { data: afterDispatch } = await api.get('/stock-transfers/transferable-items', { categoryId: String(item.categoryId), branchId: String(ho.id) });
    const shrunk = rowsOf(afterDispatch).find((r) => r.fabricStockId === roll.fabricStockId);
    expect(Number(shrunk?.inStockQty ?? 0)).toBe(before - moveQty);

    const { data: received } = await api.post(`/stock-transfers/${draft.id}/receive`, {});
    expect(received.status).toBe('RECEIVED');
    expect(received.lines[0].receivedFabricStockId).toBeTruthy();

    const { data: atSecond } = await api.get('/inventory/stock/fabric', { size: '100' }, branchHeader(second.id));
    const landed = rowsOf(atSecond).find((r) => r.sourceType === 'TRANSFER');
    expect(landed).toBeTruthy();
    expect(landed.branchId).toBe(second.id);

    // a received transfer is never cancelled — raise one back instead
    const { status: cancelStatus } = await api.post(`/stock-transfers/${draft.id}/cancel`, { reason: 'e2e' });
    expect(cancelStatus).toBe(409);
  });

  test('cancelling a dispatched transfer puts the stock back', async () => {
    const { data: items } = await api.get('/items/autocomplete', { q: 'FAB-SJ-001' });
    const item = rowsOf(items)[0];
    const { data: sheet } = await api.get('/stock-transfers/transferable-items', { categoryId: String(item.categoryId), branchId: String(ho.id) });
    const roll = rowsOf(sheet).find((r) => r.fabricStockId && Number(r.inStockQty) > 1);
    test.skip(!roll, 'the head office holds no fabric roll to transfer');
    const before = Number(roll.inStockQty);

    const { data: draft } = await api.post('/stock-transfers', {
      fromBranchId: ho.id, toBranchId: second.id,
      lines: [{ lineType: 'FABRIC', fabricStockId: roll.fabricStockId, qty: 1 }],
    });
    await api.post(`/stock-transfers/${draft.id}/dispatch`, {});
    const { data: cancelled } = await api.post(`/stock-transfers/${draft.id}/cancel`, { reason: 'lorry turned back' });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('lorry turned back');

    const { data: after } = await api.get('/stock-transfers/transferable-items', { categoryId: String(item.categoryId), branchId: String(ho.id) });
    const restored = rowsOf(after).find((r) => r.fabricStockId === roll.fabricStockId);
    expect(Number(restored?.inStockQty ?? 0)).toBe(before);
  });

  test('a transfer is visible from both of its branches, and nowhere else', async () => {
    const third = await ensureBranch(api, { branchCode: 'E2E-ERD', branchName: 'E2E Erode' });
    const { data: fromHo } = await api.get('/stock-transfers', { size: '100' }, branchHeader(ho.id));
    const { data: fromSecond } = await api.get('/stock-transfers', { size: '100' }, branchHeader(second.id));
    const { data: fromThird } = await api.get('/stock-transfers', { size: '100' }, branchHeader(third.id));

    expect(rowsOf(fromHo).length).toBeGreaterThan(0);
    expect(rowsOf(fromSecond).length).toBeGreaterThan(0);
    expect(rowsOf(fromThird)).toHaveLength(0);
  });

  test('a transfer between the same branch is refused', async () => {
    const { status } = await api.post('/stock-transfers', {
      fromBranchId: ho.id, toBranchId: ho.id,
      lines: [{ lineType: 'FABRIC', fabricStockId: 1, qty: 1 }],
    });
    expect(status).toBe(400);
  });
});
