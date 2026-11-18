// Parity fixtures for the packing-list assembly in src/services/expdoc: expDocPlBlocks.js, expDocPlPlan.js and
// expDocPlAssemble.js -> erp-purchase exportdoc/packinglist assembly (PoGroups, EntryUnits, PlAssembler, PlPlans),
// written to expDocPlBlocks.json (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The data. Buyer JOMO's shipment SHP/26-27/1007 carries three orders: the polo 1042, whose buyer POs are PO-884213 to
// Rotterdam and to Venlo DC and PO-884214 to Hamburg DC, of which the shipment ticked Rotterdam and Hamburg; the Henley
// 1043, with one PO the shipment did not tick (none ticked means every PO of the order); and the sweatshirt 1044,
// without PO numbers (one whole-order group). VGT's SHP/26-27/1008 ticked a PO number its order has corrected since,
// and Prenatal's SHP/26-27/1009 carries an OPEN entry with a carton missing its weights. The orders are read into
// order metas as expDocOrderMeta.orderMetaFor reads them (utils/orderSizes). The Carton Packing entries are what
// GET /packing/entries returns: cartons from expDocMockData's sample entries (without the mock store's seq and
// version) and in the shapes of expDocPlBlocks.test.js, packed on different days, several starting at carton 1 again.
// Fixed data: nothing depends on today's date. Of the sample entries only the carton groups are taken, because their
// entry numbers and dates follow the clock.
//
// Named adapters (README.md):
//  - ELSEWHERE, the Symbol for "a PO this shipment does not carry", is written {"elsewhere": true} where soloKeyOf and
//    attributeRange return it, and where attributeRange and unitsOfEntry take it as `solo`. A PO key is text or null,
//    so the marker is never a key.
//  - A Map result whose keys may be null (the whole-order group) is written as its entries in order: unitsOfEntry's
//    units as [{ key, groups }], unitsOffered's byGroup as [{ key, offers }], groupsByOrder as [{ orderId, groups }].
//    takenBy and planRangesOf key their Maps by text, so they are written as objects.
//  - unitsOffered's options take boundKeys and excluded as lists of unit keys (the browser's Sets) and taken as an
//    object of unit key -> list number (the browser's Map); an option left out stays out.
//  - assemble writes blockOrder, sections, orderNos and sizes onto the list it is given and returns the list: the
//    adapter returns those four. applyPlan's cases pass a list holding only `plans`, all it reads and writes, so its
//    own return value is recorded.
// Not recorded (notPorted): blocksOf reads the packing mirror; ordersOfList is blockOrderOf by another name.
//
// The packing mirror is stubbed (vi.mock below) only to keep its import chain out of the run: the packing REST client,
// axios and the message components with antd take some 25 s to load, and no recorded function reads the mirror. The
// stub answers what the real mirror answers when it was never synced.
import { test, expect, vi } from 'vitest';
import * as blocks from '../../src/services/expdoc/expDocPlBlocks.js';
import * as plan from '../../src/services/expdoc/expDocPlPlan.js';
import * as assembly from '../../src/services/expdoc/expDocPlAssemble.js';
import { buildSampleEntries } from '../../src/services/expdoc/expDocMockData.js';
import { resolveOrderSizes, orderBreakdownOf, orderPosOf } from '../../src/utils/orderSizes.js';
import { poKey } from '../../src/utils/expDocPoKeys.js';
import { decorateEntry } from '../../src/utils/packingEntryIssues.js';
import { writeFixtures } from './writeFixtures.js';

vi.mock('../../src/services/expdoc/expDocPackingMirror.js', () => ({
  PACKING_READ: { OK: 'OK', UNREADABLE: 'UNREADABLE' },
  packingReadOf: () => null,
}));

const {
  unitKeyOf, poGroupsOf, rowsOfUnit, blockOrderOf, takenBy,
} = blocks;
const {
  planRowsOf, planRangesOf, applyPlan, markNotShipping,
} = plan;
const { breakdownFor } = assembly;

// ─── Named adapters ──────────────────────────────────────────────────────────────────
const ELSEWHERE_JSON = Object.freeze({ elsewhere: true });

/** A `solo` argument as the browser takes it: the marker becomes ELSEWHERE; anything else that is an object is refused. */
const placementIn = (v) => {
  if (v === null || typeof v !== 'object') return v;
  if (Object.keys(v).length !== 1 || v.elsewhere !== true) throw new Error(`Not a placement: ${JSON.stringify(v)}`);
  return blocks.ELSEWHERE;
};
const placementOut = (v) => (v === blocks.ELSEWHERE ? { ...ELSEWHERE_JSON } : v);

const soloKeyOf = function soloKeyOf(...args) {
  return placementOut(blocks.soloKeyOf(...args));
};

const attributeRange = function attributeRange(group, poGroups, ...solo) {
  return placementOut(blocks.attributeRange(group, poGroups, ...solo.map(placementIn)));
};

const unitsOfEntry = function unitsOfEntry(entry, poGroups, ...solo) {
  const { units, unplaced } = blocks.unitsOfEntry(entry, poGroups, ...solo.map(placementIn));
  return { units: [...units].map(([key, groups]) => ({ key, groups })), unplaced };
};

const offerOptionsOf = (options) => {
  if (options == null) return options;
  const out = { ...options };
  if (Array.isArray(options.boundKeys)) out.boundKeys = new Set(options.boundKeys);
  if (options.taken != null) out.taken = new Map(Object.entries(options.taken));
  if (Array.isArray(options.excluded)) out.excluded = new Set(options.excluded);
  return out;
};

const unitsOffered = function unitsOffered(db, orderId, poGroups, ...options) {
  const { byGroup, unplaced } = blocks.unitsOffered(db, orderId, poGroups, ...options.map(offerOptionsOf));
  return { byGroup: [...byGroup].map(([key, offers]) => ({ key, offers })), unplaced };
};

const groupsByOrder = function groupsByOrder(...args) {
  return [...assembly.groupsByOrder(...args)].map(([orderId, groups]) => ({ orderId, groups }));
};

const assemble = function assemble(...args) {
  const {
    blockOrder, sections, orderNos, sizes,
  } = assembly.assemble(...args);
  return {
    blockOrder, sections, orderNos, sizes,
  };
};

const API = {
  ...blocks, ...plan, ...assembly, soloKeyOf, attributeRange, unitsOfEntry, unitsOffered, groupsByOrder, assemble,
};
const NOT_PORTED = {
  blocksOf: "reads the packing mirror (expDocPackingMirror.packingReadOf) for each block's `unreadable` flag",
  ordersOfList: 'blockOrderOf by another name: it only calls it',
};

// ─── Orders, and what a packing list keeps of each ────────────────────────────────────
const ch = (...codes) => String.fromCharCode(...codes);
const NBSP = ch(0xa0);
const E_ACUTE = ch(0xe9);

