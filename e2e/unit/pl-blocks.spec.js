// Node-only: how a packing list places Carton Packing cartons by buyer PO (owner, 2026-10-09).
//   npx playwright test --project=unit e2e/unit/pl-blocks.spec.js
import { test, expect } from '@playwright/test';
import {
  poGroupsOf, attributeRange, unitsOfEntry, rowsOfUnit, blockOrderOf, takenBy, unitsOffered, soloKeyOf, ELSEWHERE,
} from '../../src/services/expdoc/expDocPlBlocks.js';
import { poKey } from '../../src/utils/expDocPoKeys.js';

const PO_A = { buyerPoNo: 'PO-A', destination: 'Hamburg DC' };
const PO_B = { buyerPoNo: 'PO-B', destination: 'Hamburg DC' };
const range = (from, to, buyerPoNo, extra = {}) => ({
  id: `g${from}`, sectionKey: 'MAIN', packingType: 'SOLID', cartonFrom: from, cartonTo: to, buyerPoNo, sizeQty: { M: 10 }, ...extra,
});
const entry = (id, groups, extra = {}) => ({
  id, orderId: 7, orderNo: 'ORD/7', packingNo: `CPK/${id}`, packingDate: '2026-10-01', status: 'COMPLETED', version: 1, groups, ...extra,
});

test.describe('the PO groups of an order on a shipment', () => {
  test('are the POs the shipment ticked, else every PO of the order, else the whole order', () => {
    expect(poGroupsOf({ pos: [PO_A] }, { readable: true, pos: [PO_A, PO_B] }).map((g) => g.buyerPoNo)).toEqual(['PO-A']);
    expect(poGroupsOf({ pos: [] }, { readable: true, pos: [PO_A, PO_B] }).map((g) => g.buyerPoNo)).toEqual(['PO-A', 'PO-B']);
    expect(poGroupsOf({ pos: [] }, { readable: false })).toEqual([{ key: null, buyerPoNo: null, destination: null, dispatchDate: null }]);
  });
});

test.describe('a carton range is placed by its PO', () => {
  const groups = poGroupsOf({ pos: [PO_A, PO_B] }, null);

  test('by number; a PO the shipment does not carry belongs elsewhere', () => {
    expect(attributeRange(range(1, 10, 'PO-A'), groups)).toBe(poKey(PO_A));
    expect(attributeRange(range(1, 10, 'PO-Z'), groups)).toBe(ELSEWHERE);
  });

  test('no PO on an order with several cannot be placed; on an order with one it is that PO', () => {
    expect(attributeRange(range(1, 10, null), groups, soloKeyOf(groups, { readable: true, pos: [PO_A, PO_B] }))).toBeUndefined();
    const one = poGroupsOf({ pos: [PO_A] }, null);
    expect(attributeRange(range(1, 10, null), one, soloKeyOf(one, { readable: true, pos: [PO_A] }))).toBe(poKey(PO_A));
    // The shipment ticking one PO of two does not make a PO-less range that PO's
    expect(soloKeyOf(one, { readable: true, pos: [PO_A, PO_B] })).toBeUndefined();
  });

  test('a range naming a destination the shipment did not tick goes on another shipment', () => {
    const hamburgOnly = poGroupsOf({ pos: [PO_A] }, null);
    expect(attributeRange(range(1, 10, 'PO-A', { destination: 'Venlo DC' }), hamburgOnly)).toBe(ELSEWHERE);
    expect(attributeRange(range(1, 10, 'PO-A', { destination: 'Hamburg DC' }), hamburgOnly)).toBe(poKey(PO_A));
  });

  test('the same PO to two destinations is told apart by the destination', () => {
    const two = poGroupsOf({ pos: [PO_A, { buyerPoNo: 'PO-A', destination: 'Venlo DC' }] }, null);
    expect(attributeRange(range(1, 10, 'PO-A', { destination: 'Venlo DC' }), two)).toBe(poKey({ buyerPoNo: 'PO-A', destination: 'Venlo DC' }));
    expect(attributeRange(range(1, 10, 'PO-A'), two)).toBeUndefined();
  });
});

test.describe('one packing day can feed two shipments', () => {
  const day = entry(1, [range(1, 40, 'PO-A'), range(41, 70, 'PO-B'), range(71, 80, null)]);

  test('an entry splits into one unit per PO, plus what names no PO', () => {
    const { units, unplaced } = unitsOfEntry(day, poGroupsOf({ pos: [PO_A, PO_B] }, null));
    expect([...units.keys()]).toEqual([poKey(PO_A), poKey(PO_B)]);
    expect(unplaced.map((g) => g.cartonFrom)).toEqual([71]);
  });

  test("a shipment carrying only PO-A offers only PO-A's cartons", () => {
    const db = { packingEntries: [day], packingLists: [] };
    const { byGroup } = unitsOffered(db, 7, poGroupsOf({ pos: [PO_A] }, null));
    expect([...byGroup.values()].flat().map((u) => [u.packingNo, u.cartons])).toEqual([['CPK/1', 40]]);
  });

  test('a unit on another live list is offered as taken, not free', () => {
    const db = {
      packingEntries: [day],
      packingLists: [{ id: 9, plNo: 'PKL/9', status: 'DRAFT', sourceRefs: [{ packingEntryId: 1, poKey: poKey(PO_A) }] }],
    };
    const offers = [...unitsOffered(db, 7, poGroupsOf({ pos: [PO_A] }, null), { taken: takenBy(db, null) }).byGroup.values()].flat();
    expect(offers[0]).toMatchObject({ bindable: false, blockedReason: 'On PKL/9.' });
  });
});

test.describe('the rows a unit puts on a list', () => {
  test('carry a stable id from the entry, PO and own range, and the order they belong to', () => {
    const e = entry(5, [range(1, 40, 'PO-A')]);
    const [r] = rowsOfUnit(e, poKey(PO_A), e.groups, { buyerPoNo: 'PO-A', destination: 'Hamburg DC' }, { garmentName: 'Tee' });
    expect(r).toMatchObject({
      ownFrom: 1, ownTo: 40, orderId: 7, orderNo: 'ORD/7', buyerPoNo: 'PO-A', destination: 'Hamburg DC',
      sourceEntryId: 5, sourceEntryNo: 'CPK/5', garmentName: 'Tee',
    });
    // The same range saved again (the API renews group ids) keeps its row id
    const [again] = rowsOfUnit(e, poKey(PO_A), [{ ...e.groups[0], id: 'renewed' }], null, null);
    expect(again.id).toBe(r.id);
  });

  test("blocks follow the list's order, then orders added to the shipment, then bound orders it dropped", () => {
    const pl = { blockOrder: [2, 1], sourceRefs: [{ orderId: 4 }] };
    expect(blockOrderOf(pl, { orders: [{ orderId: 1 }, { orderId: 2 }, { orderId: 3 }] })).toEqual([2, 1, 3, 4]);
  });
});
