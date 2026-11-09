/**
 * Approval engine — the reject and refer-back paths no other spec took (2026-11-09):
 *  - a Cutting PO referred back, resubmitted and then rejected;
 *  - a Work Order rejected;
 *  - an order's refer-back request rejected (the order stays CONFIRMED);
 *  - a shipment refused to close while an order's latest final inspection is REJECTED, and allowed once a
 *    re-inspection is ACCEPTED.
 * Each flow is made for the test and retired after it, so the rest of the suite keeps its no-flow behaviour.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import { approvedCuttingPo, closeJobWorkGaps, orderOf, workOrderBody } from '../../helpers/job-work-api.js';
import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from '../../helpers/order-seed.js';
import { createEntry, purgeMarked, range } from '../../helpers/packing-api.js';

let api;
let director; // a second Super Admin: several listeners refuse self-approval

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};
const today = () => new Date().toISOString().slice(0, 10);

async function withFlow(entityType, body, { allowReferBack = false } = {}) {
  const { data: roles } = await api.get('/roles');
  const flow = ok(await api.post('/approval-flows', {
    name: `E2E ${entityType} reject ${Date.now()}`, entityType, active: true, priority: 60,
    levels: [{ levelNumber: 1, levelName: 'Single gate', approverType: 'ROLE',
      approverRoleId: roles.find((r) => r.name === 'Super Admin').id, allowReferBack, allowReject: true }],
  }), `create ${entityType} flow`);
  try {
    await body();
  } finally {
    const { data } = await api.get(`/approval-flows/${flow.id}`);
    if (data?.active) await api.patch(`/approval-flows/${flow.id}/toggle`);
  }
}

async function decide(entityType, id, action, comment) {
  const req = await findPendingRequest(api, entityType, id);
  expect(req, `${entityType} ${id} waits in the engine`).toBeTruthy();
  await actOnRequest(director || api, req.id, action, comment);
}

/** The order in full (orderOf answers the requirement screens' short form). */
const fullOrder = async (orderNo) => ok(await api.get(`/orders/${(await orderOf(api, orderNo)).id}`), `read ${orderNo}`);

/** One piece of each of the first two sizes of the order's first colour. */
async function rows(orderNo) {
  const order = await fullOrder(orderNo);
  const colour = order.orderLines[0].colorRows[0];
  return Object.keys(colour.quantities).slice(0, 2).map((size) => ({ color: colour.colorName, size, qty: 1 }));
}

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  director = await createAuthenticatedClient('e2e-director', 'Director@123').catch(() => null);
});
test.afterAll(async () => {
  await api.dispose();
  await director?.dispose();
});

test.describe.configure({ mode: 'serial' });