const PRESETS = [
  { id: 3, name: 'Men M-XXXL', sizes: ['M', 'L', 'XL', 'XXL', 'XXXL'] },
  { id: 7, name: 'Kids EU 74-140', sizes: ['74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140'] },
  { id: 9, name: 'Baby 50/56-86/92', sizes: ['50/56', '62/68', '74/80', '86/92'] },
  { id: 12, name: 'Unisex XS-XXL', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
];

const PO = {
  rtm: { buyerPoNo: 'PO-884213', destination: 'Rotterdam', dispatchDate: '2026-11-05' },
  venlo: { buyerPoNo: 'PO-884213', destination: 'Venlo DC', dispatchDate: '2026-11-19' },
  ham: { buyerPoNo: 'PO-884214', destination: 'Hamburg DC', dispatchDate: '2026-11-12' },
  henley: { buyerPoNo: 'PO-884290', destination: 'Rotterdam', dispatchDate: '2026-11-05' },
  vgt: { buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', dispatchDate: '2026-11-20' },
  vgtOld: { buyerPoNo: 'VGT-2026-770', destination: 'Antwerp', dispatchDate: '2026-11-20' },
  pre: { buyerPoNo: 'PRE-55120', destination: 'Rotterdam', dispatchDate: '2026-12-01' },
};
const K = Object.fromEntries(Object.entries(PO).map(([name, p]) => [name, poKey(p)]));

const colour = (colorName, quantities) => ({ colorName, quantities });
const line = (id, po, sizePresetId, sizePrices, colorRows) => ({
  id,
  buyerPoNo: po?.buyerPoNo ?? null,
  destination: po?.destination ?? null,
  dispatchDate: po?.dispatchDate ?? '2026-11-26',
  sizePresetId,
  sizePrices,
  colorRows,
});

const ORDERS = {
  polo: {
    id: 1042,
    orderNo: 'SG/26-27/1042',
    buyerName: 'JOMO BV',
    styleNo: 'ST-2026-0441',
    garmentName: "Men's Slim Fit Polo",
    fabricDescription: '95% COTTON 5% ELASTANE',
    orderLines: [
      line(4201, PO.rtm, 3, { M: 8.75, L: 8.75, XL: 8.75, XXL: 8.95 }, [
        colour('Navy', { M: 488, L: 950, XL: 1500 }),
        colour('Flame Scarlet 18-1662 TCX', { M: 49, L: 86, XL: 80, XXL: 40 }),
      ]),
      line(4202, PO.ham, 3, { M: 9.1, L: 9.1, XL: 9.1 }, [colour('Navy', { M: 156, L: 156, XL: 172 })]),
      line(4203, PO.venlo, 3, { M: 8.75, L: 8.75 }, [colour('Navy', { M: 100, L: 100 })]),
    ],
  },
  henley: {
    id: 1043,
    orderNo: 'SG/26-27/1043',
    buyerName: 'JOMO BV',
    styleNo: 'ST-2026-0442',
    garmentName: "Men's Henley",
    fabricDescription: '100% COTTON',
    orderLines: [line(4301, PO.henley, 3, { M: 7.4, L: 7.4, XL: 7.4 }, [colour('Black', { M: 96, L: 120, XL: 96 })])],
  },
  sweat: {
    id: 1044,
    orderNo: 'SG/26-27/1044',
    buyerName: 'JOMO BV',
    styleNo: 'ST-2026-0450',
    garmentName: 'Crew Neck Sweatshirt',
    fabricDescription: '80% COTTON 20% POLYESTER FLEECE',
    orderLines: [line(4401, null, 12, {}, [
      colour('Heather Grey', { S: 60, M: 120, L: 120, XL: 60 }),
      colour('Navy', { M: 80, L: 80 }),
    ])],
  },
  vgt: {
    id: 1055,
    orderNo: 'SG/26-27/1055',
    buyerName: 'Van Gennip Textiles BV',
    styleNo: 'ST-2026-0512',
    garmentName: "Girls' Printed Tee",
    fabricDescription: '100% ORGANIC COTTON',
    orderLines: [line(5501, PO.vgt, 7, {
      74: 4.1, 80: 4.1, 86: 4.2, 92: 4.2, 98: 4.35, 104: 4.35, 110: 4.5, 116: 4.5, 122: 4.65, 128: 4.65, 134: 4.8, 140: 4.8,
    }, [
      colour('Ecru', { 74: 3600, 80: 3600, 86: 3600, 92: 3600, 98: 3600, 104: 3600 }),
      colour('Dusty Rose', { 110: 3120, 116: 3120, 122: 3120, 128: 400, 134: 400, 140: 400 }),
    ])],
  },
  prenatal: {
    id: 1061,
    orderNo: 'SG/26-27/1061',
    buyerName: 'Prenatal Moeder en Kind BV',
    styleNo: 'ST-2026-0588',
    garmentName: 'Baby 3-pack Bodysuit',
    fabricDescription: '100% COTTON INTERLOCK',
    orderLines: [line(6101, PO.pre, 9, { '50/56': 6.9, '62/68': 6.9, '74/80': 6.9, '86/92': 6.9 }, [
      colour('White', { '50/56': 384, '62/68': 384, '74/80': 384 }),
      colour('Soft Blue', { '74/80': 288, '86/92': 264 }),
    ])],
  },
};

/** What expDocOrderMeta.orderMetaFor keeps of an order it could read. */
const metaOf = (order) => ({
  orderId: order.id,
  readable: true,
  orderNo: order.orderNo ?? null,
  styleNo: order.styleNo ?? null,
  garmentName: order.garmentName ?? null,
  compositionText: order.fabricDescription ?? null,
  sizes: resolveOrderSizes(order, PRESETS),
  orderBreakdown: orderBreakdownOf(order),
  pos: orderPosOf(order),
});
const unreadable = (orderId) => ({ orderId, readable: false });
const META = Object.fromEntries(Object.entries(ORDERS).map(([name, order]) => [name, metaOf(order)]));

// ─── Shipments, as the shipment mirror holds them ────────────────────────────────────
const shipPo = (p, shipQty = 0, colorQty = null) => ({
  buyerPoNo: p.buyerPoNo ?? null,
  destination: p.destination ?? null,
  dispatchDate: p.dispatchDate ?? null,
  colorQty,
  shipQty,
  packed: null,
  shippedElsewhere: null,
});
const shipOrder = (order, pos) => ({
  orderId: order.id, orderNo: order.orderNo, styleNo: order.styleNo, pos,
});
const shipment = (id, buyerName, orders) => ({
  id, shipmentNo: `SHP/26-27/${1000 + id}`, status: 'OPEN', buyerName, etd: '2026-11-10', version: 2, orders,
});
const SHIPMENT = {
  jomo: shipment(7, 'JOMO BV', [
    shipOrder(ORDERS.polo, [shipPo(PO.rtm, 2938, { Navy: { M: 488, L: 950, XL: 1500 } }), shipPo(PO.ham, 484)]),
    shipOrder(ORDERS.henley, []),
    shipOrder(ORDERS.sweat, []),
  ]),
  vgt: shipment(8, 'Van Gennip Textiles BV', [shipOrder(ORDERS.vgt, [shipPo(PO.vgtOld, 32400)])]),
  prenatal: shipment(9, 'Prenatal Moeder en Kind BV', [shipOrder(ORDERS.prenatal, [shipPo(PO.pre, 2304)])]),
};

// The PO groups each order's block shows, as the browser builds them
const G = {
  jomo: poGroupsOf(SHIPMENT.jomo.orders[0], META.polo),
  jomoAll: poGroupsOf(shipOrder(ORDERS.polo, []), META.polo),
  henley: poGroupsOf(SHIPMENT.jomo.orders[1], META.henley),
  sweat: poGroupsOf(SHIPMENT.jomo.orders[2], META.sweat),
  vgt: poGroupsOf(shipOrder(ORDERS.vgt, []), META.vgt),
  vgtOld: poGroupsOf(SHIPMENT.vgt.orders[0], META.vgt),
  pre: poGroupsOf(SHIPMENT.prenatal.orders[0], META.prenatal),
};
const ORPHAN = {
  rtm: { key: K.rtm, buyerPoNo: 'PO-884213', destination: 'Rotterdam', dispatchDate: null, orphan: true },
  henley: { key: K.henley, buyerPoNo: 'PO-884290', destination: 'Rotterdam', dispatchDate: null, orphan: true },
};

// ─── Carton Packing entries, as GET /packing/entries returns them ─────────────────────────
const SAMPLE = buildSampleEntries();
/** A sample entry's carton groups, without the mock store's seq and version. */
const sampleGroups = (i) => SAMPLE[i].groups.map(({ seq: _seq, version: _version, ...g }) => g);

const range = (id, from, to, po, contents, extra = {}) => ({
  id,
  sectionKey: 'MAIN',
  packingType: 'SOLID',
  cartonFrom: from,
  cartonTo: to,
  packingCode: null,
  danNo: null,
  buyerPoNo: po?.buyerPoNo ?? null,
  destination: po?.destination ?? null,
  styleNo: null,
  colorName: null,
  sizeQty: null,
  ratio: null,
  mixedRows: null,
  assortmentsPerCarton: null,
  pcsPerMpb: null,
  mpbPerCarton: null,
  netWeightKg: 12.48,
  grossWeightKg: 13.5,
  lengthCm: 60,
  breadthCm: 40,
  heightCm: 35,
  remarks: null,
  completionFlag: true,
  ...contents,
  ...extra,
});

const entry = (id, order, packingDate, groups, extra = {}) => ({
  id,
  version: 3,
  packingNo: `CPK/26-27/${1000 + id}`,
  orderId: order.id,
  branchId: 1,
  branchName: 'Tiruppur',
  orderNo: order.orderNo,
  buyerName: order.buyerName,
  styleNo: order.styleNo,
  garmentName: order.garmentName,
  compositionText: order.fabricDescription,
  packingDate,
  status: 'COMPLETED',
  groups,
  ...extra,
});

const NAVY = { styleNo: 'ST-2026-0441', colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 } };
const NAVY_HAM = { styleNo: 'ST-2026-0441', colorName: 'Navy', sizeQty: { M: 12, L: 12, XL: 12 } };
const SCARLET = { styleNo: 'ST-2026-0441', colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 8, L: 16, XL: 16, XXL: 8 } };
const SCARLET_RATIO = {
  styleNo: 'ST-2026-0441', packingType: 'RATIO', colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: null,
  ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
};
const MIXED = {
  styleNo: 'ST-2026-0441', packingType: 'MIXED', colorName: null, sizeQty: null,
  mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }],
};
const NAVY_MPB = { styleNo: 'ST-2026-0441', packingType: 'MPB', colorName: 'Navy', sizeQty: null, ratio: { M: 2, L: 2, XL: 2 }, pcsPerMpb: 6, mpbPerCarton: 8 };
const NAVY_EXTRA = {
  ...NAVY, packingType: 'EXTRA', sizeQty: { M: 3, L: 4 }, netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20,
};
const BLACK = { colorName: 'Black', sizeQty: { M: 8, L: 8, XL: 8 } }; // the Henley's ranges leave the style to the entry
const GREY = { styleNo: 'ST-2026-0450', colorName: 'Heather Grey', sizeQty: { S: 6, M: 12, L: 12, XL: 6 } };
const ECRU = { styleNo: 'ST-2026-0512', colorName: 'Ecru', sizeQty: { 74: 12, 80: 12, 86: 12 } };

