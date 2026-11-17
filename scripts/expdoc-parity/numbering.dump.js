// Parity fixtures for src/utils/expDocPlNumbering.js -> erp-purchase PlNumbering (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The rows are packing-list rows as expDocPlBlocks.rowsOfUnit builds them: three orders (JOMO, VGT, Prenatal),
// their buyer POs, and Carton Packing entries packed on different days whose own carton numbers clash (most
// entries start at 1 again), plus buyer plans in the buyer's absolute numbers. Fixed data: nothing depends on
// today's date.
import { test, expect } from 'vitest';
import * as numbering from '../../src/utils/expDocPlNumbering.js';
import { writeFixtures } from './writeFixtures.js';

const {
  NUMBERING, groupKeyOf, groupsCollide, planKeyOf, rowsByGroup, groupCartonCount, rangeLabelOf, distinctCartonsOf,
} = numbering;

// The browser passes the buyer's plans as a Map (planKeyOf -> planned ranges). JSON has no Map, so a fixture
// writes them as an object with the same keys and this adapter makes the Map again before the real call; the
// Java test reads the object as a Map. Options and plans left out stay left out (the browser's defaults), and a
// null stays null.
const printedRows = function printedRows(rows, segments, ...options) {
  if (!options.length) return numbering.printedRows(rows, segments);
  const [opts] = options;
  if (opts?.plans == null) return numbering.printedRows(rows, segments, opts);
  return numbering.printedRows(rows, segments, { ...opts, plans: new Map(Object.entries(opts.plans)) });
};
const API = { ...numbering, printedRows };

const SEP = String.fromCharCode(0x241f); // the PO key separator, as expDocPoKeys.js has it
const NBSP = String.fromCharCode(0xa0);
const E_ACUTE = String.fromCharCode(0xe9);
const COMBINING_ACUTE = String.fromCharCode(0x301);
const SHARP_S = String.fromCharCode(0xdf);
const O_STROKE = String.fromCharCode(0xf8);
const EN_DASH = String.fromCharCode(0x2013);
const RIGHT_QUOTE = String.fromCharCode(0x2019);

const poKeyOf = (po) => `${po.buyerPoNo ?? ''}${SEP}${po.destination ?? ''}`;

const ORDER = {
  jomo: { orderId: 1042, orderNo: 'SG/26-27/1042', styleNo: 'ST-2026-0441', garmentName: "Men's Slim Fit Polo", compositionText: '95% COTTON 5% ELASTANE' },
  vgt: { orderId: 1055, orderNo: 'SG/26-27/1055', styleNo: 'ST-2026-0512', garmentName: "Girls' Printed Tee", compositionText: '100% ORGANIC COTTON' },
  prenatal: { orderId: 1061, orderNo: 'SG/26-27/1061', styleNo: 'ST-2026-0588', garmentName: 'Baby 3-pack Bodysuit', compositionText: '100% COTTON INTERLOCK' },
};
const PO = {
  rtm: { buyerPoNo: 'PO-884213', destination: 'Rotterdam' },
  ham: { buyerPoNo: 'PO-884214', destination: 'Hamburg DC' },
  vgt: { buyerPoNo: 'VGT-2026-771', destination: 'Antwerp' },
  pre: { buyerPoNo: 'PRE-55120', destination: 'Rotterdam' },
};
const K = { rtm: poKeyOf(PO.rtm), ham: poKeyOf(PO.ham), vgt: poKeyOf(PO.vgt), pre: poKeyOf(PO.pre) };

const NAVY = { packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 } };
const SCARLET_RATIO = { packingType: 'RATIO', colorName: 'Flame Scarlet 18-1662 TCX', ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4 };
const ECRU = { packingType: 'SOLID', colorName: 'Ecru', sizeQty: { 74: 12, 80: 12, 86: 12 } };
const WHITE_MPB = { packingType: 'MPB', colorName: 'White', ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8 };
const MIXED = {
  packingType: 'MIXED', colorName: null,
  mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }],
};

