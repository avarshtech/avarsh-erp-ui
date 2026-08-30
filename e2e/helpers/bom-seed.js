/**
 * BOM seed helpers — a BOM is built from a CONFIRMED order.
 * seedConfirmedOrder creates costing → order → confirms it.
 * loadBomRefs gathers an item (+ its type/uom), a process (+ defaults), and a part.
 * buildBomPayload assembles a one-line fabric BOM (SIMPLE consumption mode).
 */

import { seedApprovedCosting, loadOrderRefs, buildOrderPayload } from './order-seed.js';

/** Create a costing → order → confirm it. Returns the confirmed order + costSheetId. */
export async function seedConfirmedOrder(api) {
  const refs = await loadOrderRefs(api);
  const costing = await seedApprovedCosting(api);
  const ord = await api.post('/orders', buildOrderPayload(costing, refs));
  const order = ord.data;
  await api.put(`/orders/${order.id}/status`, { status: 'CONFIRMED', version: order.version });
  const confirmed = (await api.get(`/orders/${order.id}`)).data;
  return { order: confirmed, costSheetId: costing.costSheetId };
}

/** Gather the FKs a BOM line needs: a fabric item, a process (+defaults), a part. */
export async function loadBomRefs(api) {
  const items = (await api.get('/items', { search: 'Cotton', size: 5 })).data;
  const item = (items.content || items)[0];
  const procs = (await api.get('/processes/active')).data || [];
  const process = (procs.content || procs)[0];
  const parts = (await api.get('/parts/active')).data || [];
  const part = (parts.content || parts)[0];
  return {
    item: { id: item.id, name: item.name ?? item.itemName, itemTypeId: item.itemTypeId, uom: item.uomName },
    process: {
      id: process.id, name: process.name ?? process.processName,
      loss: process.defaultProcessLossPercent ?? 0,
      rej: process.defaultRejectionPercent ?? 0,
      ship: process.defaultShipmentAllowancePercent ?? 0,
    },
    partName: part.partName ?? part.name ?? 'Body',
  };
}

/** Compute the BOM purchase qty the way the UI does (calcPurchaseQty). */
export function calcPurchaseQty(totalQty, lossPct, rejPct, shipPct) {
  return totalQty + totalQty * (lossPct / 100) + totalQty * ((rejPct + shipPct) / 100);
}

/** Build a one-line SIMPLE fabric BOM payload from a confirmed order + refs. */
export function buildBomPayload(order, refs, overrides = {}) {
  const orderQty = order.totalOrderQty || 100;
  const consumption = 1.5;
  const totalQty = consumption * orderQty;
  const purchaseQty = calcPurchaseQty(totalQty, refs.process.loss, refs.process.rej, refs.process.ship);
  return {
    styleId: order.styleId, orderId: order.id, orderNo: order.orderNo,
    orderQty, status: 'DRAFT', remarks: 'E2E BOM',
    lines: [{
      itemId: refs.item.id, itemName: refs.item.name, itemTypeId: refs.item.itemTypeId, uom: refs.item.uom,
      partsName: [refs.partName],
      consumptionPerGarment: consumption, consumptionMode: 'SIMPLE',
      consumptionMatrix: null, variantMapping: null, qtyCalcBasis: 'TOTAL', variantId: null,
      baseQty: orderQty, totalQty, purchaseQty,
      processes: [{ id: refs.process.id, processName: refs.process.name }],
      processAllowances: [{
        processId: refs.process.id, processName: refs.process.name, sortOrder: 0,
        shrinkageInches: 0, processLossPercent: refs.process.loss,
        rejectionPercent: refs.process.rej, shipmentAllowancePercent: refs.process.ship,
      }],
      remarks: '',
    }],
    ...overrides,
  };
}
