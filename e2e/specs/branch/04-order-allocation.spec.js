/**
 * Branch hierarchy — splitting an order across branches, and what production
 * does with that split.
 *
 * The headline requirement: one confirmed order can be worked in two branches
 * in parallel. The split is held per order and branch, guarded by a lock on the
 * order row, and a production PO raised against a share is made at that share's
 * branch.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureBranch, headOffice, eligibleOrder, branchHeader } from '../../helpers/branch-seed.js';

let api;
let ho;
let second;
let order;
let hoUnit;

const iso = (d) => d.toISOString().slice(0, 10);

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  ho = await headOffice(api);
  second = await ensureBranch(api, { branchCode: 'E2E-TIR', branchName: 'E2E Tirupur' });
  order = await eligibleOrder(api);
  const { data: units } = await api.get('/factories/active', { branchId: String(ho.id) });
  hoUnit = units[0];
});

test.afterAll(async () => { await api?.dispose(); });

test.describe('Order allocation across branches', () => {

  test('a confirmed order is allocated whole to one branch by default', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data, status } = await api.get(`/orders/${order.id}/allocations`);
    expect(status).toBe(200);
    expect(data.totalOrderQty).toBeGreaterThan(0);
    expect(data.allocatedQty).toBe(data.totalOrderQty);
    expect(data.unallocatedQty).toBe(0);
    expect(data.rows.length).toBeGreaterThan(0);
  });

  test('split the order across two branches', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: view } = await api.get(`/orders/${order.id}/allocations`);
    const total = view.totalOrderQty;
    const share = Math.max(1, Math.floor(total / 4));

    const { data, status } = await api.put(`/orders/${order.id}/allocations`, {
      rows: [
        { branchId: ho.id, unitId: hoUnit?.id ?? null, qty: total - share },
        { branchId: second.id, qty: share },
      ],
    });
    expect(status).toBe(200);
    expect(data.unallocatedQty).toBe(0);
    expect(data.rows).toHaveLength(2);
    expect(data.rows.find((r) => r.branchId === second.id).qty).toBe(share);
    // the rows carry the names the screen prints
    expect(data.rows.find((r) => r.branchId === second.id).branchName).toBe('E2E Tirupur');
  });

  test('allocating more than the order quantity is refused', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: view } = await api.get(`/orders/${order.id}/allocations`);
    const { status, data } = await api.put(`/orders/${order.id}/allocations`, {
      rows: [{ branchId: ho.id, qty: view.totalOrderQty + 1 }],
    });
    expect(status).toBe(409);
    expect(JSON.stringify(data)).toMatch(/allocat|exceed|order qty|quantity/i);
  });

  test('the same branch twice is refused', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { status } = await api.put(`/orders/${order.id}/allocations`, {
      rows: [{ branchId: ho.id, qty: 1 }, { branchId: ho.id, qty: 1 }],
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('a unit that belongs to another branch is refused', async () => {
    test.skip(!order || !hoUnit, 'no CONFIRMED order or no unit in the seed');
    const { data: view } = await api.get(`/orders/${order.id}/allocations`);
    const { status, data } = await api.put(`/orders/${order.id}/allocations`, {
      rows: [{ branchId: second.id, unitId: hoUnit.id, qty: view.totalOrderQty }],
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(data)).toMatch(/unit|branch/i);
  });

  test('the order list can be filtered to a branch', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: view } = await api.get(`/orders/${order.id}/allocations`);
    const total = view.totalOrderQty;
    const share = Math.max(1, Math.floor(total / 4));
    await api.put(`/orders/${order.id}/allocations`, {
      rows: [{ branchId: ho.id, qty: total - share }, { branchId: second.id, qty: share }],
    });

    const { data: atSecond } = await api.get('/orders', { size: '100' }, branchHeader(second.id));
    expect((atSecond.content || []).some((o) => o.id === order.id)).toBe(true);

    const third = await ensureBranch(api, { branchCode: 'E2E-ERD', branchName: 'E2E Erode' });
    const { data: atThird } = await api.get('/orders', { size: '100' }, branchHeader(third.id));
    expect((atThird.content || []).some((o) => o.id === order.id)).toBe(false);
  });

  test('a cutting PO raised against a share is made at that share\'s branch', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: view } = await api.get(`/orders/${order.id}/allocations`);
    const row = view.rows.find((r) => r.branchId === second.id);
    test.skip(!row, 'the order is not split to the second branch');

    const { data: units } = await api.get('/factories/active');
    const items = (order.items || []).map((i) => ({
      color: i.color, size: i.size, orderQty: i.orderQty,
      allowancePercent: i.allowancePercent ?? 0, plannedQty: i.plannedQty ?? i.orderQty, ratePerPiece: 1,
    }));
    const sum = (f) => items.reduce((s, i) => s + (i[f] || 0), 0);
    const today = new Date();

    const { data: po, status } = await api.post('/cutting-po', {
      orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
      buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
      processingUnitType: 'UNIT', processingUnitId: units[0].id, processingUnitName: units[0].factoryName,
      plannedCutDate: iso(today), plannedDeliveryDate: iso(new Date(today.getTime() + 10 * 864e5)),
      totalOrderQty: sum('orderQty'), allowancePercent: 0, totalPlannedQty: sum('plannedQty'),
      items, remarks: 'e2e branch allocation', orderAllocationId: row.id,
    // a bogus working branch must not win over the allocation
    }, branchHeader(999999));

    expect(status).toBeLessThan(300);
    expect(po.branchId).toBe(second.id);
    expect(po.orderAllocationId).toBe(row.id);

    // and the share it was raised against can no longer be dropped from the split
    const { status: dropStatus, data: dropBody } = await api.put(`/orders/${order.id}/allocations`, {
      rows: [{ branchId: ho.id, qty: view.totalOrderQty }],
    });
    expect(dropStatus).toBe(409);
    expect(JSON.stringify(dropBody)).toMatch(/cutting|production|branch/i);
  });

  test('a production PO with no allocation falls back to the working branch', async () => {
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: units } = await api.get('/factories/active');
    const items = (order.items || []).map((i) => ({
      color: i.color, size: i.size, orderQty: i.orderQty,
      allowancePercent: i.allowancePercent ?? 0, plannedQty: i.plannedQty ?? i.orderQty, ratePerPiece: 1,
    }));
    const sum = (f) => items.reduce((s, i) => s + (i[f] || 0), 0);
    const today = new Date();
    const payload = {
      orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
      buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
      processingUnitType: 'UNIT', processingUnitId: units[0].id, processingUnitName: units[0].factoryName,
      plannedCutDate: iso(today), plannedDeliveryDate: iso(new Date(today.getTime() + 10 * 864e5)),
      totalOrderQty: sum('orderQty'), allowancePercent: 0, totalPlannedQty: sum('plannedQty'),
      items, remarks: 'e2e working branch',
    };

    const { data: atSecond } = await api.post('/cutting-po', payload, branchHeader(second.id));
    expect(atSecond.branchId).toBe(second.id);

    const { data: noHeader } = await api.post('/cutting-po', payload);
    expect(noHeader.branchId).toBe(ho.id);
  });
});