/** A packing-list row as rowsOfUnit builds it: the entry's range and contents, its order, PO and entry. */
const row = (order, po, entry, from, to, contents = NAVY, extra = {}) => {
  const poKey = po ? poKeyOf(po) : null;
  return {
    id: `${entry.id}:${poKey ?? '-'}:MAIN:${from}-${to}`,
    sectionKey: 'MAIN',
    netWeightKg: 12.48,
    grossWeightKg: 13.5,
    lengthCm: 60,
    breadthCm: 40,
    heightCm: 35,
    completionFlag: true,
    ...contents,
    ...extra,
    cartonFrom: from,
    cartonTo: to,
    ownFrom: from,
    ownTo: to,
    orderId: order.orderId,
    orderNo: order.orderNo,
    poKey,
    buyerPoNo: po?.buyerPoNo ?? null,
    destination: po?.destination ?? null,
    styleNo: order.styleNo,
    garmentName: order.garmentName,
    compositionText: order.compositionText,
    sourceEntryId: entry.id,
    sourceEntryNo: `CPK/26-27/${entry.id}`,
    sourceGroupId: entry.id * 100 + from,
    packingDate: entry.date,
  };
};
const seg = (order, po) => ({ orderId: order.orderId, poKey: po ? poKeyOf(po) : null, buyerPoNo: po?.buyerPoNo ?? null });

// Carton Packing entries: the packing day of each, and its own carton numbers per PO
const E = {
  e101: { id: 101, date: '2026-10-01' },
  e102: { id: 102, date: '2026-10-03' },
  e103: { id: 103, date: '2026-10-02' },
  e104: { id: 104, date: '2026-10-05' },
  e105: { id: 105, date: '2026-10-05' },
  e106: { id: 106, date: null },
  e107: { id: 107, date: '2026-10-04' },
  e108: { id: 108, date: '2026-10-04' },
  e109: { id: 109, date: '2026-10-20' },
  e110: { id: 110, date: '2026-10-06' },
};
const R = {
  e101rtmSolid: row(ORDER.jomo, PO.rtm, E.e101, 1, 40),
  e101rtmRatio: row(ORDER.jomo, PO.rtm, E.e101, 41, 47, SCARLET_RATIO),
  e101ham: row(ORDER.jomo, PO.ham, E.e101, 48, 60),
  e102rtm: row(ORDER.jomo, PO.rtm, E.e102, 1, 20),
  e102ham: row(ORDER.jomo, PO.ham, E.e102, 1, 10),
  e103rtm: row(ORDER.jomo, PO.rtm, E.e103, 61, 70, MIXED),
  e104a: row(ORDER.vgt, PO.vgt, E.e104, 1, 300, ECRU),
  e104b: row(ORDER.vgt, PO.vgt, E.e104, 301, 360, ECRU, { colorName: 'Dusty Rose' }),
  e105: row(ORDER.vgt, PO.vgt, E.e105, 1, 50, ECRU),
  e106: row(ORDER.prenatal, PO.pre, E.e106, 1, 24, WHITE_MPB),
  e107: row(ORDER.prenatal, PO.pre, E.e107, 25, 36, WHITE_MPB),
  e108: row(ORDER.prenatal, PO.pre, E.e108, 1, 12, WHITE_MPB),
  e109: row(ORDER.vgt, PO.vgt, E.e109, 61, 100, ECRU),
  e110: row(ORDER.prenatal, PO.rtm, E.e110, 1, 15, WHITE_MPB),
};
const SEGMENTS = [seg(ORDER.jomo, PO.rtm), seg(ORDER.jomo, PO.ham), seg(ORDER.vgt, PO.vgt), seg(ORDER.prenatal, PO.pre), seg(ORDER.prenatal, PO.rtm)];
const NO_CLASH = [R.e101rtmSolid, R.e101rtmRatio, R.e101ham, R.e104a, R.e104b, R.e107];
const CLASHING = [R.e102rtm, R.e101rtmSolid, R.e103rtm, R.e101rtmRatio, R.e102ham, R.e101ham];

// A lean row for the edge cases: only what the numbering reads, plus an id
const lean = (id, orderId, poKey, cartonFrom, cartonTo, sourceEntryId, packingDate, extra = {}) => ({
  id, orderId, poKey, cartonFrom, cartonTo, sourceEntryId, packingDate, packingType: 'SOLID', sizeQty: { M: 10 }, ...extra,
});
const LEAN_SEGMENTS = [{ orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' }, { orderId: 1, poKey: 'B', buyerPoNo: 'PO-B' }, { orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' }];

