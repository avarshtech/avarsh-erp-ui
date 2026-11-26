// Node-only: the buyer POs a shipment carries (owner, 2026-10-09). No browser, no API.
//   npx vitest run src/pages/expdoc/shipments/shipmentPos.test.js
import { describe, test, expect } from 'vitest';
import {
  poKey, poRefOf, poLabel, poChoicesOf, savedTicksOf, orderPosPayload, balanceOf, startQtyOf, totalOf,
} from './shipmentPos.js';
import { toApi } from '../../../services/expdoc/shipmentAdapter.js';

const PO_101 = { buyerPoNo: 'ZR-PO-101', destination: 'Arteixo DC', dispatchDate: '2026-11-15' };
const PO_102 = { buyerPoNo: 'ZR-PO-102', destination: 'Arteixo DC', dispatchDate: '2026-11-30' };
// The same PO number to a second destination is a second PO
const PO_101_ZGZ = { buyerPoNo: 'ZR-PO-101', destination: 'Zaragoza DC', dispatchDate: null };

describe('a buyer PO on a shipment', () => {
  test('is told apart by its number and destination, and reads back from its key', () => {
    expect(poKey(PO_101)).not.toBe(poKey(PO_101_ZGZ));
    expect(poRefOf(poKey(PO_101))).toEqual({ buyerPoNo: 'ZR-PO-101', destination: 'Arteixo DC' });
    expect(poRefOf(poKey({ buyerPoNo: 'P-1', destination: null }))).toEqual({ buyerPoNo: 'P-1', destination: null });
  });

  test('is labelled number, destination and dispatch date', () => {
    expect(poLabel(PO_101)).toBe('ZR-PO-101 · Arteixo DC · 15-Nov-2026');
    expect(poLabel(PO_101_ZGZ)).toBe('ZR-PO-101 · Zaragoza DC');
  });

  test("an order offers its own POs, then saved ones it has since dropped, each once", () => {
    const renamed = { buyerPoNo: 'ZR-PO-100', destination: 'Arteixo DC' };
    expect(poChoicesOf([PO_101, PO_102], [PO_102, renamed]).map((p) => p.buyerPoNo))
      .toEqual(['ZR-PO-101', 'ZR-PO-102', 'ZR-PO-100']);
  });

  test('an order saved without POs has no saved ticks: it ticks every PO once they load', () => {
    const ticks = savedTicksOf([
      { orderId: 5, pos: [PO_102] },
      { orderId: 6, pos: [] },
    ]);
    expect(ticks).toEqual({ 5: [poKey(PO_102)] });
  });

  test('the save sends each order with its ticked POs; unticked-by-hand stays empty', () => {
    const choices = { 5: [PO_101, PO_102], 6: [], 7: [PO_101_ZGZ] };
    const body = orderPosPayload([5, 6, 7, 8], { 5: [poKey(PO_102)], 7: [] }, (id) => choices[id] || []);
    expect(body).toEqual([
      { orderId: 5, pos: [{ buyerPoNo: 'ZR-PO-102', destination: 'Arteixo DC' }] },
      { orderId: 6, pos: [] },
      { orderId: 7, pos: [] },
      { orderId: 8, pos: [] },
    ]);
  });

  test('an order whose ticks were never set sends every PO it offers', () => {
    const body = orderPosPayload([5], {}, () => [PO_101, PO_102]);
    expect(body[0].pos.map((p) => p.buyerPoNo)).toEqual(['ZR-PO-101', 'ZR-PO-102']);
  });

  test('an order whose POs never loaded is left out, so the API keeps what the shipment has', () => {
    const known = (id) => id !== 6;
    const body = orderPosPayload([5, 6], { 5: [poKey(PO_101)] }, () => [], known);
    expect(body.map((o) => o.orderId)).toEqual([5]);
    // Ticked by hand, an order is sent whatever the picker knows
    expect(orderPosPayload([6], { 6: [] }, () => [], known)).toEqual([{ orderId: 6, pos: [] }]);
  });

  test('the API body carries orderPos when the form sends it, null otherwise', () => {
    const orderPos = [{ orderId: 5, pos: [{ buyerPoNo: 'ZR-PO-102', destination: 'Arteixo DC' }] }];
    expect(toApi({ orderIds: [5], orderPos }).orderPos).toEqual(orderPos);
    // A form value (the per-order ticks object) never travels as is
    expect(toApi({ orderIds: [5], orderPos: { 5: ['x'] } }).orderPos).toBeNull();
    expect(toApi({ orderIds: [5] }).orderPos).toBeNull();
  });
});

describe('the pieces a buyer PO sends (2026-11-09)', () => {
  const packedPo = { ...PO_101, packed: { Navy: { S: 10, M: 10 } }, shippedElsewhere: { Navy: { S: 4, M: 10 } } };

  test('the balance is packed less other shipments, sizes with nothing left omitted', () => {
    expect(balanceOf(packedPo)).toEqual({ Navy: { S: 6 } });
    expect(totalOf(balanceOf(packedPo))).toBe(6);
  });

  test('a PO starts with what the shipment saved, else its balance; unknown packing starts with nothing', () => {
    expect(startQtyOf(packedPo)).toEqual({ Navy: { S: 6 } });
    expect(startQtyOf({ ...packedPo, colorQty: { Navy: { S: 2 } } })).toEqual({ Navy: { S: 2 } });
    expect(startQtyOf(PO_102)).toBeNull();
  });

  test("an offered PO carries what the shipment saved of it", () => {
    const [choice] = poChoicesOf([packedPo], [{ ...PO_101, colorQty: { Navy: { S: 3 } }, shipQty: 3 }]);
    expect(choice.packed).toEqual(packedPo.packed);
    expect(choice.colorQty).toEqual({ Navy: { S: 3 } });
  });

  test("the save sends the grid's pieces with each PO, and nothing when the grid was never shown", () => {
    const payload = orderPosPayload([5], { 5: [poKey(PO_101), poKey(PO_102)] }, () => [], () => true,
      { 5: { [poKey(PO_101)]: { Navy: { S: 6 } } } });
    expect(payload).toEqual([{ orderId: 5, pos: [
      { buyerPoNo: 'ZR-PO-101', destination: 'Arteixo DC', colorQty: { Navy: { S: 6 } } },
      { buyerPoNo: 'ZR-PO-102', destination: 'Arteixo DC' },
    ] }]);
  });
});