const E = {
  // The reference entry: all five packing types, every carton for PO-884213 to Rotterdam (expDocMockData)
  e101: entry(101, ORDERS.polo, '2026-10-01', sampleGroups(0), { version: 4 }),
  // One packing day for several POs: Hamburg named with and without its destination, PO-884213 padded and without a
  // destination, the same PO to Venlo DC (on another shipment), a range naming no PO and one naming a PO not on the order
  e102: entry(102, ORDERS.polo, '2026-10-03', [
    range(10201, 1, 13, PO.ham, NAVY_HAM),
    range(10202, 14, 18, { buyerPoNo: 'PO-884214' }, NAVY_HAM),
    range(10203, 19, 24, { buyerPoNo: ' PO-884213 ' }, NAVY),
    range(10204, 25, 30, PO.venlo, NAVY),
    range(10205, 31, 32, null, NAVY),
    range(10206, 33, 33, { buyerPoNo: 'PO-999001', destination: 'Rotterdam' }, NAVY),
  ]),
  // Packed from 1 again, a day after 101: the list stacks the two by packing day. One extra carton
  e103: entry(103, ORDERS.polo, '2026-10-02', [
    range(10301, 1, 10, PO.rtm, SCARLET),
    range(10302, 11, 11, PO.rtm, NAVY_EXTRA, { sectionKey: 'EXTRA' }),
  ]),
  // Still OPEN, and a ratio carton without its assortments: offered, never bindable
  e104: entry(104, ORDERS.polo, '2026-10-06', [
    range(10401, 19, 25, PO.ham, { ...NAVY_HAM, packingType: 'RATIO', sizeQty: null, ratio: { M: 1, L: 2, XL: 1 } }),
  ], { status: 'OPEN', version: 1 }),
  // Both POs numbered from 1 in one entry: an overlap to Carton Packing (V-02), which blocks both units
  e105: entry(105, ORDERS.polo, '2026-10-07', [range(10501, 1, 5, PO.rtm, NAVY), range(10502, 1, 5, PO.ham, NAVY_HAM)]),
  // The Henley: its one PO, mostly packed without naming it
  e106: entry(106, ORDERS.henley, '2026-10-04', [range(10601, 1, 12, null, BLACK), range(10602, 13, 15, PO.henley, BLACK)]),
  // The sweatshirt has no PO numbers: every range is the whole order's, even one that names a PO
  e107: entry(107, ORDERS.sweat, '2026-10-05', [range(10701, 1, 20, null, GREY), range(10702, 21, 22, { buyerPoNo: 'PO-X' }, GREY)]),
  // Packed as per the buyer's plan: the plan's own numbers and contents
  e108: entry(108, ORDERS.polo, '2026-10-09', [
    range(10801, 168, 177, PO.rtm, SCARLET_RATIO, { netWeightKg: 9.2, grossWeightKg: 10, heightCm: 30 }),
  ]),
  // VGT: the 900-carton entry (expDocMockData) and a later one naming no PO
  e201: entry(201, ORDERS.vgt, '2026-10-03', sampleGroups(1), { version: 2 }),
  e202: entry(202, ORDERS.vgt, '2026-10-08', [range(20201, 901, 950, null, ECRU, { netWeightKg: 8.4, grossWeightKg: 9.1, heightCm: 30 })]),
  // Prenatal: OPEN, one row without weights (expDocMockData)
  e301: entry(301, ORDERS.prenatal, '2026-10-04', sampleGroups(2), { status: 'OPEN', version: 1 }),
};
const JOMO_ENTRIES = [E.e101, E.e102, E.e103, E.e104, E.e105, E.e106, E.e107, E.e108];
const DB = {
  jomo: { packingEntries: JOMO_ENTRIES },
  vgt: { packingEntries: [E.e201, E.e202] },
  prenatal: { packingEntries: [E.e301] },
};

// ─── Packing lists ───────────────────────────────────────────────────────────────────
/** A bound unit as the list records it (expDocMockPackingLists sourceRefOf). */
const ref = (e, key) => ({
  packingEntryId: e.id,
  packingNo: e.packingNo,
  packingEntryVersion: e.version,
  orderId: e.orderId,
  poKey: key,
  packingDate: e.packingDate,
  branchId: e.branchId,
});
const list = (id, status, sourceRefs, extra = {}) => ({
  id, plNo: `PKL/26-27/${1000 + id}`, revision: 0, status, shipmentId: 7, sourceRefs, ...extra,
});
const LISTS = [
  list(31, 'FINAL', [ref(E.e101, K.rtm)]),
  list(32, 'DRAFT', [ref(E.e102, K.ham), ref(E.e106, K.henley)]),
  list(33, 'CANCELLED', [ref(E.e103, K.rtm)]),
  list(34, 'SUPERSEDED', [ref(E.e105, K.rtm)], { supersededByPlId: 36 }),
  list(35, 'EXPORTED', [ref(E.e107, null)], { shipmentId: 6 }),
  // The revision of PKL/26-27/1034 holds its unit again
  list(36, 'DRAFT', [ref(E.e105, K.rtm)], { plNo: 'PKL/26-27/1034', revision: 1, supersedesPlId: 34 }),
];