// Packing dates that only String.prototype.localeCompare can order: case, accents (composed and decomposed),
// spaces, punctuation, digits against letters, the empty string and null. Every entry starts at carton 1, so the
// entries stack in date order and the printed numbers show the order. Entry ids run against the listing, so two
// dates the browser calls equal fall back to the entry id visibly.
const ODD_DATES = [
  '2026-10-01', '2026-10-1', '2026-9-30', '2026-10-01T09:00', '2026-10-01 09:00', '01-Oct-2026', '01-oct-2026', '01 Oct 2026',
  'Navy Blue', 'NavyBlue', 'Navy-Blue', 'navy blue', 'Navy_Blue', 'Navy/Blue', `Navy${NBSP}Blue`, 'ST/2026', 'ST-2026', 'ST_2026', 'ST 2026',
  `Pr${E_ACUTE}natal`, `Pre${COMBINING_ACUTE}natal`, 'Prenatal', 'PRENATAL', 'prenatal', '', null, ' ', 'a', 'A', 'b', '1', '10', '9',
  `Wei${SHARP_S}`, 'Weiss', `M${O_STROKE}rk`, 'Mork', `a${EN_DASH}b`, 'a-b', `Men${RIGHT_QUOTE}s`, "Men's", 'Mens',
];
const oddEntries = (dates, firstId) => dates.map((date, i) => lean(`d${i}`, 1, 'A', 1, 2, firstId + dates.length - i, date));

/** A planned range as expDocPlPlan.planRangesOf gives it, with its plan row. */
const planRow = (id, from, to, contents = NAVY, extra = {}) => ({
  id, sectionKey: 'MAIN', ...contents, cartonFrom: from, cartonTo: to, buyerPoNo: PO.rtm.buyerPoNo, destination: PO.rtm.destination,
  poKey: K.rtm, notShipping: null, ...extra,
});
const planned = (plan) => ({ from: Number(plan.cartonFrom), to: Number(plan.cartonTo), notShipping: Boolean(plan.notShipping), plan });
const plansFor = (entries) => Object.fromEntries(entries.map(([orderId, poKey, ranges]) => [planKeyOf(orderId, poKey), ranges]));

const leanPlan = (orderId, poKey, ranges) => plansFor([[orderId, poKey, ranges]]);
const PLAN_SEGMENTS = [{ orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' }, { orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' }];
const navyLean = { packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10 } };

