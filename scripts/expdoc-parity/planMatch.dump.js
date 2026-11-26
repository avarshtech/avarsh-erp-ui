// Parity fixtures for src/utils/expDocPlanMatch.js -> erp-purchase PlanMatch (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// A buyer's plan for JOMO's PO-884213 (Rotterdam) in the buyer's carton numbers, against the cartons the
// packing list holds, numbered as they print: packed as planned, partly, differently, not yet, outside the plan,
// and ranges marked Not shipping. Plan rows carry the fields a plan row has (a Carton Packing range, its PO key
// and its Not shipping mark), so the server's echo of a plan row can be compared field for field.
import { test, expect } from 'vitest';
import * as planMatch from '../../src/utils/expDocPlanMatch.js';
import { writeFixtures } from './writeFixtures.js';

const {
  contentDiff, matchPlan, subtractRanges, planChip, rangesText,
} = planMatch;

// The browser's rowsToPack takes an id generator; a function is not data, so a fixture passes the prefix of a
// counter ("t" gives t1, t2 ...) and this adapter builds it before the real call. The Java test builds the same.
const rowsToPack = function rowsToPack(planRow, ranges, idPrefix) {
  let n = 0;
  return planMatch.rowsToPack(planRow, ranges, () => `${idPrefix}${(n += 1)}`);
};
const API = { ...planMatch, rowsToPack };

const SEP = String.fromCharCode(0x241f); // the PO key separator, as expDocPoKeys.js has it
const K_RTM = `PO-884213${SEP}Rotterdam`;

const NAVY = { packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 } };
const BLACK = { packingType: 'SOLID', colorName: 'Black', sizeQty: { M: 12, L: 20, XL: 30 } };
const SCARLET_RATIO = { packingType: 'RATIO', colorName: 'Flame Scarlet 18-1662 TCX', ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4 };
const MIXED = {
  packingType: 'MIXED', colorName: null,
  mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }],
};
const MIXED_SWAPPED = {
  packingType: 'MIXED', colorName: null,
  mixedRows: [{ colorName: ' flame scarlet 18-1662 tcx ', sizeQty: { M: 3, L: 2 } }, { colorName: 'NAVY', sizeQty: { M: 5, L: 5 } }],
};
const WHITE_MPB = { packingType: 'MPB', colorName: 'White', ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8 };

/** A row of the buyer's plan, as expDocPlPlan.applyPlan keeps it. */
const plan = (id, from, to, contents = NAVY, extra = {}) => ({
  id, sectionKey: 'MAIN', ...contents, cartonFrom: from, cartonTo: to, buyerPoNo: 'PO-884213', destination: 'Rotterdam',
  danNo: null, netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35, poKey: K_RTM, notShipping: null,
  ...extra,
});
const NOT_SHIPPING = { notShipping: { reason: 'Buyer cut the PO by 20 cartons' } };

/** A row of the packing list, numbered as it prints. */
const packed = (id, from, to, contents = NAVY, extra = {}) => ({
  id, sectionKey: 'MAIN', ...contents, cartonFrom: from, cartonTo: to, ownFrom: from, ownTo: to, numberGroup: 'list',
  orderId: 1042, orderNo: 'SG/26-27/1042', poKey: K_RTM, buyerPoNo: 'PO-884213', destination: 'Rotterdam', styleNo: 'ST-2026-0441',
  sourceEntryId: 101, sourceEntryNo: 'CPK/26-27/101', packingDate: '2026-10-01', completionFlag: true, ...extra,
});