test.describe('Approval engine — reject and refer back', () => {
  test('a Cutting PO is referred back, resubmitted, then rejected', async () => {
    await withFlow('CUTTING_PO', async () => {
      const order = await orderOf(api, 'ORD/0003');
      const draft = ok(await api.post('/cutting-po', {
        orderId: order.id, orderNo: order.orderNo, styleNo: order.styleNo, buyer: order.buyer, processingUnitType: 'UNIT',
        processingUnitId: 1, allowancePercent: 0, plannedCutDate: today(), plannedDeliveryDate: today(),
        items: (await rows('ORD/0003')).map((r) => ({ color: r.color, size: r.size, orderQty: r.qty, plannedQty: r.qty,
          allowancePercent: 0, ratePerPiece: 10 })),
      }), 'create cutting PO');
      let po = ok(await api.post(`/cutting-po/${draft.id}/submit`, { version: draft.version }), 'submit');
      expect(po.status).toBe('PENDING_APPROVAL');

      await decide('CUTTING_PO', po.id, 'REFER_BACK', 'Planned cut date is too early for the fabric relaxation.');
      po = ok(await api.get(`/cutting-po/${po.id}`), 'read');
      expect(po.status).toBe('REFERRED_BACK');

      po = ok(await api.post(`/cutting-po/${po.id}/submit`, { version: po.version }), 'resubmit');
      expect(po.status).toBe('PENDING_APPROVAL');
      await decide('CUTTING_PO', po.id, 'REJECT', 'Order on hold with the buyer; do not cut.');
      expect(ok(await api.get(`/cutting-po/${po.id}`), 'read').status).toBe('REJECTED');
    }, { allowReferBack: true });
  });

  test('a Work Order is rejected', async () => {
    await closeJobWorkGaps(api, 'ORD/0003');
    const r = await rows('ORD/0003');
    const cut = await approvedCuttingPo(api, { orderNo: 'ORD/0003', rows: r });
    expect(cut.status).toBe('APPROVED');
    await withFlow('WORK_ORDER', async () => {
      const wo = ok(await api.post('/work-order', await workOrderBody(api, { orderNo: 'ORD/0003', cuttingPoId: cut.id, rows: r })), 'create WO');
      const submitted = ok(await api.post(`/work-order/${wo.id}/submit`, { version: wo.version }), 'submit WO');
      expect(submitted.status).toBe('PENDING_APPROVAL');
      await decide('WORK_ORDER', wo.id, 'REJECT', 'Line J1-1 is full this fortnight; plan it elsewhere.');
      expect(ok(await api.get(`/work-order/${wo.id}`), 'read WO').status).toBe('REJECTED');
    });
  });

  test("an order's refer-back request is rejected: the order stays CONFIRMED", async () => {
    await withFlow('ORDER', async () => {
      const costing = await seedApprovedCosting(api);
      const draft = ok(await api.post('/orders', buildOrderPayload(costing, await loadOrderRefs(api))), 'create order');
      ok(await api.put(`/orders/${draft.id}/status`, { status: 'CONFIRMED', version: draft.version }), 'confirm');
      const confirmed = ok(await api.get(`/orders/${draft.id}`), 'order');
      ok(await api.put(`/orders/${draft.id}/status`, { status: 'REFER_BACK_REQUESTED', version: confirmed.version,
        reason: 'Buyer revised the size ratio for the second delivery; please reopen the order.' }), 'request refer back');
      expect(ok(await api.get(`/orders/${draft.id}`), 'order').status).toBe('REFER_BACK_REQUESTED');
      await decide('ORDER', draft.id, 'REJECT', 'Ratio change comes as a new order line; keep this one.');
      const after = ok(await api.get(`/orders/${draft.id}`), 'order');
      expect(after.status).toBe('CONFIRMED');
      expect(after.referBackReason || null).toBeNull();
    });
  });

  test('a shipment does not close while the final inspection rejected a lot; a re-inspection releases it', async () => {
    const order = await fullOrder('ORD/0002');
    const colour = order.orderLines[0].colorRows[0].colorName;
    await purgeMarked(api, order.id);
    await createEntry(api, { orderId: order.id, groups: [range({ buyerPoNo: order.orderLines[0].buyerPoNo,
      destination: order.orderLines[0].destination, colorName: colour })] });
    const base = { orderId: order.id, color: colour, date: today(), labelChecks: {}, points: [], alterQty: 0 };
    // AQL 2.5 for a lot of 500: sample 50, accept 3 — five defects reject it
    const rejected = ok(await api.post('/finishing/checkings', { ...base, stage: 'FINAL', lotSize: 500, passQty: 45, rejectQty: 5,
      defects: [{ code: 'D-01', name: 'Open seam', count: 5 }] }), 'final AQL');
    expect(rejected.verdict).toBe('REJECTED');

    const { data: buyers } = await api.get('/buyers');
    const buyer = (Array.isArray(buyers) ? buyers : buyers.content).find((b) => b.id === order.buyerId);
    const port = async (code) => (await api.get('/ports', { search: code, kinds: 'SEA' })).data.find((p) => p.code === code).id;
    const shipment = ok(await api.post('/export-docs/shipments', {
      buyerId: buyer.id, notifyParty: { kind: 'LOCATION', locationId: buyer.shippingLocations[0].id }, orderIds: [order.id],
      mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', placeOfReceipt: 'Tiruppur', vesselFlightNo: 'MSC AQL GATE',
      portOfLoadingId: await port('INMAA1'), portOfDischargeId: await port('NLRTM'),
      finalDestination: 'Arteixo, Spain', countryOfFinalDestination: 'Spain', etd: today(), eta: today(),
      forwarder: 'Kuehne + Nagel', containerNos: ['AQLU1234567'],
    }), 'create shipment');
    try {
      const refused = await api.post(`/export-docs/shipments/${shipment.id}/close`);
      expect(refused.status).toBe(422);
      expect(refused.data.message).toContain(rejected.checkNo);

      ok(await api.post('/finishing/checkings', { ...base, stage: 'FINAL', lotSize: 500, passQty: 50, rejectQty: 0, defects: [] }), 're-inspection');
      expect(ok(await api.post(`/export-docs/shipments/${shipment.id}/close`), 'close').status).toBe('CLOSED');
    } finally {
      const now = ok(await api.get(`/export-docs/shipments/${shipment.id}`), 'shipment');
      const open = now.status === 'CLOSED' ? ok(await api.post(`/export-docs/shipments/${shipment.id}/reopen`), 'reopen') : now;
      await api.delete(`/export-docs/shipments/${shipment.id}?version=${open.version}`);
      await purgeMarked(api, order.id);
    }
  });
});