const PRINTED_CASES = [
  // ─── Continue across the shipment ───
  ['continue/one-series', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE }]],
  ['continue/defaults', [NO_CLASH, SEGMENTS]],
  ['continue/empty-options', [NO_CLASH, SEGMENTS, {}]],
  ['continue/first-carton-no', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 91 }]],
  ['continue/first-carton-no-as-text', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: '91' }]],
  ['continue/first-carton-no-zero-is-one', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 0 }]],
  ['continue/first-carton-no-negative-is-one', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: -5 }]],
  ['continue/first-carton-no-null-is-one', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: null }]],
  ['continue/first-carton-no-blank-is-one', [NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: '' }]],
  // ─── Clashing entries stack in packing-date order ───
  ['clash/stacked-by-packing-date', [CLASHING, SEGMENTS, { rule: NUMBERING.CONTINUE }]],
  ['clash/same-date-by-entry-id', [[R.e105, R.e104a, R.e104b], SEGMENTS, { rule: NUMBERING.CONTINUE }]],
  ['clash/no-date-sorts-first', [[R.e108, R.e106, R.e107], SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['clash/entry-keeps-its-gaps', [[
    lean('x1', 1, 'A', 1, 10, 10, '2026-10-01'), lean('x2', 1, 'A', 14, 20, 10, '2026-10-01'), lean('y', 1, 'A', 1, 5, 11, '2026-10-02'),
  ], LEAN_SEGMENTS, { rule: NUMBERING.CONTINUE }]],
  ['clash/entry-overlapping-itself-keeps-it', [[
    lean('x1', 1, 'A', 1, 10, 10, '2026-10-01'), lean('x2', 1, 'A', 5, 12, 10, '2026-10-01'), lean('y', 1, 'A', 1, 3, 11, '2026-10-02'),
  ], LEAN_SEGMENTS]],
  ['clash/rows-without-an-entry-are-one-entry', [[
    lean('n1', 1, 'A', 1, 5, null, '2026-10-02'), lean('n2', 1, 'A', 1, 3, null, '2026-10-01'), lean('z', 1, 'A', 1, 4, 0, '2026-10-01'),
  ], LEAN_SEGMENTS]],
  ['clash/packing-dates-in-browser-order', [oddEntries(ODD_DATES, 200), LEAN_SEGMENTS]],
  ['clash/packing-dates-reversed', [oddEntries([...ODD_DATES].reverse(), 300), LEAN_SEGMENTS]],
  // ─── Own numbers kept ───
  ['own/gaps-kept-while-no-clash', [[lean('x', 1, 'A', 1, 10, 10, '2026-10-01'), lean('y', 1, 'A', 14, 20, 11, '2026-10-02')], LEAN_SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['own/touching-ranges-do-not-clash', [[lean('x', 1, 'A', 1, 10, 10, '2026-10-02'), lean('y', 1, 'A', 11, 20, 11, '2026-10-01')], LEAN_SEGMENTS]],
  ['own/single-carton', [[lean('one', 1, 'A', 7, 7, 10, '2026-10-01')], LEAN_SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['own/carton-numbers-when-no-own-numbers', [[
    { id: 'p', orderId: 1, poKey: 'A', cartonFrom: 5, cartonTo: 9, sourceEntryId: 3 },
    { id: 'q', orderId: 1, poKey: 'A', cartonFrom: 12, cartonTo: 12, ownFrom: null, ownTo: null, sourceEntryId: 3 },
  ], LEAN_SEGMENTS]],
  // ─── Restart rules ───
  ['per-po/part-po-restarts-at-1', [[R.e109], SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['per-po/each-po-from-1', [NO_CLASH, SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['per-po/po-across-two-styles-continues', [[R.e101rtmSolid, R.e101rtmRatio, R.e110, R.e106], SEGMENTS, { rule: NUMBERING.PER_PO }]],
  ['per-po/order-without-pos', [[
    lean('w1', 5, null, 1, 10, 50, '2026-10-01'), lean('w2', 5, undefined, 11, 12, 51, '2026-10-02'),
  ], [{ orderId: 5, poKey: null, buyerPoNo: null }], { rule: NUMBERING.PER_PO }]],
  ['per-style/each-order-from-1', [[...CLASHING, R.e104a, R.e104b, R.e105, R.e107, R.e110], SEGMENTS, { rule: NUMBERING.PER_STYLE }]],
  ['per-style/first-carton-no-ignored', [NO_CLASH, SEGMENTS, { rule: NUMBERING.PER_STYLE, firstCartonNo: 91 }]],
  // A rule the browser does not know numbers one series, but from 1: firstCartonNo counts for CONTINUE only
  ['rule/unknown-is-one-series-from-1', [NO_CLASH, SEGMENTS, { rule: 'BOGUS', firstCartonNo: 91 }]],
  ['rule/null-is-one-series-from-1', [NO_CLASH, SEGMENTS, { rule: null, firstCartonNo: 91 }]],
  ['rule/lower-case-is-unknown', [NO_CLASH, SEGMENTS, { rule: 'per_po' }]],
  // ─── What is left out ───
  ['left-out/rows-of-no-segment', [[...NO_CLASH, lean('stray', 9999, 'A', 1, 5, 1, '2026-10-01'), { ...R.e110, poKey: 'gone' }], SEGMENTS]],
  ['left-out/rows-without-a-sound-range', [[
    lean('ok', 1, 'A', 3, 4, 1, '2026-10-01'), lean('noFrom', 1, 'A', null, 5, 1, '2026-10-01'), lean('backwards', 1, 'A', 9, 2, 1, '2026-10-01'),
    lean('zero', 1, 'A', 0, 4, 1, '2026-10-01'), lean('negative', 1, 'A', -3, 4, 1, '2026-10-01'),
  ], LEAN_SEGMENTS]],
  ['left-out/null-rows', [null, SEGMENTS]],
  ['left-out/no-segments', [NO_CLASH, []]],
  ['left-out/null-segment-without-rows', [null, [null], { rule: NUMBERING.PER_PO }]],
  // ─── Renumbering printed rows reads the packers' numbers, not the printed ones ───
  ['renumber/printed-rows-again', [numbering.printedRows(CLASHING, SEGMENTS, { rule: NUMBERING.PER_PO }), SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 11 }]],
  // ─── The buyer's plan ───
  ['plan/as-planned-keeps-numbers-next-order-continues', [
    [lean('a', 1, 'A', 121, 160, 1, '2026-10-01'), lean('c', 2, 'C', 1, 10, 2, '2026-10-01')], PLAN_SEGMENTS,
    { rule: NUMBERING.CONTINUE, plans: leanPlan(1, 'A', [{ from: 121, to: 160 }]) }]],
  ['plan/packed-before-fills-free-numbers-in-date-order', [
    [lean('asPlan', 1, 'A', 141, 160, 3, '2026-10-03'), lean('early', 1, 'A', 1, 20, 1, '2026-10-01'), lean('more', 1, 'A', 1, 5, 2, '2026-10-02')],
    PLAN_SEGMENTS, { rule: NUMBERING.CONTINUE, plans: leanPlan(1, 'A', [{ from: 121, to: 160 }]) }]],
  ['plan/two-entries-at-1-never-share', [
    [lean('b', 1, 'A', 1, 10, 2, '2026-10-02'), lean('a', 1, 'A', 1, 10, 1, '2026-10-01')], PLAN_SEGMENTS,
    { rule: NUMBERING.CONTINUE, plans: leanPlan(1, 'A', [{ from: 1, to: 40 }]) }]],
  ['plan/holding-what-the-plan-says-keeps-the-numbers', [
    [lean('asPlan', 1, 'A', 1, 10, 3, '2026-10-03', navyLean), lean('early', 1, 'A', 1, 10, 1, '2026-10-01', { ...navyLean, colorName: 'Black' })],
    PLAN_SEGMENTS, { rule: NUMBERING.CONTINUE, plans: leanPlan(1, 'A', [planned(planRow('p1', 1, 20, navyLean))]) }]],
  ['plan/not-shipping-numbers-never-handed-out', [
    [lean('asPlan', 1, 'A', 1, 10, 3, '2026-10-03'), lean('early', 1, 'A', 1, 5, 1, '2026-10-04')], PLAN_SEGMENTS,
    { rule: NUMBERING.CONTINUE, plans: leanPlan(1, 'A', [{ from: 1, to: 10 }, { from: 11, to: 20, notShipping: true }]) }]],
  ['plan/jomo-plan-with-contents', [
    [R.e101rtmSolid, R.e101rtmRatio, R.e102rtm, R.e103rtm, R.e101ham], SEGMENTS,
    {
      rule: NUMBERING.CONTINUE,
      plans: plansFor([[ORDER.jomo.orderId, K.rtm, [
        planned(planRow('plan-1', 1, 40)),
        planned(planRow('plan-2', 41, 47, SCARLET_RATIO)),
        planned(planRow('plan-3', 48, 60, MIXED)),
        planned(planRow('plan-4', 61, 80, NAVY, { notShipping: { reason: 'Buyer cut the PO by 20 cartons' } })),
      ]]]),
    }]],
  ['plan/mixed-colours-in-any-order-hold-the-plan', [
    [lean('m', 1, 'A', 1, 3, 1, '2026-10-02', {
      packingType: 'MIXED', mixedRows: [{ colorName: ' flame scarlet 18-1662 tcx', sizeQty: { M: 3, L: 2 } }, { colorName: 'NAVY', sizeQty: { M: 5, L: 5 } }],
    }), lean('first', 1, 'A', 1, 2, 0, '2026-10-01', { packingType: 'MIXED', mixedRows: [{ colorName: 'Navy', sizeQty: { M: 10 } }] })],
    PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [planned(planRow('p1', 1, 5, MIXED))]) }]],
  ['plan/restart-per-po-continues-after-the-plan', [[R.e101rtmSolid, R.e110], SEGMENTS, {
    rule: NUMBERING.PER_PO, plans: plansFor([[ORDER.jomo.orderId, K.rtm, [{ from: 121, to: 160 }]]]),
  }]],
  ['plan/first-carton-no-ignored-after-a-plan', [
    [lean('a', 1, 'A', 1, 40, 1, '2026-10-01'), lean('c', 2, 'C', 1, 10, 2, '2026-10-01')], PLAN_SEGMENTS,
    { rule: NUMBERING.CONTINUE, firstCartonNo: 91, plans: leanPlan(1, 'A', [{ from: 1, to: 40 }]) }]],
  ['plan/below-the-cursor-keeps-the-cursor', [
    [lean('c', 2, 'C', 1, 50, 2, '2026-10-01'), lean('a', 1, 'A', 1, 10, 1, '2026-10-01')],
    [{ orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' }, { orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' }, { orderId: 3, poKey: 'D', buyerPoNo: 'PO-D' }],
    { plans: leanPlan(1, 'A', [{ from: 1, to: 10 }]) }]],
  ['plan/outside-the-plan-prints-after-it', [
    [lean('in', 1, 'A', 1, 40, 1, '2026-10-01'), lean('out', 1, 'A', 200, 210, 2, '2026-10-02'), lean('straddles', 1, 'A', 35, 45, 3, '2026-10-03')],
    PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 40 }]) }]],
  ['plan/straddling-row-takes-free-numbers-that-fit', [
    [lean('in', 1, 'A', 1, 10, 1, '2026-10-01'), lean('straddles', 1, 'A', 35, 45, 3, '2026-10-03'), lean('small', 1, 'A', 99, 100, 4, '2026-10-04')],
    PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 40 }]) }]],
  ['plan/touching-planned-ranges-merge', [
    [lean('across', 1, 'A', 18, 25, 1, '2026-10-01')], PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 20 }, { from: 21, to: 40 }]) }]],
  // Kept from the browser: against a plan a row's own range need not be sound
  ['plan/unsound-own-ranges', [
    [lean('asPlan', 1, 'A', 1, 5, 1, '2026-10-01'), lean('noNumbers', 1, 'A', null, null, 2, '2026-10-02'),
      lean('backwards', 1, 'A', 9, 7, 3, '2026-10-03'), lean('late', 1, 'A', 1, 3, 4, '2026-10-04')],
    PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 10 }]) }]],
  ['plan/backwards-row-past-the-plan-moves-the-top-back', [
    [lean('full', 1, 'A', 1, 10, 1, '2026-10-01'), lean('backwards', 1, 'A', 20, 15, 2, '2026-10-02'),
      lean('later', 1, 'A', 1, 3, 3, '2026-10-03'), lean('next', 2, 'C', 1, 5, 4, '2026-10-01')],
    PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 10 }]) }]],
  ['plan/no-usable-range-prints-no-numbers', [
    [lean('b', 1, 'A', 1, 10, 2, '2026-10-02'), lean('a', 1, 'A', 1, 10, 1, '2026-10-01'), lean('c', 2, 'C', 1, 4, 3, '2026-10-01')],
    PLAN_SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 50, plans: leanPlan(1, 'A', [{ from: null, to: null }, { from: 9, to: 3 }]) }]],
  ['plan/for-a-segment-without-rows', [[lean('c', 2, 'C', 1, 4, 3, '2026-10-01')], PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 40 }]) }]],
  ['plan/empty-plan-is-no-plan', [[lean('a', 1, 'A', 5, 9, 1, '2026-10-01')], PLAN_SEGMENTS, { plans: leanPlan(1, 'A', []) }]],
  ['plan/leftovers-in-browser-date-order', [oddEntries(ODD_DATES.slice(8, 30), 400), PLAN_SEGMENTS, { plans: leanPlan(1, 'A', [{ from: 1, to: 2 }]) }]],
];