/** A plan row as the plan drawer sends it: Carton Packing's blank group, filled in. */
const planInput = (id, from, to, po, contents, extra = {}) => ({
  id,
  sectionKey: 'MAIN',
  packingType: 'SOLID',
  cartonFrom: from,
  cartonTo: to,
  packingCode: null,
  danNo: null,
  buyerPoNo: po?.buyerPoNo ?? null,
  destination: po?.destination ?? null,
  styleNo: null,
  colorName: null,
  sizeQty: {},
  mixedRows: null,
  ratio: null,
  assortmentsPerCarton: null,
  pcsPerMpb: null,
  mpbPerCarton: null,
  netWeightKg: null,
  grossWeightKg: null,
  lengthCm: null,
  breadthCm: null,
  heightCm: null,
  remarks: null,
  completionFlag: false,
  ...contents,
  ...extra,
});
const JOMO_PLAN_INPUT = [
  planInput('tmp-1', 121, 167, PO.rtm, NAVY),
  planInput('tmp-2', 168, 177, PO.rtm, SCARLET_RATIO),
  planInput('tmp-3', 178, 190, PO.rtm, MIXED),
  planInput('tmp-4', 191, 200, PO.rtm, NAVY),
  planInput('tmp-5', 1, 13, PO.ham, NAVY_HAM),
];
// The buyer's plans as the browser keeps them: applied, and one range marked Not shipping
const PLANS = (() => {
  const pl = applyPlan({}, 1042, structuredClone(JOMO_PLAN_INPUT), G.jomo, META.polo);
  markNotShipping(pl, 1042, 'plan-4', 'Buyer cut the PO by 10 cartons');
  return pl.plans;
})();
const PLANS_SWEAT = applyPlan({}, 1044, [planInput('tmp-1', 1, 20, null, GREY), planInput('tmp-2', 21, 30, null, GREY)], G.sweat, META.sweat).plans;
const SAVED = { plans: PLANS };
const [PLAN_RTM] = PLANS[1042].rows;

/** The draft list of SHP/26-27/1007 that assemble builds. */
const PL = {
  id: 40,
  plNo: 'PKL/26-27/1040',
  revision: 0,
  status: 'DRAFT',
  shipmentId: 7,
  shipmentNo: 'SHP/26-27/1007',
  numbering: 'CONTINUE',
  firstCartonNo: 1,
  blockOrder: [1042, 1043, 1044],
  sourceRefs: [ref(E.e101, K.rtm), ref(E.e103, K.rtm), ref(E.e102, K.rtm), ref(E.e102, K.ham), ref(E.e106, K.henley), ref(E.e107, null)],
  orderMeta: { 1042: META.polo, 1043: META.henley, 1044: META.sweat },
  plans: {},
  excludedUnits: [],
  sections: [],
  sizes: [],
};
const PL_PLANNED = { ...PL, sourceRefs: [...PL.sourceRefs, ref(E.e108, K.rtm)], plans: PLANS };
const ASSEMBLED = assembly.assemble(structuredClone(PL), DB.jomo, SHIPMENT.jomo);
const PL_VGT = {
  ...PL, id: 41, plNo: 'PKL/26-27/1041', shipmentId: 8, shipmentNo: 'SHP/26-27/1008', blockOrder: [1055],
  sourceRefs: [ref(E.e201, K.vgtOld), ref(E.e202, K.vgtOld)], orderMeta: { 1055: META.vgt },
};
const PL_PRE = {
  ...PL, id: 42, plNo: 'PKL/26-27/1042', shipmentId: 9, shipmentNo: 'SHP/26-27/1009', numbering: 'PER_PO', blockOrder: [1061],
  sourceRefs: [ref(E.e301, K.pre)], orderMeta: { 1061: META.prenatal },
};
const WITH_VGT = {
  ...PL, sourceRefs: [...PL.sourceRefs, ref(E.e201, K.vgt)], orderMeta: { ...PL.orderMeta, 1055: META.vgt },
};

// ─── Cases ───────────────────────────────────────────────────────────────────────────
/** The cases of one function: [id, args], or [id, args, true] for a call the browser rejects. */
const cases = (fn, table) => table.map(([id, args, throws]) => ({
  id: `${fn.name}/${id}`, fn, args, ...(throws ? { throws: true } : {}),
}));

const [HAM, HAM_NO_DEST, RTM_PADDED, VENLO, NO_PO, NOT_ON_ORDER] = E.e102.groups;
const unitGroups = (e, groups, key, solo) => blocks.unitsOfEntry(e, groups, solo).units.get(key) || [];
const TAKEN_BY_OTHERS = Object.fromEntries(takenBy({ packingLists: LISTS }, 40));
const MIRRORED_101 = decorateEntry(E.e101);