// ─── contentDiff ──────────────────────────────────────────────────────────────────
const DIFF_CASES = [
  ['same', [plan('p', 1, 10), packed('a', 1, 10)]],
  ['colour-in-any-case-and-spacing', [plan('p', 1, 10), packed('a', 1, 10, { ...NAVY, colorName: ' NAVY ' })]],
  ['colour', [plan('p', 1, 10), packed('a', 1, 10, { ...NAVY, colorName: 'Black' })]],
  ['sizes', [plan('p', 1, 10), packed('a', 1, 10, { ...NAVY, sizeQty: { M: 12, L: 20, XL: 30 } })]],
  ['colour-and-sizes', [plan('p', 1, 10), packed('a', 1, 10, BLACK)]],
  // Compared as JSON text: the same sizes in another order differ (a browser quirk the server keeps)
  ['same-sizes-in-another-order-differ', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 10, L: 20 } }), packed('a', 1, 10, { ...NAVY, sizeQty: { L: 20, M: 10 } })]],
  ['numeric-sizes-in-any-order', [plan('p', 1, 10, { ...NAVY, sizeQty: { 80: 12, 74: 12 } }), packed('a', 1, 10, { ...NAVY, sizeQty: { 74: 12, 80: 12 } })]],
  ['empty-sizes-left-out', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 10, L: 0, XL: null } }), packed('a', 1, 10, { ...NAVY, sizeQty: { M: 10 } })]],
  ['negative-sizes-left-out', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 10, L: -2 } }), packed('a', 1, 10, { ...NAVY, sizeQty: { M: 10 } })]],
  ['fractions-equal', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 2.5 } }), packed('a', 1, 10, { ...NAVY, sizeQty: { M: 2.5 } })]],
  ['fractions-off-by-a-rounding', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 0.1 + 0.2 } }), packed('a', 1, 10, { ...NAVY, sizeQty: { M: 0.3 } })]],
  ['packing-type-only', [plan('p', 1, 10, { ...NAVY, sizeQty: { M: 4, L: 8, XL: 8, XXL: 4 } }), packed('a', 1, 10, { ...SCARLET_RATIO, colorName: 'Navy' })]],
  ['ratio-pack-count', [plan('p', 1, 10, SCARLET_RATIO), packed('a', 1, 10, { ...SCARLET_RATIO, assortmentsPerCarton: 5 })]],
  ['ratio-same', [plan('p', 1, 10, SCARLET_RATIO), packed('a', 1, 10, SCARLET_RATIO)]],
  ['mpb-bags-per-carton', [plan('p', 1, 10, WHITE_MPB), packed('a', 1, 10, { ...WHITE_MPB, mpbPerCarton: 6 })]],
  ['mixed-colours-in-any-order-and-case', [plan('p', 1, 10, MIXED), packed('a', 1, 10, MIXED_SWAPPED)]],
  ['mixed-colours-differ', [plan('p', 1, 10, MIXED), packed('a', 1, 10, {
    ...MIXED, mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Black', sizeQty: { M: 3, L: 2 } }],
  })]],
  ['mixed-plan-solid-carton', [plan('p', 1, 10, MIXED), packed('a', 1, 10)]],
  ['solid-plan-mixed-carton', [plan('p', 1, 10), packed('a', 1, 10, MIXED)]],
  ['no-colour-either-side', [plan('p', 1, 10, { ...NAVY, colorName: null }), packed('a', 1, 10, { ...NAVY, colorName: '  ' })]],
  ['no-packing-type-either-side', [{ cartonFrom: 1, cartonTo: 2, sizeQty: { M: 1 } }, { cartonFrom: 1, cartonTo: 2, sizeQty: { M: 1 } }]],
  ['not-shipping-mark-is-not-content', [plan('p', 1, 10, NAVY, NOT_SHIPPING), packed('a', 1, 10)]],
].map(([id, args]) => ({ id: `contentDiff/${id}`, fn: contentDiff, args }));
DIFF_CASES.push(
  // jsonb returns sizes in its own key order; both sides read sizes that are numbers first
  {
    id: 'contentDiff/jsonb-size-order',
    fn: contentDiff,
    argsJson: '[{"packingType":"SOLID","colorName":"Navy","sizeQty":{"M":1,"104":2}},'
      + '{"packingType":"SOLID","colorName":"Navy","sizeQty":{"104":2,"M":1}}]',
  },
  // A MIXED carton with a hole in its colour rows is a caller's bug: the browser throws on it
  {
    id: 'contentDiff/mixed-hole-throws',
    fn: contentDiff,
    args: [plan('p', 1, 10, MIXED), packed('a', 1, 10, { ...MIXED, mixedRows: [null, { colorName: 'Navy', sizeQty: { M: 1 } }] })],
    throws: true,
  },
);

// ─── matchPlan ────────────────────────────────────────────────────────────────────
const JOMO_PLAN = [
  plan('plan-1', 1, 40),
  plan('plan-2', 41, 47, SCARLET_RATIO),
  plan('plan-3', 48, 60, MIXED),
  plan('plan-4', 61, 80, NAVY, NOT_SHIPPING),
];
const JOMO_PACKED = [
  packed('a', 1, 40),
  packed('b', 41, 47, SCARLET_RATIO),
  packed('c', 48, 55, MIXED_SWAPPED),
  packed('d', 81, 100, NAVY, { sourceEntryId: 102, packingDate: '2026-10-03' }),
];
const UNIT_PLAN = [plan('p1', 1, 40), plan('p2', 41, 80), plan('p3', 81, 90)];
const UNIT_PACKED = [packed('a', 1, 40), packed('b', 41, 60), packed('c', 91, 95)];