const CASES = [
  ...PRINTED_CASES.map(([id, args]) => ({ id: `printedRows/${id}`, fn: printedRows, args })),
  // A null plan map is a caller's bug: the browser throws on it once a segment has rows, and so must the server
  { id: 'printedRows/plan/null-plans-throws', fn: printedRows, args: [NO_CLASH, SEGMENTS, { plans: null }], throws: true },
  { id: 'printedRows/null-segments-throws', fn: printedRows, args: [NO_CLASH, null], throws: true },
  { id: 'printedRows/null-row-throws', fn: printedRows, args: [[null], SEGMENTS], throws: true },
  { id: 'printedRows/null-segment-with-rows-throws', fn: printedRows, args: [NO_CLASH, [null]], throws: true },
  // jsonb returns sizes in its own key order; the row is carried as it came
  {
    id: 'printedRows/jsonb-size-order-carried',
    fn: printedRows,
    argsJson: '[[{"id":"j","orderId":1,"poKey":"A","cartonFrom":1,"cartonTo":2,"sizeQty":{"L":3,"M":1,"104":2}}],'
      + '[{"orderId":1,"poKey":"A","buyerPoNo":"PO-A"}],{"rule":"PER_PO"}]',
  },
];

const S = { rtm: seg(ORDER.jomo, PO.rtm), vgt: seg(ORDER.vgt, PO.vgt) };
CASES.push(...[
  ['continue', [NUMBERING.CONTINUE, S.rtm]],
  ['per-po', [NUMBERING.PER_PO, S.rtm]],
  ['per-style', [NUMBERING.PER_STYLE, S.vgt]],
  ['per-po-without-po', [NUMBERING.PER_PO, { orderId: 5, poKey: null, buyerPoNo: null }]],
  ['per-po-po-with-colon', [NUMBERING.PER_PO, { orderId: 5, poKey: 'x', buyerPoNo: 'PO:77' }]],
  ['per-style-without-order', [NUMBERING.PER_STYLE, { orderId: null, poKey: null, buyerPoNo: 'PO-A' }]],
  ['unknown-rule', ['BOGUS', S.rtm]],
  ['null-rule', [null, S.rtm]],
  ['continue-needs-no-segment', [NUMBERING.CONTINUE, null]],
].map(([id, args]) => ({ id: `groupKeyOf/${id}`, fn: groupKeyOf, args })));
CASES.push({ id: 'groupKeyOf/per-po-null-segment-throws', fn: groupKeyOf, args: [NUMBERING.PER_PO, null], throws: true });