const CASES = [
  ...cases(unitKeyOf, [
    ['entry-and-po', [101, K.rtm]],
    ['whole-order', [107, null]],
    ['po-left-off', [107]],
    ['empty-po-key', [107, '']],
    ['key-without-separator', [102, 'PO-884214']],
    ['entry-zero', [0, K.ham]],
    ['no-entry', [null, K.ham]],
    ['largest-entry-id', [2147483647, K.vgt]],
  ]),
  ...cases(poGroupsOf, [
    ['ticked-pos', [SHIPMENT.jomo.orders[0], META.polo]],
    ['none-ticked-every-po-of-the-order', [SHIPMENT.jomo.orders[1], META.henley]],
    ['none-ticked-same-po-to-two-destinations', [shipOrder(ORDERS.polo, []), META.polo]],
    ['none-ticked-order-without-po-numbers', [SHIPMENT.jomo.orders[2], META.sweat]],
    ['none-ticked-order-unreadable', [SHIPMENT.jomo.orders[1], unreadable(1043)]],
    ['ticked-win-over-the-order', [SHIPMENT.vgt.orders[0], META.vgt]],
    ['ticked-also-when-the-order-is-unreadable', [SHIPMENT.jomo.orders[0], unreadable(1042)]],
    ['no-meta', [shipOrder(ORDERS.henley, []), null]],
    ['meta-left-off', [shipOrder(ORDERS.henley, [])]],
    ['order-not-on-the-shipment', [null, META.polo]],
    ['nothing-given', []],
    ['ticked-pos-null', [{ ...SHIPMENT.jomo.orders[1], pos: null }, META.henley]],
    ['readable-meta-without-pos', [shipOrder(ORDERS.polo, []), { ...META.polo, pos: null }]],
    ['text-trimmed-blank-is-null', [shipOrder(ORDERS.polo, [
      { buyerPoNo: ' PO-884213 ', destination: `Rotterdam${NBSP}`, dispatchDate: '2026-11-05' },
      { buyerPoNo: 'PO-884214', destination: '   ', dispatchDate: '2026-11-12' },
      { buyerPoNo: '', destination: 'Venlo DC', dispatchDate: null },
    ]), META.polo]],
    ['dispatch-date-left-out', [shipOrder(ORDERS.polo, [{ buyerPoNo: 'PO-884213', destination: 'Rotterdam' }]), null]],
    ['po-ticked-twice-kept-twice', [shipOrder(ORDERS.polo, [shipPo(PO.rtm), shipPo(PO.rtm)]), META.polo]],
    ['throws/null-po', [shipOrder(ORDERS.polo, [null]), META.polo], true],
  ]),
  ...cases(soloKeyOf, [
    ['whole-order', [G.sweat, META.sweat]],
    ['whole-order-whatever-the-meta', [G.sweat, META.henley]],
    ['one-po-on-the-shipment', [G.henley, META.henley]],
    ['one-po-ticked', [G.pre, META.prenatal]],
    ['one-po-not-on-the-shipment', [G.vgtOld, META.vgt]],
    ['several-pos', [G.jomoAll, META.polo]],
    ['one-ticked-of-several', [[G.jomo[0]], META.polo]],
    ['order-unreadable', [G.henley, unreadable(1043)]],
    ['no-meta', [G.henley, null]],
    ['meta-left-off', [G.henley]],
    ['readable-without-pos', [G.henley, { ...META.henley, pos: [] }]],
    ['readable-pos-null', [G.henley, { ...META.henley, pos: null }]],
    ['no-groups', [[], META.henley]],
    ['order-po-text-trimmed', [G.henley, { ...META.henley, pos: [{ buyerPoNo: ' PO-884290 ', destination: 'Rotterdam ', dispatchDate: null }] }]],
    ['whole-order-and-an-orphan', [[...G.sweat, ORPHAN.rtm], META.sweat]],
    ['orphan-is-the-orders-one-po', [[...G.sweat, ORPHAN.henley], META.henley]],
    ['throws/no-groups', [null, META.henley], true],
  ]),
  ...cases(attributeRange, [
    ['po-and-destination', [HAM, G.jomo]],
    ['po-without-destination', [HAM_NO_DEST, G.jomo]],
    ['po-text-trimmed', [RTM_PADDED, G.jomo]],
    ['destination-not-ticked-is-elsewhere', [VENLO, G.jomo]],
    ['po-not-on-the-order-is-elsewhere', [NOT_ON_ORDER, G.jomo]],
    ['po-in-other-case-is-elsewhere', [{ ...HAM, buyerPoNo: 'po-884214' }, G.jomo]],
    ['destination-in-other-case-is-elsewhere', [{ ...HAM, destination: 'HAMBURG DC' }, G.jomo]],
    ['destination-text-trimmed', [{ ...HAM, destination: ` Hamburg DC${NBSP}` }, G.jomo]],
    ['destination-on-the-range-only', [VENLO, poGroupsOf({ pos: [{ buyerPoNo: 'PO-884213', destination: null }] }, null)]],
    ['no-po-cannot-tell', [NO_PO, G.jomo]],
    ['no-po-blank-text-takes-solo', [{ ...NO_PO, buyerPoNo: '  ' }, G.henley, K.henley]],
    ['no-po-solo-po', [E.e106.groups[0], G.henley, K.henley]],
    ['no-po-solo-elsewhere', [E.e202.groups[0], G.vgtOld, ELSEWHERE_JSON]],
    ['no-po-solo-null', [NO_PO, G.jomo, null]],
    ['whole-order', [E.e107.groups[1], G.sweat]],
    ['whole-order-ignores-solo', [E.e107.groups[0], G.sweat, K.henley]],
    ['two-destinations-by-destination', [VENLO, G.jomoAll]],
    ['two-destinations-rotterdam', [E.e101.groups[0], G.jomoAll]],
    ['two-destinations-none-named-cannot-tell', [RTM_PADDED, G.jomoAll]],
    ['two-destinations-third-cannot-tell', [{ ...VENLO, destination: 'Antwerp' }, G.jomoAll]],
    ['two-destinations-one-without', [RTM_PADDED, poGroupsOf({ pos: [shipPo(PO.rtm), { buyerPoNo: 'PO-884213', destination: null }] }, null)]],
    ['no-groups-po-is-elsewhere', [HAM, []]],
    ['no-groups-no-po-takes-solo', [NO_PO, [], K.henley]],
    ['throws/null-range', [null, G.jomo], true],
    ['throws/null-groups', [HAM, null], true],
  ]),
  ...cases(unitsOfEntry, [
    ['one-unit-every-packing-type', [E.e101, G.jomo]],
    ['one-day-several-pos', [E.e102, G.jomo]],
    ['every-po-of-the-order', [E.e102, G.jomoAll]],
    ['extra-carton-same-unit', [E.e103, G.jomo]],
    ['two-pos-numbered-alike', [E.e105, G.jomo]],
    ['units-in-first-seen-order', [entry(109, ORDERS.polo, '2026-10-10', [
      range(10901, 1, 4, PO.ham, NAVY_HAM), range(10902, 5, 8, PO.rtm, NAVY), range(10903, 9, 12, PO.ham, NAVY_HAM),
    ]), G.jomo]],
    ['solo-po', [E.e106, G.henley, K.henley]],
    ['solo-left-off-stays-unplaced', [E.e106, G.henley]],
    ['whole-order', [E.e107, G.sweat, null]],
    ['order-po', [E.e201, G.vgt, K.vgt]],
    ['renamed-po-goes-elsewhere', [E.e201, G.vgtOld, ELSEWHERE_JSON]],
    ['solo-elsewhere-drops-it', [E.e202, G.vgtOld, ELSEWHERE_JSON]],
    ['open-entry', [E.e301, G.pre, K.pre]],
    ['no-groups', [{ ...E.e101, groups: [] }, G.jomo]],
    ['groups-null', [{ ...E.e101, groups: null }, G.jomo]],
    ['no-po-groups-at-all', [E.e102, []]],
    ['throws/null-entry', [null, G.jomo], true],
  ]),
  ...cases(rowsOfUnit, [
    ['every-packing-type', [E.e101, K.rtm, unitGroups(E.e101, G.jomo, K.rtm), G.jomo[0], META.polo]],
    ['po-named-two-ways', [E.e102, K.ham, unitGroups(E.e102, G.jomo, K.ham), G.jomo[1], META.polo]],
    ['po-text-trimmed', [E.e102, K.rtm, unitGroups(E.e102, G.jomo, K.rtm), G.jomo[0], META.polo]],
    ['extra-section', [E.e103, K.rtm, E.e103.groups, G.jomo[0], META.polo]],
    ['no-po-takes-the-groups', [E.e106, K.henley, E.e106.groups, G.henley[0], META.henley]],
    ['whole-order-key', [E.e107, null, E.e107.groups, G.sweat[0], META.sweat]],
    ['kids-sizes', [E.e201, K.vgt, E.e201.groups, G.vgt[0], META.vgt]],
    ['master-polybags-open-entry', [E.e301, K.pre, E.e301.groups, G.pre[0], META.prenatal]],
    ['same-range-saved-again', [E.e105, K.rtm, [
      E.e105.groups[0], { ...E.e105.groups[0], id: 99001 }, { ...E.e105.groups[0], id: 99002 },
    ], G.jomo[0], META.polo]],
    ['same-range-main-and-extra', [E.e103, K.rtm, [E.e103.groups[0], { ...E.e103.groups[0], id: 99003, sectionKey: 'EXTRA' }], G.jomo[0], META.polo]],
    ['entry-without-names-meta-fills', [{
      ...E.e106, orderNo: null, styleNo: null, garmentName: null, compositionText: null,
    }, K.henley, E.e106.groups, G.henley[0], META.henley]],
    ['blank-style-falls-through-blank-garment-kept', [{ ...E.e106, styleNo: '', garmentName: '' }, K.henley,
      E.e106.groups.map((g) => ({ ...g, styleNo: '' })), G.henley[0], META.henley]],
    ['no-group-no-meta', [{
      ...E.e106, orderNo: null, styleNo: null, garmentName: null, compositionText: null, packingDate: null,
    }, K.henley, E.e106.groups, null, null]],
    ['group-and-meta-left-off', [E.e106, K.henley, E.e106.groups]],
    ['missing-carton-numbers', [E.e101, K.rtm, [{ ...E.e101.groups[0], cartonFrom: null, cartonTo: null }], G.jomo[0], META.polo]],
    ['no-section', [E.e101, K.rtm, [{ ...E.e101.groups[0], sectionKey: null }], G.jomo[0], META.polo]],
    ['empty-key-is-not-a-dash', [E.e101, '', [E.e101.groups[0]], null, null]],
    ['as-the-packing-mirror-holds-it', [MIRRORED_101, K.rtm, MIRRORED_101.groups, G.jomo[0], META.polo]],
    ['no-groups', [E.e101, K.rtm, [], G.jomo[0], META.polo]],
    ['throws/null-entry', [null, K.rtm, E.e101.groups, G.jomo[0], META.polo], true],
    ['throws/null-groups', [E.e101, K.rtm, null, G.jomo[0], META.polo], true],
  ]),
  ...cases(blockOrderOf, [
    ['own-order-then-shipment-then-bound', [{ blockOrder: [1043, 1042], sourceRefs: [ref(E.e201, K.vgt), ref(E.e101, K.rtm)] }, SHIPMENT.jomo]],
    ['new-list-takes-the-shipments-order', [{ blockOrder: [], sourceRefs: [] }, SHIPMENT.jomo]],
    ['bound-orders-the-shipment-dropped', [{ blockOrder: [1042], sourceRefs: [ref(E.e101, K.rtm), ref(E.e201, K.vgt)] }, SHIPMENT.prenatal]],
    ['no-shipment', [{ blockOrder: [1044, 1042], sourceRefs: [ref(E.e106, K.henley)] }, null]],
    ['shipment-left-off', [{ blockOrder: [1042] }]],
    ['repeats-dropped', [{
      blockOrder: [1042, 1042, 1043], sourceRefs: [ref(E.e101, K.rtm), ref(E.e103, K.rtm), ref(E.e106, K.henley)],
    }, SHIPMENT.jomo]],
    ['missing-ids-skipped', [{
      blockOrder: [null, 1042], sourceRefs: [{ packingEntryId: 9, orderId: null }, { packingEntryId: 10 }],
    }, { orders: [{ orderNo: 'SG/26-27/1099', pos: [] }] }]],
    ['order-zero-kept', [{ blockOrder: [0] }, null]],
    ['nothing', [{}, null]],
    ['list-fields-null', [{ blockOrder: null, sourceRefs: null }, SHIPMENT.vgt]],
    ['shipment-without-orders', [{ blockOrder: [1042] }, { id: 7, orders: null }]],
    ['throws/null-list', [null, SHIPMENT.jomo], true],
  ]),
  ...cases(takenBy, [
    ['live-lists-only', [{ packingLists: LISTS }, null]],
    ['except-this-list', [{ packingLists: LISTS }, 32]],
    ['except-left-off', [{ packingLists: LISTS }]],
    ['except-a-list-not-there', [{ packingLists: LISTS }, 99]],
    ['later-live-list-wins', [{ packingLists: [list(41, 'DRAFT', [ref(E.e101, K.rtm)]), list(42, 'FINAL', [ref(E.e101, K.rtm)])] }, null]],
    ['unit-without-a-po-key', [{ packingLists: [list(43, 'DRAFT', [{ packingEntryId: 106, orderId: 1043 }])] }, null]],
    ['list-without-refs', [{ packingLists: [{ id: 50, plNo: 'PKL/26-27/1050', status: 'DRAFT' }] }, null]],
    ['no-lists', [{}, null]],
    ['lists-null', [{ packingLists: null }, null]],
    ['throws/no-db', [null, null], true],
  ]),
  ...cases(unitsOffered, [
    ['jomo-nothing-on-the-list', [DB.jomo, 1042, G.jomo, { meta: META.polo }]],
    ['jomo-bound-taken-and-free', [DB.jomo, 1042, G.jomo, { boundKeys: [unitKeyOf(103, K.rtm)], taken: TAKEN_BY_OTHERS, meta: META.polo }]],
    ['jomo-taken-off-by-hand', [DB.jomo, 1042, G.jomo, {
      excluded: [unitKeyOf(102, K.ham), unitKeyOf(108, K.rtm)], taken: TAKEN_BY_OTHERS, meta: META.polo,
    }]],
    ['jomo-every-po', [DB.jomo, 1042, G.jomoAll, { meta: META.polo }]],
    ['options-left-off', [DB.jomo, 1042, G.jomo]],
    ['empty-options', [DB.jomo, 1042, G.jomo, {}]],
    ['henley-solo-po', [DB.jomo, 1043, G.henley, { taken: TAKEN_BY_OTHERS, meta: META.henley }]],
    ['henley-without-meta-unplaced', [DB.jomo, 1043, G.henley, {}]],
    ['whole-order', [DB.jomo, 1044, G.sweat, { taken: TAKEN_BY_OTHERS, meta: META.sweat }]],
    ['vgt-order-po', [DB.vgt, 1055, G.vgt, { meta: META.vgt }]],
    ['vgt-renamed-po-offers-nothing', [DB.vgt, 1055, G.vgtOld, { meta: META.vgt }]],
    ['prenatal-open-entry', [DB.prenatal, 1061, G.pre, { meta: META.prenatal }]],
    ['order-without-entries', [DB.jomo, 1099, G.jomo, { meta: META.polo }]],
    ['no-entries', [{}, 1042, G.jomo, { meta: META.polo }]],
    ['no-po-groups', [DB.jomo, 1042, [], { meta: META.polo }]],
    ['throws/no-db', [null, 1042, G.jomo], true],
  ]),
  ...cases(planRowsOf, [
    ['order-with-a-plan', [{ plans: { ...PLANS, ...PLANS_SWEAT } }, 1042]],
    ['whole-order-plan', [{ plans: { ...PLANS, ...PLANS_SWEAT } }, 1044]],
    ['order-without-a-plan', [SAVED, 1043]],
    ['plan-without-rows', [{ plans: { 1042: { seq: 2 } } }, 1042]],
    ['rows-null', [{ plans: { 1042: { rows: null, seq: 0 } } }, 1042]],
    ['plan-null', [{ plans: { 1042: null } }, 1042]],
    ['no-plans', [{}, 1042]],
    ['plans-null', [{ plans: null }, 1042]],
    ['order-left-off', [SAVED]],
    ['throws/null-list', [null, 1042], true],
  ]),
  ...cases(planRangesOf, [
    ['one-order-two-pos', [SAVED]],
    ['two-orders', [{ plans: { ...PLANS, ...PLANS_SWEAT } }]],
    ['missing-carton-numbers', [{ plans: { 1042: { rows: [{ ...PLAN_RTM, cartonFrom: null, cartonTo: null }], seq: 1 } } }]],
    ['po-key-left-out-is-the-whole-order', [{ plans: { 1044: { rows: PLANS_SWEAT[1044].rows.map(({ poKey: _k, ...r }) => r), seq: 2 } } }]],
    ['no-plans', [{}]],
    ['plan-without-rows', [{ plans: { 1042: { seq: 4 } } }]],
    ['plans-null', [{ plans: null }]],
    ['throws/null-list', [null], true],
  ]),
  ...cases(applyPlan, [
    ['new-plan', [{}, 1042, JOMO_PLAN_INPUT, G.jomo, META.polo]],
    ['saved-again-keeps-ids-and-not-shipping', [SAVED, 1042, [...PLANS[1042].rows, planInput('tmp-9', 201, 210, PO.rtm, NAVY)], G.jomo, META.polo]],
    ['edited-rows', [SAVED, 1042, [{ ...PLAN_RTM, cartonTo: 160 }, ...PLANS[1042].rows.slice(1, 4)], G.jomo, META.polo]],
    ['row-dropped', [SAVED, 1042, [PLANS[1042].rows[1]], G.jomo, META.polo]],
    ['emptied', [SAVED, 1042, [], G.jomo, META.polo]],
    ['decoration-stripped', [{}, 1042, [{
      ...planInput('tmp-1', 121, 167, PO.rtm, NAVY), cartonCount: 47, piecesPerCarton: 60, totalPieces: 2820, cbm: 0.084,
    }], G.jomo, META.polo]],
    ['po-key-and-not-shipping-are-the-lists', [{}, 1042, [{
      ...planInput('tmp-1', 1, 13, PO.ham, NAVY_HAM), poKey: 'stale', notShipping: { reason: 'Typed into the request' },
    }], G.jomo, META.polo]],
    ['unknown-id-gets-a-new-one', [SAVED, 1042, [{ ...PLAN_RTM, id: 'plan-99' }], G.jomo, META.polo]],
    ['same-id-twice', [SAVED, 1042, [PLAN_RTM, { ...PLAN_RTM, cartonFrom: 300, cartonTo: 310 }], G.jomo, META.polo]],
    ['solo-po', [{}, 1043, [planInput('tmp-1', 1, 12, null, BLACK), planInput('tmp-2', 13, 24, PO.henley, BLACK)], G.henley, META.henley]],
    ['whole-order', [{}, 1044, [planInput('tmp-1', 1, 20, null, GREY), planInput('tmp-2', 21, 30, { buyerPoNo: 'PO-X' }, GREY)], G.sweat, META.sweat]],
    ['two-pos-may-share-numbers', [{}, 1042, [planInput('tmp-1', 1, 40, PO.rtm, NAVY), planInput('tmp-2', 1, 13, PO.ham, NAVY_HAM)], G.jomo, META.polo]],
    ['gaps-and-missing-weights-allowed', [{}, 1042, [planInput('tmp-1', 1, 10, PO.rtm, NAVY), planInput('tmp-2', 20, 30, PO.rtm, NAVY)], G.jomo, META.polo]],
    ['other-orders-plans-kept', [{ plans: PLANS_SWEAT }, 1042, [planInput('tmp-1', 1, 40, PO.rtm, NAVY)], G.jomo, META.polo]],
    ['every-packing-type', [{}, 1042, [
      planInput('tmp-1', 1, 47, PO.rtm, NAVY),
      planInput('tmp-2', 48, 57, PO.rtm, SCARLET_RATIO),
      planInput('tmp-3', 58, 60, PO.rtm, MIXED),
      planInput('tmp-4', 61, 61, PO.rtm, NAVY_EXTRA, { sectionKey: 'EXTRA' }),
      planInput('tmp-5', 1, 24, PO.ham, NAVY_MPB),
    ], G.jomo, META.polo]],
    // Refusals, in the browser's own words
    ['refused/po-not-ticked', [{}, 1042, [planInput('tmp-1', 1, 40, PO.rtm, NAVY), planInput('tmp-2', 41, 50, PO.venlo, NAVY)], G.jomo, META.polo], true],
    ['refused/po-not-on-the-order', [{}, 1042, [planInput('tmp-1', 1, 10, { buyerPoNo: 'PO-999001' }, NAVY)], G.jomo, META.polo], true],
    ['refused/no-po-on-an-order-with-several', [{}, 1042, [planInput('tmp-1', 1, 10, null, NAVY)], G.jomo, META.polo], true],
    ['refused/same-po-two-destinations-none-named', [{}, 1042, [planInput('tmp-1', 1, 10, { buyerPoNo: 'PO-884213' }, NAVY)], G.jomoAll, META.polo], true],
    ['refused/orders-po-not-on-the-shipment', [{}, 1055, [planInput('tmp-1', 1, 10, null, ECRU)], G.vgtOld, META.vgt], true],
    ['refused/po-checked-before-the-cartons', [{}, 1042, [planInput('tmp-1', 40, 1, PO.rtm, NAVY), planInput('tmp-2', 41, 50, PO.venlo, NAVY)], G.jomo, META.polo], true],
    ['refused/po-message-without-numbers', [{}, 1042, [planInput('tmp-1', null, null, PO.venlo, NAVY)], G.jomo, META.polo], true],
    ['refused/incomplete-range', [{}, 1042, [planInput('tmp-1', null, 40, PO.rtm, NAVY)], G.jomo, META.polo], true],
    ['refused/zero-is-incomplete', [{}, 1042, [planInput('tmp-1', 0, 40, PO.rtm, NAVY)], G.jomo, META.polo], true],
    ['refused/backwards-range', [{}, 1042, [planInput('tmp-1', 40, 1, PO.rtm, NAVY)], G.jomo, META.polo], true],
    ['refused/no-pieces', [{}, 1042, [planInput('tmp-1', 1, 40, PO.rtm, { ...NAVY, sizeQty: {} })], G.jomo, META.polo], true],
    ['refused/ratio-without-assortments', [{}, 1042, [planInput('tmp-1', 1, 10, PO.rtm, { ...SCARLET_RATIO, assortmentsPerCarton: null })], G.jomo, META.polo], true],
    ['refused/master-polybag-without-count', [{}, 1042, [planInput('tmp-1', 1, 10, PO.rtm, { ...NAVY_MPB, mpbPerCarton: null })], G.jomo, META.polo], true],
    ['refused/first-rows-error', [{}, 1042, [
      planInput('tmp-1', 1, 40, PO.rtm, { ...NAVY, sizeQty: {} }), planInput('tmp-2', 60, 41, PO.rtm, NAVY),
    ], G.jomo, META.polo], true],
    ['refused/planned-twice', [{}, 1042, [planInput('tmp-1', 1, 40, PO.rtm, NAVY), planInput('tmp-2', 30, 50, PO.rtm, NAVY)], G.jomo, META.polo], true],
    ['refused/planned-twice-first-clash', [{}, 1042, [
      planInput('tmp-1', 1, 100, PO.rtm, NAVY), planInput('tmp-2', 15, 30, PO.rtm, NAVY), planInput('tmp-3', 10, 20, PO.rtm, NAVY),
    ], G.jomo, META.polo], true],
    ['refused/planned-twice-po-named-two-ways', [{}, 1042, [
      planInput('tmp-1', 1, 10, PO.rtm, NAVY), planInput('tmp-2', 5, 15, { buyerPoNo: ' PO-884213 ' }, NAVY),
    ], G.jomo, META.polo], true],
    ['refused/whole-order-planned-twice', [{}, 1044, [planInput('tmp-1', 1, 20, null, GREY), planInput('tmp-2', 15, 30, null, GREY)], G.sweat, META.sweat], true],
    ['throws/null-rows', [{}, 1042, null, G.jomo, META.polo], true],
  ]),
  ...cases(markNotShipping, [
    ['with-a-reason', [SAVED, 1042, 'plan-3', 'Buyer cut the PO by 13 cartons']],
    ['reason-trimmed', [SAVED, 1042, 'plan-5', '   Short shipment agreed by mail   ']],
    ['reason-of-ten-characters', [SAVED, 1042, 'plan-1', 'Cut by 10.']],
    ['reason-with-accents', [SAVED, 1042, 'plan-1', `Client a r${E_ACUTE}duit la commande`]],
    ['reason-replaced', [SAVED, 1042, 'plan-4', 'The buyer moved these cartons to the next shipment']],
    ['shipping-again', [SAVED, 1042, 'plan-4', null]],
    ['reason-left-off-ships-again', [SAVED, 1042, 'plan-4']],
    ['row-not-marked-ships', [SAVED, 1042, 'plan-1', null]],
    ['whole-order-plan', [{ plans: PLANS_SWEAT }, 1044, 'plan-2', 'Second half moves to SHP/26-27/1010']],
    ['refused/nine-characters', [SAVED, 1042, 'plan-3', 'Cut by 9.'], true],
    ['refused/blank', [SAVED, 1042, 'plan-3', '          '], true],
    ['refused/empty', [SAVED, 1042, 'plan-3', ''], true],
    ['refused/short-once-trimmed', [SAVED, 1042, 'plan-3', `${NBSP}Too short${NBSP}`], true],
    ['refused/unknown-row', [SAVED, 1042, 'plan-99', 'Buyer cut the PO by 13 cartons'], true],
    ['refused/row-checked-before-the-reason', [SAVED, 1042, 'plan-99', 'short'], true],
    ['refused/order-without-a-plan', [SAVED, 1043, 'plan-1', 'Buyer cut the PO by 13 cartons'], true],
    ['refused/no-plans', [{}, 1042, 'plan-1', 'Buyer cut the PO by 13 cartons'], true],
    ['refused/row-left-off', [SAVED, 1042], true],
    ['throws/null-list', [null, 1042, 'plan-1', 'Buyer cut the PO by 13 cartons'], true],
  ]),
  ...cases(groupsByOrder, [
    ['jomo-shipment', [PL, SHIPMENT.jomo]],
    ['bound-po-no-longer-on-the-shipment', [{ ...PL, sourceRefs: [...PL.sourceRefs, ref(E.e102, K.venlo)] }, SHIPMENT.jomo]],
    ['planned-po-no-longer-on-the-shipment', [{
      ...PL, plans: { 1042: { rows: [{ ...PLAN_RTM, id: 'plan-7', destination: 'Venlo DC', poKey: K.venlo }], seq: 7 } },
    }, SHIPMENT.jomo]],
    ['orphan-named-once', [{
      ...PL, sourceRefs: [ref(E.e102, K.venlo), ref(E.e104, K.venlo)], plans: { 1042: { rows: [{ ...PLAN_RTM, poKey: K.venlo }], seq: 1 } },
    }, SHIPMENT.jomo]],
    ['whole-order-refs-add-nothing', [{ ...PL, blockOrder: [1044], sourceRefs: [ref(E.e107, null)] }, SHIPMENT.jomo]],
    ['whole-order-with-a-bound-po', [{ ...PL, blockOrder: [1044], sourceRefs: [ref(E.e107, K.rtm)] }, SHIPMENT.jomo]],
    ['order-dropped-from-the-shipment', [WITH_VGT, SHIPMENT.jomo]],
    ['po-renamed-on-the-shipment', [{ ...PL_VGT, sourceRefs: [ref(E.e201, K.vgt)] }, SHIPMENT.vgt]],
    ['no-shipment', [PL, null]],
    ['no-meta-is-the-whole-order', [{ blockOrder: [1043], sourceRefs: [] }, SHIPMENT.jomo]],
    ['unreadable-order-is-the-whole-order', [{ blockOrder: [1043], orderMeta: { 1043: unreadable(1043) } }, SHIPMENT.jomo]],
    ['po-key-of-a-destination-only', [{
      blockOrder: [1044], sourceRefs: [{ packingEntryId: 107, orderId: 1044, poKey: poKey({ destination: 'Rotterdam' }) }],
    }, SHIPMENT.jomo]],
    ['empty-list', [{}, null]],
    ['throws/null-list', [null, SHIPMENT.jomo], true],
  ]),
  ...cases(assemble, [
    ['continue-from-1', [PL, DB.jomo, SHIPMENT.jomo]],
    ['continue-from-101', [{ ...PL, firstCartonNo: 101 }, DB.jomo, SHIPMENT.jomo]],
    ['restart-per-po', [{ ...PL, numbering: 'PER_PO' }, DB.jomo, SHIPMENT.jomo]],
    ['restart-per-style', [{ ...PL, numbering: 'PER_STYLE' }, DB.jomo, SHIPMENT.jomo]],
    ['no-numbering-is-continue', [{ ...PL, numbering: null, firstCartonNo: null }, DB.jomo, SHIPMENT.jomo]],
    ['blocks-moved', [{ ...PL, blockOrder: [1044, 1043, 1042] }, DB.jomo, SHIPMENT.jomo]],
    ['buyers-plan', [PL_PLANNED, DB.jomo, SHIPMENT.jomo]],
    ['buyers-plan-per-po', [{ ...PL_PLANNED, numbering: 'PER_PO' }, DB.jomo, SHIPMENT.jomo]],
    ['unread-entry-keeps-its-rows', [{ ...PL, sections: ASSEMBLED.sections, sizes: ASSEMBLED.sizes },
      { packingEntries: JOMO_ENTRIES.filter((e) => e.id !== 103) }, SHIPMENT.jomo]],
    ['unit-without-cartons-for-its-po', [{ ...PL, sourceRefs: [...PL.sourceRefs, ref(E.e106, K.rtm), ref(E.e101, K.ham)] }, DB.jomo, SHIPMENT.jomo]],
    ['sizes-kept-from-before', [{ ...PL, sizes: ['XS', 'M', 'XXXL'] }, DB.jomo, SHIPMENT.jomo]],
    ['order-dropped-from-the-shipment', [WITH_VGT, { packingEntries: [...JOMO_ENTRIES, E.e201] }, SHIPMENT.jomo]],
    ['bound-order-unreadable', [{ ...WITH_VGT, orderMeta: { ...PL.orderMeta, 1055: unreadable(1055) } },
      { packingEntries: [...JOMO_ENTRIES, E.e201] }, SHIPMENT.jomo]],
    ['po-renamed-under-the-list', [PL_VGT, DB.vgt, SHIPMENT.vgt]],
    ['open-entry-per-po', [PL_PRE, DB.prenatal, SHIPMENT.prenatal]],
    ['nothing-bound', [{ ...PL, sourceRefs: [] }, DB.jomo, SHIPMENT.jomo]],
    ['no-shipment', [PL, DB.jomo, null]],
    ['as-the-packing-mirror-holds-entries', [PL, { packingEntries: JOMO_ENTRIES.map(decorateEntry) }, SHIPMENT.jomo]],
    ['throws/null-list', [null, DB.jomo, SHIPMENT.jomo], true],
    ['throws/no-db', [PL, null, SHIPMENT.jomo], true],
  ]),
  ...cases(breakdownFor, [
    ['ticked-pos-only', [PL, SHIPMENT.jomo]],
    ['none-ticked-every-line', [{ ...PL, blockOrder: [1042] }, { ...SHIPMENT.jomo, orders: [shipOrder(ORDERS.polo, [])] }]],
    ['unreadable-order-gives-nothing', [{ ...PL, orderMeta: { ...PL.orderMeta, 1043: unreadable(1043) } }, SHIPMENT.jomo]],
    ['lines-without-po-dropped-once-pos-are-ticked', [{ blockOrder: [1044], orderMeta: { 1044: META.sweat } },
      { orders: [shipOrder(ORDERS.sweat, [shipPo(PO.rtm)])] }]],
    ['ticked-text-trimmed', [{ blockOrder: [1042], orderMeta: { 1042: META.polo } },
      { orders: [shipOrder(ORDERS.polo, [{ buyerPoNo: ' PO-884214 ', destination: `Hamburg DC${NBSP}` }])] }]],
    ['ticked-without-destination-misses-lines-with-one', [{ blockOrder: [1042], orderMeta: { 1042: META.polo } },
      { orders: [shipOrder(ORDERS.polo, [{ buyerPoNo: 'PO-884214', destination: null }])] }]],
    ['blank-destination-matches-a-line-without-one', [{
      blockOrder: [1044],
      orderMeta: { 1044: { ...META.sweat, orderBreakdown: META.sweat.orderBreakdown.map((l) => ({ ...l, buyerPoNo: 'PO-77' })) } },
    }, { orders: [shipOrder(ORDERS.sweat, [{ buyerPoNo: 'PO-77', destination: '  ' }])] }]],
    ['po-renamed-gives-nothing', [PL_VGT, SHIPMENT.vgt]],
    ['no-shipment-every-line', [PL, null]],
    ['meta-without-a-breakdown', [{ blockOrder: [1042], orderMeta: { 1042: { ...META.polo, orderBreakdown: null } } }, SHIPMENT.jomo]],
    ['no-meta', [{ blockOrder: [1042] }, SHIPMENT.jomo]],
    ['bound-order-not-on-the-shipment', [WITH_VGT, SHIPMENT.jomo]],
    ['throws/null-list', [null, SHIPMENT.jomo], true],
  ]),
];

test('expDocPlBlocks parity fixtures', () => {
  const { count } = writeFixtures('expDocPlBlocks', CASES, { api: API, notPorted: NOT_PORTED });
  expect(count).toBe(CASES.length);
});