const MATCH_CASES = [
  ['packed-partly-not-yet-and-extra', [UNIT_PLAN, UNIT_PACKED]],
  ['differs-and-says-what', [[plan('p1', 1, 10)], [packed('a', 1, 10, BLACK)]]],
  ['jomo-buyer-plan', [JOMO_PLAN, JOMO_PACKED]],
  ['not-shipping-nothing-packed', [[plan('p1', 1, 10, NAVY, NOT_SHIPPING)], []]],
  ['not-shipping-partly-packed-counts-packed', [[plan('p1', 1, 10, NAVY, NOT_SHIPPING)], [packed('a', 1, 4)]]],
  ['not-shipping-fully-packed', [[plan('p1', 1, 10, NAVY, NOT_SHIPPING)], [packed('a', 1, 10)]]],
  ['not-shipping-packed-differently', [[plan('p1', 1, 10, NAVY, NOT_SHIPPING)], [packed('a', 1, 4, BLACK)]]],
  ['one-packed-row-across-two-plan-rows', [[plan('p1', 1, 10), plan('p2', 11, 20, BLACK)], [packed('a', 5, 15)]]],
  ['two-packed-rows-one-differs', [[plan('p1', 1, 20)], [packed('a', 1, 10), packed('b', 11, 20, BLACK)]]],
  ['overlapping-packed-rows-count-once', [[plan('p1', 1, 20)], [packed('a', 1, 12), packed('b', 8, 15)]]],
  ['buyer-numbers-far-from-packed', [[plan('p1', 121, 160)], [packed('a', 1, 20)]]],
  ['touching-plan-rows-leave-extra-between', [[plan('p1', 1, 10), plan('p2', 21, 30)], [packed('a', 1, 30)]]],
  ['mixed-packed-as-planned', [[plan('p1', 1, 3, MIXED)], [packed('a', 1, 3, MIXED_SWAPPED)]]],
  ['single-carton', [[plan('p1', 5, 5)], [packed('a', 5, 5)]]],
  ['no-plan-rows', [[], JOMO_PACKED]],
  ['nothing-packed', [JOMO_PLAN, []]],
  ['packed-rows-without-ranges-ignored', [[plan('p1', 1, 10)], [packed('a', null, 5), packed('b', 9, 3), null, packed('c', 2, 3)]]],
  // A plan row without a range wants carton 0: kept from the browser
  ['plan-row-without-range', [[plan('p1', null, null)], [packed('a', 1, 3)]]],
  ['null-packed-rows', [[plan('p1', 1, 10)], null]],
  ['packed-rows-left-out-is-none', [[plan('p1', 1, 10)]]],
].map(([id, args]) => ({ id: `matchPlan/${id}`, fn: matchPlan, args }));
MATCH_CASES.push(
  { id: 'matchPlan/null-plan-rows-throws', fn: matchPlan, args: [null, JOMO_PACKED], throws: true },
  { id: 'matchPlan/null-plan-row-throws', fn: matchPlan, args: [[null], JOMO_PACKED], throws: true },
);

// ─── subtractRanges ───────────────────────────────────────────────────────────────
const r = (from, to) => ({ from, to });
const SUBTRACT_CASES = [
  ['two-cuts', [[r(1, 20)], [r(5, 8), r(15, 30)]]],
  ['nothing-cut', [[r(1, 20)], []]],
  ['all-cut', [[r(1, 20)], [r(1, 20)]]],
  ['cut-wider', [[r(5, 10)], [r(1, 30)]]],
  ['touching-is-not-cut', [[r(1, 10)], [r(11, 20)]]],
  ['first-carton', [[r(1, 10)], [r(1, 1)]]],
  ['last-carton', [[r(1, 10)], [r(10, 10)]]],
  ['middle-carton', [[r(1, 10)], [r(5, 5)]]],
  ['unsorted-overlapping-sides-merged', [[r(10, 20), r(1, 12), r(30, 35)], [r(33, 40), r(2, 3), r(3, 4)]]],
  ['several-ranges-several-cuts', [[r(1, 10), r(20, 30), r(40, 50)], [r(5, 25), r(45, 45)]]],
  ['unsound-ranges-left-out', [[r(1, 10), r(9, 4), { from: null, to: 5 }, null], [r(3, 3), r(8, 2), { from: 6 }]]],
  ['row-ranges-lose-their-rows', [[{ from: 1, to: 10, rowId: 'a', row: packed('a', 1, 10) }], [{ from: 4, to: 6, rowId: 'b', row: packed('b', 4, 6) }]]],
  ['below-one-kept', [[r(-3, 2)], [r(0, 0)]]],
  ['near-int-max', [[r(2147483600, 2147483647)], [r(2147483647, 2147483647), r(2147483600, 2147483600)]]],
  ['null-a', [null, [r(1, 2)]]],
  ['null-b', [[r(4, 6), r(1, 2)], null]],
].map(([id, args]) => ({ id: `subtractRanges/${id}`, fn: subtractRanges, args }));