CASES.push(...[
  ['same-po', ['po:PO-A', 'po:PO-A']],
  ['two-pos', ['po:PO-A', 'po:PO-B']],
  ['two-styles', ['order:1042', 'order:1055']],
  ['same-style', ['order:1042', 'order:1042']],
  ['list-and-po', ['list', 'po:PO-B']],
  ['po-and-list', ['po:PO-B', 'list']],
  ['list-and-list', ['list', 'list']],
  ['po-and-style', ['po:PO-A', 'order:7']],
  ['po-without-number-and-po', ['po:', 'po:PO-A']],
  ['po-number-with-colon', ['po:PO:1', 'po:PO:2']],
  ['no-group-and-po', ['_', 'po:PO-A']],
  ['no-group-and-no-group', ['_', '_']],
  ['null-and-null', [null, null]],
  ['null-and-po', [null, 'po:PO-A']],
  ['null-and-text-null', [null, 'null:x']],
  ['colons-only', ['::', ':x']],
  ['empty-and-empty-kind', ['', ':y']],
].map(([id, args]) => ({ id: `groupsCollide/${id}`, fn: groupsCollide, args })));

CASES.push(...[
  ['order-and-po', [1042, K.rtm]],
  ['order-without-po', [1042, null]],
  ['empty-po-key', [1042, '']],
  ['null-order', [null, 'A']],
  ['lean', [1, 'A']],
  ['zero-order', [0, 'A']],
  ['large-order', [2147483647, K.vgt]],
  ['key-with-pipe', [7, 'PO|1']],
].map(([id, args]) => ({ id: `planKeyOf/${id}`, fn: planKeyOf, args })));

// Rows as printed lists hold them
const PRINTED_PER_PO = numbering.printedRows([...CLASHING, R.e104a, R.e104b, R.e105, R.e106, R.e107, R.e108, R.e110], SEGMENTS, { rule: NUMBERING.PER_PO });
const PRINTED_PER_STYLE = numbering.printedRows([...CLASHING, R.e104a, R.e105, R.e107, R.e110], SEGMENTS, { rule: NUMBERING.PER_STYLE });
const PRINTED_CONTINUE = numbering.printedRows(NO_CLASH, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 11 });
const UNGROUPED = [lean('u2', 1, 'A', 30, 31, 1, null), lean('u1', 1, 'A', 1, 4, 1, null), { ...lean('g', 1, 'A', 5, 6, 1, null), numberGroup: 'po:PO-A' }];
const SHUFFLED = [...PRINTED_PER_PO].reverse();
const NO_START = [{ id: 'a', numberGroup: 'po:X', cartonFrom: 5, cartonTo: 6 }, { id: 'b', numberGroup: 'po:X', cartonFrom: null, cartonTo: 3 }, { id: 'c', numberGroup: 'po:X', cartonFrom: 0, cartonTo: 0 }];

CASES.push(...[
  ['per-po-printed', [SHUFFLED]],
  ['per-style-printed', [PRINTED_PER_STYLE]],
  ['continue-printed', [PRINTED_CONTINUE]],
  ['rows-without-a-group', [UNGROUPED]],
  ['missing-start-sorts-as-zero', [NO_START]],
  ['empty', [[]]],
  ['null', [null]],
].map(([id, args]) => ({ id: `rowsByGroup/${id}`, fn: rowsByGroup, args })));
CASES.push({ id: 'rowsByGroup/null-row-throws', fn: rowsByGroup, args: [[null]], throws: true });