// ─── planChip ─────────────────────────────────────────────────────────────────────
const CHIP_CASES = [
  ['partly', [matchPlan(UNIT_PLAN, UNIT_PACKED)]],
  ['jomo', [matchPlan(JOMO_PLAN, JOMO_PACKED)]],
  ['all-packed', [matchPlan([plan('p1', 1, 40)], [packed('a', 1, 40)])]],
  ['differs', [matchPlan([plan('p1', 1, 10), plan('p2', 11, 20)], [packed('a', 1, 10, BLACK), packed('b', 11, 20, BLACK)])]],
  ['not-shipping-not-planned', [matchPlan([plan('p1', 1, 10), plan('p2', 11, 20, NAVY, NOT_SHIPPING)], [packed('a', 1, 10)])]],
  ['nothing-packed', [matchPlan(JOMO_PLAN, [])]],
  ['no-rows', [{ rows: [], extra: [r(1, 5)] }]],
  ['overlapping-to-pack-counted-once', [{
    rows: [{ plan: plan('p1', 1, 15), status: 'PARTLY_PACKED', toPack: [r(1, 10), r(5, 12)], differs: [], packedCartons: 3, plannedCartons: 15 }],
    extra: [],
  }]],
].map(([id, args]) => ({ id: `planChip/${id}`, fn: planChip, args }));

// ─── rowsToPack ───────────────────────────────────────────────────────────────────
const TO_PACK_CASES = [
  ['one-range', [plan('p1', 1, 40), [r(21, 40)], 't']],
  ['ids-in-range-order', [plan('p1', 1, 40), [r(1, 5), r(8, 8), r(20, 30)], 'pack-']],
  ['no-ranges', [plan('p1', 1, 40), [], 't']],
  ['not-shipping-and-po-key-not-carried', [plan('p4', 61, 80, NAVY, NOT_SHIPPING), [r(61, 80)], 'n']],
  ['mixed-plan-row', [plan('p3', 48, 60, MIXED, { articleNos: { M: 'ART-1', L: 'ART-2' } }), [r(56, 60)], 'm']],
  ['ranges-as-given', [plan('p1', 1, 40), [r(30, 21), r(5, 5), r(1, 10), r(1, 10)], 'g']],
  ['complete-plan-row-is-not-complete', [plan('p1', 1, 40, NAVY, { completionFlag: true, remarks: 'as per buyer PL' }), [r(1, 2)], 'c']],
  ['null-plan-row-gives-bare-rows', [null, [r(1, 2)], 'x']],
  ['null-id-prefix', [plan('p1', 1, 40), [r(1, 2)], null]],
].map(([id, args]) => ({ id: `rowsToPack/${id}`, fn: rowsToPack, args }));
TO_PACK_CASES.push({ id: 'rowsToPack/null-ranges-throws', fn: rowsToPack, args: [plan('p1', 1, 40), null, 't'], throws: true });

// ─── rangesText ───────────────────────────────────────────────────────────────────
const TEXT_CASES = [
  ['to-pack', [matchPlan(UNIT_PLAN, UNIT_PACKED).rows[1].toPack]],
  ['unsorted-overlapping', [[r(60, 63), r(1, 47), r(40, 50), r(52, 52)]]],
  ['single-carton', [[r(7, 7)]]],
  ['extra', [matchPlan(JOMO_PLAN, JOMO_PACKED).extra]],
  ['empty', [[]]],
  ['null', [null]],
].map(([id, args]) => ({ id: `rangesText/${id}`, fn: rangesText, args }));

const CASES = [...DIFF_CASES, ...MATCH_CASES, ...SUBTRACT_CASES, ...CHIP_CASES, ...TO_PACK_CASES, ...TEXT_CASES];

test('expDocPlanMatch parity fixtures', () => {
  const { count } = writeFixtures('expDocPlanMatch', CASES, { api: API });
  expect(count).toBe(CASES.length);
});