CASES.push(...[
  ['po-group', [PRINTED_PER_PO, `po:${PO.rtm.buyerPoNo}`]],
  ['other-po-group', [PRINTED_PER_PO, `po:${PO.vgt.buyerPoNo}`]],
  ['style-group', [PRINTED_PER_STYLE, `order:${ORDER.jomo.orderId}`]],
  ['list-group', [PRINTED_CONTINUE, 'list']],
  ['no-group', [UNGROUPED, '_']],
  ['unknown-group', [PRINTED_PER_PO, 'po:NOPE']],
  ['null-group', [UNGROUPED, null]],
  ['null-rows', [null, 'list']],
  ['missing-start-not-counted', [NO_START, 'po:X']],
].map(([id, args]) => ({ id: `groupCartonCount/${id}`, fn: groupCartonCount, args })));
CASES.push({ id: 'groupCartonCount/null-row-throws', fn: groupCartonCount, args: [[null], 'list'], throws: true });

const UNNAMED = [
  { id: 'n1', numberGroup: 'po:', buyerPoNo: '', orderNo: '', styleNo: 'ST-9', cartonFrom: 1, cartonTo: 4 },
  { id: 'n2', numberGroup: 'order:9', buyerPoNo: null, orderNo: null, styleNo: null, cartonFrom: 1, cartonTo: 2 },
  { id: 'n3', numberGroup: 'order:8', orderNo: '', styleNo: 'ST-8', cartonFrom: 3, cartonTo: 3 },
];
CASES.push(...[
  ['continue', [PRINTED_CONTINUE, NUMBERING.CONTINUE]],
  ['per-po', [PRINTED_PER_PO, NUMBERING.PER_PO]],
  ['per-style', [PRINTED_PER_STYLE, NUMBERING.PER_STYLE]],
  ['per-po-rows-read-as-continue', [PRINTED_PER_PO, NUMBERING.CONTINUE]],
  ['continue-rows-read-per-po', [PRINTED_CONTINUE, NUMBERING.PER_PO]],
  ['unnamed-groups-per-po', [UNNAMED, NUMBERING.PER_PO]],
  ['unnamed-groups-per-style', [UNNAMED, NUMBERING.PER_STYLE]],
  ['unknown-rule', [PRINTED_PER_PO, 'BOGUS']],
  ['null-rule', [PRINTED_PER_PO, null]],
  ['empty-per-po', [[], NUMBERING.PER_PO]],
  ['null-rows', [null, NUMBERING.PER_STYLE]],
  ['null-rows-continue', [null, NUMBERING.CONTINUE]],
].map(([id, args]) => ({ id: `rangeLabelOf/${id}`, fn: rangeLabelOf, args })));

CASES.push(...[
  ['per-po', [PRINTED_PER_PO]],
  ['per-style', [PRINTED_PER_STYLE]],
  ['continue', [PRINTED_CONTINUE]],
  ['same-numbers-in-one-group-count-once', [[{ numberGroup: 'list', cartonFrom: 1, cartonTo: 10 }, { numberGroup: 'list', cartonFrom: 5, cartonTo: 12 }]]],
  ['same-numbers-in-two-groups-count-twice', [[{ numberGroup: 'po:A', cartonFrom: 1, cartonTo: 10 }, { numberGroup: 'po:B', cartonFrom: 1, cartonTo: 10 }]]],
  ['rows-without-a-group', [UNGROUPED]],
  ['empty', [[]]],
  ['null', [null]],
].map(([id, args]) => ({ id: `distinctCartonsOf/${id}`, fn: distinctCartonsOf, args })));

test('expDocPlNumbering parity fixtures', () => {
  const { count } = writeFixtures('expDocPlNumbering', CASES, { api: API });
  expect(count).toBe(CASES.length);
});
