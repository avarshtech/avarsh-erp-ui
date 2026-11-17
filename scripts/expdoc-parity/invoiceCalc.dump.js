// Parity fixtures for src/utils/expDocInvoiceCalc.js -> erp-purchase InvoiceAtoms, InvoiceTemplates, InvoiceLines,
// InvoiceTotalsCalc, RateResolver and ColourKeys (README.md). colourKey (services/expdoc/expDocMockCommon.js) is the
// colour matcher the invoice service passes, so its cases are recorded here too.
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The rows are packing-list rows as expDocPlBlocks builds them: JOMO (two styles, two buyer POs, every packing
// type, Pantone and spelling variants of one colour), VGT (kids' heights priced in bands, so rates blend) and
// Prenatal (master polybags, a colour priced for one size only: its line bills every piece at that size's rate).
// The order breakdowns carry PO prices and style prices, zero and missing prices. Fixed data: nothing depends on
// today's date.
import { test, expect } from 'vitest';
import * as invoiceCalc from '../../src/utils/expDocInvoiceCalc.js';
import * as invoiceTerms from '../../src/utils/expDocInvoiceTerms.js';
import { colourKey } from '../../src/services/expdoc/expDocMockCommon.js';
import { writeFixtures } from './writeFixtures.js';

const {
  defaultMatchColour, sizeRangeLabel, renderTemplate, recalcLine, invoiceTotals, igstBlock, aggregatePlTotals,
} = invoiceCalc;

// ─── Named adapters: a function is not data ──────────────────────────────────────
// The browser passes colour matchers and callbacks; a fixture names them instead and these adapters build the same
// functions before the real call. The Java test builds the same from the same names.
//  - matchColour: 'default' (defaultMatchColour) or 'colourKey'.
//  - rateFor: { breakdown, options } -> makeRateResolver(breakdown, options).rateOnly, the options' matcher named.
//  - hsCodeFor: { orderTerms } -> hsCodeOfOrder(termsByOrder(orderTerms), orderId of the line's first row),
//    as the invoice service resolves it.
//  - garmentNameFor / compositionFor: 'row' -> the line's first row's garmentName / compositionText.
//  - articleNoFor: { byStyle } -> byStyle[line's styleNo].
// makeRateResolver returns a function, so its adapter takes the groups to resolve as a third argument and returns,
// per group, what the resolver and its rateOnly answer. The constants DEFAULT_GROUP_BY and GROUPABLE_KEYS are
// recorded through adapters of their own name that return them.
const MATCHERS = { default: defaultMatchColour, colourKey };
const matcherOf = (name) => {
  if (!Object.hasOwn(MATCHERS, name)) throw new Error(`No colour matcher is named ${name}`);
  return MATCHERS[name];
};
const rateOptionsOf = (options) => {
  if (options?.matchColour === undefined) return options;
  return { ...options, matchColour: matcherOf(options.matchColour) };
};

const packedAtoms = function packedAtoms(rows, ...options) {
  if (!options.length) return invoiceCalc.packedAtoms(rows);
  return invoiceCalc.packedAtoms(rows, rateOptionsOf(options[0]));
};

const buildInvoiceLines = function buildInvoiceLines(rows, ...options) {
  if (!options.length) return invoiceCalc.buildInvoiceLines(rows);
  const [opts] = options;
  if (opts == null) return invoiceCalc.buildInvoiceLines(rows, opts);
  const {
    matchColour, rateFor, hsCodeFor, garmentNameFor, compositionFor, articleNoFor, ...data
  } = opts;
  const rowById = new Map((rows || []).map((r) => [r?.id, r]));
  const sourceRow = (g) => rowById.get(g.members[0].rowId) || {};
  const real = { ...data };
  if (matchColour !== undefined) real.matchColour = matcherOf(matchColour);
  if (rateFor !== undefined) real.rateFor = invoiceCalc.makeRateResolver(rateFor.breakdown, rateOptionsOf(rateFor.options)).rateOnly;
  if (hsCodeFor !== undefined) {
    const byOrder = invoiceTerms.termsByOrder(hsCodeFor.orderTerms);
    real.hsCodeFor = (g) => invoiceTerms.hsCodeOfOrder(byOrder, sourceRow(g).orderId);
  }
  if (garmentNameFor === 'row') real.garmentNameFor = (g) => sourceRow(g).garmentName ?? null;
  if (compositionFor === 'row') real.compositionFor = (g) => sourceRow(g).compositionText ?? null;
  if (articleNoFor !== undefined) real.articleNoFor = (g) => articleNoFor.byStyle[g.styleNo] ?? null;
  return invoiceCalc.buildInvoiceLines(rows, real);
};

const makeRateResolver = function makeRateResolver(orderBreakdown, options, groups) {
  const resolve = invoiceCalc.makeRateResolver(orderBreakdown, rateOptionsOf(options));
  return groups.map((group) => ({ detail: resolve(group), rate: resolve.rateOnly(group) }));
};

const DEFAULT_GROUP_BY = function DEFAULT_GROUP_BY() {
  return invoiceCalc.DEFAULT_GROUP_BY;
};
const GROUPABLE_KEYS = function GROUPABLE_KEYS() {
  return [...invoiceCalc.GROUPABLE_KEYS];
};

const API = {
  ...invoiceCalc, packedAtoms, buildInvoiceLines, makeRateResolver, DEFAULT_GROUP_BY, GROUPABLE_KEYS, colourKey,
};

// ─── Orders, buyer POs and packing-list rows ──────────────────────────────────────
const ch = (...codes) => String.fromCharCode(...codes);
const SEP = ch(0x241f); // the PO key separator, as expDocPoKeys.js has it
const NBSP = ch(0xa0);
const EM_DASH = ch(0x2014);
const EN_DASH = ch(0x2013);
const EM_SPACE = ch(0x2003);
const E_ACUTE = ch(0xe9);

const ORDER = {
  jomo: { orderId: 1042, orderNo: 'SG/26-27/1042', styleNo: 'ST-2026-0441', garmentName: "Men's Slim Fit Polo", compositionText: '95% COTTON 5% ELASTANE' },
  henley: { orderId: 1043, orderNo: 'SG/26-27/1043', styleNo: 'ST-2026-0442', garmentName: "Men's Henley", compositionText: '100% COTTON' },
  vgt: { orderId: 1055, orderNo: 'SG/26-27/1055', styleNo: 'ST-2026-0512', garmentName: "Girls' Printed Tee", compositionText: '100% ORGANIC COTTON' },
  prenatal: { orderId: 1061, orderNo: 'SG/26-27/1061', styleNo: 'ST-2026-0588', garmentName: 'Baby 3-pack Bodysuit', compositionText: '100% COTTON INTERLOCK' },
};
const PO = {
  rtm: { buyerPoNo: 'PO-884213', destination: 'Rotterdam' },
  ham: { buyerPoNo: 'PO-884214', destination: 'Hamburg DC' },
  vgt: { buyerPoNo: 'VGT-2026-771', destination: 'Antwerp' },
  pre: { buyerPoNo: 'PRE-55120', destination: 'Rotterdam' },
};
const poKeyOf = (po) => `${po.buyerPoNo ?? ''}${SEP}${po.destination ?? ''}`;

/** A packing-list row: the entry's carton range and contents, its order, PO and packing entry. */
const row = (order, po, entryId, from, to, contents, extra = {}) => ({
  id: `${entryId}:${poKeyOf(po)}:${extra.sectionKey || 'MAIN'}:${from}-${to}`,
  sectionKey: 'MAIN',
  packingType: 'SOLID',
  packingCode: null,
  danNo: null,
  colorName: null,
  sizeQty: null,
  ratio: null,
  mixedRows: null,
  assortmentsPerCarton: null,
  pcsPerMpb: null,
  mpbPerCarton: null,
  articleNos: null,
  eanBySize: null,
  orderLineId: 1,
  netWeightKg: 12.48,
  grossWeightKg: 13.5,
  ...contents,
  ...extra,
  cartonFrom: from,
  cartonTo: to,
  ownFrom: from,
  ownTo: to,
  numberGroup: 'list',
  orderId: order.orderId,
  orderNo: order.orderNo,
  poKey: poKeyOf(po),
  buyerPoNo: po.buyerPoNo,
  destination: po.destination,
  styleNo: order.styleNo,
  garmentName: order.garmentName,
  compositionText: order.compositionText,
  sourceEntryId: entryId,
  sourceEntryNo: `CPK/26-27/${entryId}`,
  packingDate: '2026-10-01',
});

const SCARLET = 'Flame Scarlet 18-1662 TCX';
const J = {
  solid: row(ORDER.jomo, PO.rtm, 101, 1, 47, {
    colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 }, danNo: 'DAN-4471', packingCode: 'HANGER',
    articleNos: { M: 'ART-99120', L: 'ART-99121', XL: 'ART-99122' },
    eanBySize: { M: '8712345001018', L: '8712345001025', XL: '8712345001032' },
  }),
  ratio: row(ORDER.jomo, PO.rtm, 101, 48, 57, {
    packingType: 'RATIO', colorName: SCARLET, ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
    danNo: 'DAN-4472', packingCode: 'FOLDED', orderLineId: 2,
    articleNos: { M: 'ART-99130', L: 'ART-99131', XL: 'ART-99132', XXL: 'ART-99133' },
    eanBySize: { M: '8712345002015', L: '8712345002022' },
  }),
  mixed: row(ORDER.jomo, PO.rtm, 101, 58, 60, {
    packingType: 'MIXED', danNo: 'DAN-4473',
    articleNos: { M: 'ART-99120', L: 'ART-99121' },
    mixedRows: [
      { colorName: 'Navy', sizeQty: { M: 5, L: 5 } },
      { colorName: SCARLET, sizeQty: { M: 3, L: 2 }, articleNos: { M: 'ART-99130' }, eanBySize: { M: '8712345002015' } },
    ],
  }),
  extra: row(ORDER.jomo, PO.rtm, 101, 61, 61, {
    packingType: 'EXTRA', colorName: 'Navy', sizeQty: { M: 3, L: 4 }, danNo: 'DAN-4474',
  }, { sectionKey: 'EXTRA' }),
  ham: row(ORDER.jomo, PO.ham, 102, 1, 13, {
    colorName: 'Navy', sizeQty: { M: 12, L: 12, XL: 12 }, danNo: 'DAN-5001', packingCode: 'HANGER', orderLineId: 3,
    articleNos: { M: 'ART-99120', L: 'ART-99121', XL: 'ART-99122' },
  }),
  hamPantone: row(ORDER.jomo, PO.ham, 102, 14, 18, { colorName: '18-1662', sizeQty: { M: 6, L: 6 }, orderLineId: 4 }),
  hamUpper: row(ORDER.jomo, PO.ham, 102, 19, 20, { colorName: 'NAVY ', sizeQty: { XL: 8 }, orderLineId: 3 }),
  henley: row(ORDER.henley, PO.rtm, 103, 62, 70, { colorName: 'Black', sizeQty: { S: 8, M: 8, L: 8 }, danNo: 'DAN-4480' }),
};
const JOMO = [J.solid, J.ratio, J.mixed, J.extra];
const JOMO_ALL = [...JOMO, J.ham, J.hamPantone, J.hamUpper, J.henley];

const vgt = (from, to, colorName, sizeQty) => row(ORDER.vgt, PO.vgt, 104, from, to, { colorName, sizeQty, danNo: 'DAN-7700' });
const VGT = [
  vgt(1, 300, 'Ecru', { 74: 12, 80: 12, 86: 12 }),
  vgt(301, 600, 'Ecru', { 92: 12, 98: 12, 104: 12 }),
  vgt(601, 860, 'Dusty Rose', { 110: 12, 116: 12, 122: 12 }),
  vgt(861, 900, 'Dusty Rose', { 128: 10, 134: 10, 140: 10 }),
];

const PRENATAL = [
  row(ORDER.prenatal, PO.pre, 105, 1, 24, {
    packingType: 'MPB', colorName: 'White', ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8,
    packingCode: 'WITH HANGER', danNo: 'DAN-9001',
  }),
  row(ORDER.prenatal, PO.pre, 105, 25, 36, {
    colorName: 'Soft Blue', sizeQty: { '74/80': 24, '86/92': 24 }, packingCode: 'WITHOUT HANGER', danNo: 'DAN-9002', orderLineId: 2,
  }),
];

const MENS_SIZES = ['M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_EU_SIZES = ['74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140'];
const BABY_SIZES = ['50/56', '62/68', '74/80', '86/92'];

// Lean rows: only what the projection reads, plus the edges
const lean = (id, extra) => ({ id, packingType: 'SOLID', cartonFrom: 1, cartonTo: 3, styleNo: 'ST-9', colorName: 'Red', ...extra });
const EDGE = {
  fractional: lean('frac', { sizeQty: { M: 2.5, L: 0.5, XL: 0 } }),
  negative: lean('neg', { sizeQty: { S: 0, M: -2, L: 5 } }),
  spacedSizes: lean('spaced', { sizeQty: { ' M ': 4, L: 2 }, articleNos: { ' M ': 'A-SPACED', M: 'A-TRIMMED', L: 'A-L' } }),
  noIdentity: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { M: 1 } },
  ratioNoPacks: lean('ratio-no-packs', { packingType: 'RATIO', ratio: { M: 1, L: 1 }, assortmentsPerCarton: null }),
  mixedEdge: lean('mixed-edge', {
    packingType: 'MIXED', colorName: null, articleNos: { M: 'ROW-M', L: 'ROW-L' }, eanBySize: { M: 'ROW-EAN-M' },
    mixedRows: [null, { colorName: 'Navy' }, { colorName: 'Red', sizeQty: { M: 2, L: 0 }, articleNos: {} },
      { colorName: 'navy ', sizeQty: { M: 1, XL: 3 }, eanBySize: null }, { sizeQty: { S: 4 } }],
  }),
  mixedNone: lean('mixed-none', { packingType: 'MIXED', mixedRows: null }),
  noRange: lean('no-range', { cartonFrom: null, sizeQty: { M: 10 } }),
  inverted: lean('inverted', { cartonFrom: 9, cartonTo: 2, sizeQty: { M: 10 } }),
  large: lean('large', { cartonFrom: 1000000, cartonTo: 1999999, sizeQty: { M: 20, L: 20 } }),
  textQuantities: lean('text', { cartonFrom: 3, cartonTo: 7, sizeQty: { M: '10', L: '' } }),
};
// Carton numbers typed as text: counted as numbers on both sides, but an atom echoes its row's carton numbers as
// given, and the server cannot tell "3" from 3 (README.md). So this row goes only where nothing echoes them.
const TEXT_RANGE = lean('text-range', { cartonFrom: '3', cartonTo: '7', sizeQty: { M: 10 } });

// ─── Order breakdowns: style prices, PO prices, bands, gaps ───────────────────────
const ob = (styleNo, colorName, sizes, rate, po = {}) => Object.entries(sizes).map(([size, orderQty]) => ({
  styleNo,
  colorName,
  size,
  orderQty,
  orderRate: rate !== null && typeof rate === 'object' ? (rate[size] ?? null) : rate,
  buyerPoNo: po.buyerPoNo ?? null,
  destination: po.destination ?? null,
}));
const BREAKDOWN = {
  jomo: [
    ...ob('ST-2026-0441', 'Navy', { M: 488, L: 950, XL: 1500 }, 8.75),
    // Hamburg's PO is priced apart for Navy
    ...ob('ST-2026-0441', 'Navy', { M: 156, L: 156, XL: 172 }, 9.1, PO.ham),
    ...ob('ST-2026-0441', SCARLET, { M: 49, L: 86, XL: 80, XXL: 40 }, { M: 8.95, L: 8.95, XL: 8.95, XXL: null }),
    // A zero FOB is not a price to default from
    ...ob('ST-2026-0442', 'Black', { S: 72, M: 72, L: 72 }, 0),
  ],
  vgt: [
    ...ob('ST-2026-0512', 'Ecru', { 74: 3600, 80: 3600, 86: 3600, 92: 3600, 98: 3600, 104: 3600 },
      { 74: 4.1, 80: 4.1, 86: 4.2, 92: 4.2, 98: 4.35, 104: 4.35 }, PO.vgt),
    ...ob('ST-2026-0512', 'Dusty Rose', { 110: 3120, 116: 3120, 122: 3120, 128: 400, 134: 400, 140: 400 },
      { 110: 4.5, 116: 4.5, 122: 4.65, 128: 4.65, 134: 4.8, 140: 4.8 }, PO.vgt),
  ],
  prenatal: [
    ...ob('ST-2026-0588', 'White', { '50/56': 384, '62/68': 384, '74/80': 384 }, 6.9, PO.pre),
    // Soft Blue: one size priced as text, the other blank
    { styleNo: 'ST-2026-0588', colorName: 'Soft Blue', size: '74/80', orderQty: 288, orderRate: '6.90', buyerPoNo: 'PRE-55120', destination: 'Rotterdam' },
    { styleNo: 'ST-2026-0588', colorName: 'Soft Blue', size: '86/92', orderQty: 264, orderRate: '', buyerPoNo: 'PRE-55120', destination: 'Rotterdam' },
  ],
};
const ALL_BREAKDOWN = [...BREAKDOWN.jomo, ...BREAKDOWN.vgt, ...BREAKDOWN.prenatal];

const TERMS = [
  { orderId: 1042, orderNo: 'SG/26-27/1042', styleNo: 'ST-2026-0441', currency: 'EUR', paymentTerms: 'TT 60 DAYS', hsCode: '61051000' },
  { orderId: 1043, orderNo: 'SG/26-27/1043', styleNo: 'ST-2026-0442', currency: 'EUR', paymentTerms: 'TT 60 DAYS', hsCode: null },
  { orderId: 1055, orderNo: 'SG/26-27/1055', styleNo: 'ST-2026-0512', currency: 'EUR', paymentTerms: 'TT 30 DAYS', hsCode: '61091000' },
  { orderId: 1061, orderNo: 'SG/26-27/1061', styleNo: 'ST-2026-0588', currency: 'EUR', paymentTerms: null, hsCode: ' 61112000 ' },
];

/** The callbacks the invoice service passes (expDocMockInvoices generateLines), by name. */
const SERVICE = {
  matchColour: 'colourKey',
  rateFor: { breakdown: ALL_BREAKDOWN, options: { matchColour: 'colourKey' } },
  hsCodeFor: { orderTerms: TERMS },
  garmentNameFor: 'row',
  compositionFor: 'row',
};

// The standard layout's grain (expDocSystemTemplates)
const STANDARD_GRAIN = {
  mode: 'PER_STYLE_SIZE_RANGE',
  groupBy: ['styleNo', 'colourKey'],
  descriptionTemplate: `{{style.garmentName}} ${EM_DASH} {{row.styleNo}} ${EM_DASH} {{row.colorName}}`,
  rateSource: 'ORDER_SIZE_PRICE',
  hsCodeSource: 'HS_MASTER_CATEGORY',
  showPackagingAttributes: false,
  materialRows: null,
};

// ─── defaultMatchColour and colourKey ─────────────────────────────────────────────
const COLOUR_NAMES = [
  ['navy', 'Navy'], ['padded-upper', ' NAVY '], ['null', null], ['empty', ''], ['blank', '   '], ['pantone', SCARLET],
  ['no-break-spaces', `${NBSP}Ecru${NBSP}`], ['accent', `Grey M${E_ACUTE}lange`], ['dotted-capital-i', `${ch(0x130)}stanbul`],
  ['final-sigma', ch(0x3a3, 0x39f, 0x3a6, 0x39f, 0x3a3)], ['sharp-s-upper', `WEI${ch(0x1e9e)}`], ['inner-spaces-kept', 'Navy   Blue'],
];
const COLOUR_KEYS = [
  ...COLOUR_NAMES,
  ['pantone-in-name', 'Classic Blue 19-4052'], ['pantone-alone', '19-4052'], ['pantone-tcx', SCARLET], ['pms', 'PMS 286 C'],
  ['pms-lower', 'pms286'], ['pms-mixed-case-spaces', 'Pms   286'], ['pms-no-break-space', `PMS${NBSP}286`], ['pms-word-only', 'PMS'],
  ['pantone-before-pms', 'PMS 19-4052'], ['pantone-inside-digits', '118-16620'], ['one-digit-prefix-is-not-pantone', '1-2345'],
  ['five-digits-take-four', '12-12345'], ['spaces-collapse', ' NAVY\tBLUE '], ['em-space-collapses', `Navy${EM_SPACE}Blue`],
  ['no-break-space-collapses', `Navy${NBSP}${NBSP}Blue`],
];

// ─── Rate groups for makeRateResolver ─────────────────────────────────────────────
const atomsOf = (rows, matchColour = colourKey) => invoiceCalc.packedAtoms(rows, { matchColour });
const group = (rows, matchColour) => ({ members: atomsOf(rows, matchColour) });
// An invoice line's source atoms: style, colour, size and pieces only, no PO
const sourceAtomsOf = (rows) => atomsOf(rows).map((a) => ({ rowId: a.rowId, size: a.size, qty: a.qty, styleNo: a.styleNo, colorName: a.colorName }));

const RATE_CASES = [
  ['style-price', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.solid]), group([J.extra])]]],
  ['po-price-wins', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.ham]), group([J.hamUpper])]]],
  ['po-and-style-blend', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.solid, J.ham])]]],
  ['unpriced-size', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.ratio]), group([J.mixed])]]],
  ['pantone-needs-the-pantone-matcher', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.hamPantone])]]],
  ['default-matcher-misses-pantone', [BREAKDOWN.jomo, {}, [group([J.hamPantone]), group([J.ratio], defaultMatchColour)]]],
  ['zero-price-is-unpriced', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [group([J.henley])]]],
  ['vgt-bands-blend', [BREAKDOWN.vgt, { matchColour: 'colourKey' }, [group(VGT.slice(0, 2)), group(VGT.slice(2)), group(VGT)]]],
  ['vgt-two-decimals', [BREAKDOWN.vgt, { matchColour: 'colourKey', decimals: 2 }, [group(VGT.slice(0, 2)), group(VGT)]]],
  ['vgt-whole-units', [BREAKDOWN.vgt, { decimals: 0 }, [group(VGT)]]],
  ['prenatal-text-and-blank-prices', [BREAKDOWN.prenatal, { matchColour: 'colourKey' }, [group(PRENATAL.slice(0, 1)), group(PRENATAL.slice(1))]]],
  // The invoice service resolves a line's order price from its source atoms, which carry no PO
  ['source-atoms-take-the-style-price', [BREAKDOWN.jomo, { matchColour: 'colourKey' }, [{ members: sourceAtomsOf([J.ham]) }, group([J.ham])]]],
  ['first-style-price-last-po-price', [[
    ...ob('ST-1', 'Red', { M: 1 }, 5), ...ob('ST-1', 'Red', { M: 1 }, 6),
    ...ob('ST-1', 'Red', { M: 1 }, 7, { buyerPoNo: 'PO-A', destination: 'X' }), ...ob('ST-1', 'Red', { M: 1 }, 8, { buyerPoNo: 'PO-A', destination: 'X' }),
  ], {}, [
    { members: [{ styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 10 }] },
    { members: [{ styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 10, buyerPoNo: 'PO-A', destination: 'X' }] },
    { members: [{ styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 10, buyerPoNo: 'PO-A', destination: 'Y' }] },
  ]]],
  ['keys-trimmed-any-case', [[
    { styleNo: ' st-1 ', colorName: ' RED ', size: ' M ', orderRate: 5, buyerPoNo: ' PO-A ', destination: 'X ' },
  ], {}, [
    { members: [{ styleNo: 'ST-1', colorName: 'red', size: 'M', qty: 4 }] },
    { members: [{ styleNo: 'ST-1', colorName: 'red', size: 'M', qty: 4, buyerPoNo: 'PO-A', destination: 'X' }] },
  ]]],
  ['po-without-destination', [[...ob('ST-1', 'Red', { M: 1 }, 5), ...ob('ST-1', 'Red', { M: 1 }, 9, { buyerPoNo: 'PO-A' })], {}, [
    { members: [{ styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 2, buyerPoNo: 'PO-A', destination: null }] },
    { members: [{ styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 2, buyerPoNo: 'PO-A', destination: 'Rotterdam' }] },
  ]]],
  ['negative-and-missing-prices', [[
    { styleNo: 'ST-1', colorName: 'Red', size: 'S', orderRate: -1 }, { styleNo: 'ST-1', colorName: 'Red', size: 'M', orderRate: null },
    { styleNo: 'ST-1', colorName: 'Red', size: 'L' }, { styleNo: 'ST-1', colorName: 'Red', size: 'XL', orderRate: 3.333 },
  ], {}, [{ members: [
    { styleNo: 'ST-1', colorName: 'Red', size: 'S', qty: 1 }, { styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 1 },
    { styleNo: 'ST-1', colorName: 'Red', size: 'L', qty: 1 }, { styleNo: 'ST-1', colorName: 'Red', size: 'XL', qty: 3 },
  ] }]]],
  ['negative-pieces-cancel-to-none', [[...ob('ST-1', 'Red', { M: 1, L: 1 }, 5)], {}, [{ members: [
    { styleNo: 'ST-1', colorName: 'Red', size: 'M', qty: 4 }, { styleNo: 'ST-1', colorName: 'Red', size: 'L', qty: -4 },
  ] }]]],
  ['nothing-priced', [[{ styleNo: 'ST-1', colorName: 'Red', size: 'M', orderRate: 0 }], {}, [group([J.solid])]]],
  ['empty-breakdown', [[], {}, [group([J.solid])]]],
  ['null-breakdown', [null, {}, [group([J.solid])]]],
  ['group-without-members', [BREAKDOWN.jomo, {}, [{}, { members: [] }, { members: null }]]],
];

// ─── Templates ────────────────────────────────────────────────────────────────────
const SCOPE = {
  row: {
    styleNo: 'ST-2026-0441', colorName: 'Navy', colours: ['Navy', SCARLET], sizes: ['M', 'L', 'XL'], size: null, sizeRange: 'M-XL',
    quantity: 2820, buyerPoNo: 'PO-884213', buyerPoNos: ['PO-884213', 'PO-884214'], orderLineId: 1,
    members: [{ size: 'M', qty: 470, ean: '8712345001018' }], flag: false, yes: true, zero: 0, drift: 0.1 + 0.2, big: 1e21,
    holes: [1, null, 'a'], nested: [[1, 2], [3]], money: 'Price $1 \\ $& back',
  },
  style: { garmentName: "Men's Slim Fit Polo", hsCode: '61051000', composition: '95% COTTON 5% ELASTANE', none: null },
  line: { sizeRange: 'M-XL', size: null },
};
const NO_HS = { ...SCOPE, style: { ...SCOPE.style, hsCode: null } };

const TEMPLATE_CASES = [
  ['standard', [STANDARD_GRAIN.descriptionTemplate, SCOPE]],
  ['spaces-inside-braces', [`{{ style.garmentName }} / {{${NBSP}row.styleNo${NBSP}}}`, SCOPE]],
  ['missing-middle-collapses', [`{{style.garmentName}} ${EM_DASH} {{style.hsCode}} ${EM_DASH} {{row.sizeRange}}`, NO_HS]],
  ['missing-middle-with-hyphens', ['{{style.garmentName}} - {{style.hsCode}} - {{row.sizeRange}}', NO_HS]],
  ['missing-last', [`{{row.styleNo}} ${EN_DASH} {{style.none}}`, SCOPE]],
  ['missing-first', [`{{style.none}} ${EN_DASH} {{row.styleNo}}`, SCOPE]],
  ['all-missing', [`{{a}} ${EM_DASH} {{b}} ${EM_DASH} {{c.d}}`, SCOPE]],
  ['size-range-dashes-kept', ['{{row.styleNo}} {{row.sizeRange}} - {{line.size}}', SCOPE]],
  ['numbers', ['{{row.quantity}} pcs, {{row.zero}} spare, {{row.drift}} drift, {{row.big}} big', SCOPE]],
  ['booleans', ['{{row.flag}}/{{row.yes}}', SCOPE]],
  ['arrays', ['{{row.colours}} | {{row.sizes.length}} sizes | {{row.sizes.1}} | {{row.holes}} | {{row.nested}}', SCOPE]],
  ['strings-index-and-length', ['{{row.styleNo.0}}{{row.styleNo.1}} {{row.styleNo.length}}', SCOPE]],
  ['objects', ['{{row.members}} {{row.members.0.qty}} {{row.members.0.ean}} {{row}}', SCOPE]],
  ['replacement-characters-literal', ['{{row.money}}', SCOPE]],
  ['invalid-placeholders-kept', ['{{row.style-no}} {{}} {{ }} {{row.styleNo}}', SCOPE]],
  ['empty-path-segment', ['{{row..styleNo}}{{.row}}x', SCOPE]],
  ['runs-of-spaces', [`A   B\t\tC${NBSP}${NBSP}D${EM_SPACE} E`, SCOPE]],
  ['only-separators', [` ${EM_DASH} ${EN_DASH} - `, SCOPE]],
  ['double-dash-between-words', ['Navy -- Blue', SCOPE]],
  ['two-separators-in-a-row', [`A ${EM_DASH} ${EM_DASH} B ${EN_DASH}${EN_DASH} C`, SCOPE]],
  ['value-ending-in-a-dash', ['{{row.styleNo}}-', SCOPE]],
  // JavaScript's $ is the very end; Java's would also match before a last line break
  ['dash-before-a-last-line-break', [`{{row.styleNo}} -\n`, SCOPE]],
  ['dash-before-a-line-break-and-text', [`{{row.styleNo}} -\nNavy`, SCOPE]],
  ['dash-before-crlf', [`{{row.styleNo}} ${EM_DASH}\r\n`, SCOPE]],
  ['line-breaks-collapse', [`A\r\n\r\nB${ch(0x2028)}${ch(0x2029)}C\n D`, SCOPE]],
  ['leading-separators-and-breaks', [`\n ${EN_DASH} -{{row.styleNo}}`, SCOPE]],
  ['no-placeholders', ["Men's Polo", SCOPE]],
  ['null-scope', ['{{row.styleNo}} X', null]],
  ['null-template', [null, SCOPE]],
  ['empty-template', ['', SCOPE]],
];

// ─── Invoice lines ────────────────────────────────────────────────────────────────
const LINES_CASES = [
  // The invoice service's grain and callbacks, per style and colour
  ['service/jomo-per-style-size-range', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_STYLE_SIZE_RANGE' }, sizes: MENS_SIZES }]],
  ['service/standard-template', [JOMO_ALL, { ...SERVICE, grain: STANDARD_GRAIN, sizes: MENS_SIZES }]],
  ['service/vgt-bands-blend', [VGT, { ...SERVICE, grain: { mode: 'PER_STYLE_SIZE_RANGE' }, sizes: KIDS_EU_SIZES }]],
  ['service/prenatal-colour-priced-in-part', [PRENATAL, { ...SERVICE, grain: { mode: 'PER_STYLE_SIZE_RANGE' }, sizes: BABY_SIZES }]],
  ['service/whole-shipment', [[...JOMO_ALL, ...VGT, ...PRENATAL], { ...SERVICE, grain: STANDARD_GRAIN, sizes: [...MENS_SIZES, ...KIDS_EU_SIZES, ...BABY_SIZES] }]],
  // Every grain
  ['per-size/vgt', [VGT, { ...SERVICE, grain: { mode: 'PER_SIZE' }, sizes: KIDS_EU_SIZES }]],
  ['per-size/jomo-article-from-the-carton', [JOMO, { ...SERVICE, grain: { mode: 'PER_SIZE' }, sizes: MENS_SIZES }]],
  ['per-po-style/colours-joined', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_PO_STYLE' }, sizes: MENS_SIZES }]],
  ['per-order-line/with-packaging', [[...JOMO_ALL, ...PRENATAL], {
    ...SERVICE, grain: { mode: 'PER_ORDER_LINE', showPackagingAttributes: true }, sizes: [...MENS_SIZES, ...BABY_SIZES],
  }]],
  ['material-rows/stated', [JOMO, {
    ...SERVICE,
    unit: 'SETS',
    grain: {
      mode: 'MATERIAL_ROWS',
      materialRows: [
        { materialNo: '000000000012345678', description: 'POLO SHIRT, KNITTED', hsCode: '61051000', quantity: 3150.9, rate: 8.75, unit: 'PCS' },
        { materialNo: 'SAMPLE-CHG', description: '', quantity: 1, rate: 25, nonMerchandise: true },
        { materialNo: null, quantity: '12', rate: null, unit: '' },
        { description: 'Courier', quantity: null, rate: '15.5' },
      ],
    },
  }]],
  ['material-rows/none-stated-groups-per-style', [JOMO_ALL, { ...SERVICE, grain: { mode: 'MATERIAL_ROWS', materialRows: [] } }]],
  ['material-rows/left-out', [JOMO_ALL, { ...SERVICE, grain: { mode: 'MATERIAL_ROWS' } }]],
  ['unknown-grain-is-per-style', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_CARTON' }, sizes: MENS_SIZES }]],
  ['blank-grain-is-per-style', [JOMO_ALL, { ...SERVICE, grain: { mode: '' }, sizes: MENS_SIZES }]],
  // A template's groupBy: all usable or none
  ['group-by/po-style-colour', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_STYLE_SIZE_RANGE', groupBy: ['buyerPoNo', 'styleNo', 'colourKey'] }, sizes: MENS_SIZES }]],
  ['group-by/entry-and-order-line', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_ORDER_LINE', groupBy: ['sourceEntryId', 'orderLineId'] } }]],
  ['group-by/section', [JOMO, { ...SERVICE, grain: { groupBy: ['sectionKey', 'styleNo'] }, sizes: MENS_SIZES }]],
  ['group-by/article', [JOMO, { ...SERVICE, grain: { mode: 'PER_SIZE', groupBy: ['articleNo'] }, sizes: MENS_SIZES }]],
  ['group-by/colour-name-any-case', [[J.ham, J.hamUpper, J.solid], { grain: { groupBy: ['colorName'] } }]],
  ['group-by/size-range-refused', [JOMO_ALL, { ...SERVICE, grain: { mode: 'PER_PO_STYLE', groupBy: ['styleNo', 'sizeRange'] }, sizes: MENS_SIZES }]],
  ['group-by/unknown-key-refused', [JOMO, { ...SERVICE, grain: { mode: 'PER_SIZE', groupBy: ['qty'] }, sizes: MENS_SIZES }]],
  ['group-by/null-key-refused', [JOMO, { ...SERVICE, grain: { mode: 'PER_SIZE', groupBy: ['styleNo', null] }, sizes: MENS_SIZES }]],
  ['group-by/empty-is-the-default', [JOMO, { ...SERVICE, grain: { mode: 'PER_PO_STYLE', groupBy: [] } }]],
  ['group-by/null-is-the-default', [JOMO, { ...SERVICE, grain: { mode: 'PER_PO_STYLE', groupBy: null } }]],
  // Colour matching
  ['matcher/default-keeps-pantone-apart', [JOMO_ALL, { ...SERVICE, matchColour: 'default', sizes: MENS_SIZES }]],
  ['matcher/pantone-merges', [JOMO_ALL, { matchColour: 'colourKey', sizes: MENS_SIZES }]],
  // Descriptions
  ['description/template-collapses-missing', [[J.henley, J.solid], {
    ...SERVICE, grain: { descriptionTemplate: `{{style.garmentName}} ${EM_DASH} {{style.hsCode}} ${EM_DASH} {{line.sizeRange}} - {{line.size}}` },
    sizes: MENS_SIZES,
  }]],
  ['description/template-numbers-and-lists', [JOMO_ALL, {
    ...SERVICE, grain: { mode: 'PER_PO_STYLE', descriptionTemplate: '{{row.quantity}} pcs of {{row.colours}} in {{row.sizes.length}} sizes ({{row.buyerPoNos}}, {{row.members.0.danNo}})' },
  }]],
  ['description/no-callbacks', [JOMO, { grain: { mode: 'PER_SIZE' }, sizes: MENS_SIZES }]],
  // Article numbers
  ['article/callback-wins', [JOMO, { ...SERVICE, grain: { mode: 'PER_SIZE' }, articleNoFor: { byStyle: { 'ST-2026-0441': 'ART-STYLE-0441' } } }]],
  ['article/callback-on-other-grains', [JOMO_ALL, { ...SERVICE, articleNoFor: { byStyle: { 'ST-2026-0442': 'ART-HENLEY' } } }]],
  // Rates, quantities, units
  ['rates/two-decimals', [VGT, { ...SERVICE, rateFor: { breakdown: BREAKDOWN.vgt, options: { decimals: 2 } } }]],
  ['rates/edge-rows', [[...Object.values(EDGE), TEXT_RANGE], { ...SERVICE, rateFor: { breakdown: ob('ST-9', 'Red', { M: 1, L: 1, S: 1 }, 3.335) } }]],
  ['units/null-unit', [JOMO, { unit: null }]],
  ['units/stated-unit', [JOMO, { unit: 'DOZ', grain: { mode: 'PER_PO_STYLE' } }]],
  ['defaults/no-options', [JOMO_ALL]],
  ['defaults/empty-options', [JOMO_ALL, {}]],
  ['defaults/no-rows', [null, SERVICE]],
  ['defaults/empty-rows', [[], SERVICE]],
];
const LINE_CASES = LINES_CASES.map(([id, args]) => ({ id: `buildInvoiceLines/${id}`, fn: buildInvoiceLines, args }));
LINE_CASES.push(
  { id: 'buildInvoiceLines/throws/null-options', fn: buildInvoiceLines, args: [JOMO, null], throws: true },
  { id: 'buildInvoiceLines/throws/null-grain', fn: buildInvoiceLines, args: [JOMO, { grain: null }], throws: true },
  { id: 'buildInvoiceLines/throws/null-size-preset', fn: buildInvoiceLines, args: [JOMO, { sizes: null }], throws: true },
  // jsonb returns sizes in its own key order; the browser lists "104" first, and so must the server
  {
    id: 'buildInvoiceLines/jsonb-size-order',
    fn: buildInvoiceLines,
    argsJson: '[[{"id":"j","packingType":"SOLID","cartonFrom":1,"cartonTo":2,"styleNo":"ST-9","colorName":"Red",'
      + '"sizeQty":{"L":3,"M":1,"104":2},"articleNos":{"L":"A-3","104":"A-2"}}],{"grain":{"mode":"PER_SIZE"}}]',
  },
);

// Lines as the invoice service keeps them, for recalcLine and invoiceTotals
const SERVICE_LINES = buildInvoiceLines([...JOMO_ALL, ...PRENATAL], { ...SERVICE, grain: STANDARD_GRAIN, sizes: [...MENS_SIZES, ...BABY_SIZES] })
  .map((line, i) => ({ ...line, id: i + 1, seq: i + 1, orderRate: line.rate, rateIsBlended: false, unpricedQty: 0 }));
const SAMPLE_CHARGE = {
  id: 99, seq: 99, key: 'material:SAMPLE-CHG', description: 'Sample charge', materialNo: 'SAMPLE-CHG', quantity: 3, rate: 25,
  unit: 'PCS', nonMerchandise: true, sourceAtoms: [], amount: 75,
};
const [FIRST_LINE] = SERVICE_LINES;

const RECALC_CASES = [
  ['service-line', [FIRST_LINE]],
  ['rate-overridden', [{ ...FIRST_LINE, rate: 9.5, rateOverridden: true }]],
  ['stale-amount-recomputed', [{ ...FIRST_LINE, amount: 99999 }]],
  ['no-rate-no-amount', [{ ...FIRST_LINE, rate: null }]],
  ['zero-rate', [{ ...FIRST_LINE, rate: 0 }]],
  ['fractional-pieces-truncated', [{ ...FIRST_LINE, quantity: 120.9, rate: 4.1833 }]],
  ['negative-pieces-toward-zero', [{ ...FIRST_LINE, quantity: -3.5, rate: 2 }]],
  ['pieces-as-text', [{ ...FIRST_LINE, quantity: '120', rate: 8.75 }]],
  ['no-pieces', [{ ...FIRST_LINE, quantity: null, rate: 8.75 }]],
  ['half-cent', [{ ...FIRST_LINE, quantity: 3, rate: 0.335 }]],
  ['key-is-the-id', [{ ...FIRST_LINE, id: null }]],
  ['no-id-no-key', [{ seq: 1, quantity: 2, rate: 1.25 }]],
  ['material-line', [SAMPLE_CHARGE]],
  ['annexe-line', [{ ...FIRST_LINE, hsCode: '61051000', hsCodeFromLines: true, packagingAttributes: { packingCode: 'HANGER', danNo: 'DAN-4471' } }]],
];
RECALC_CASES.push(...SERVICE_LINES.slice(1).map((line, i) => [`kept-line-${i + 2}`, [line]]));

const TOTALS_LINES = [...SERVICE_LINES, SAMPLE_CHARGE];
const on = (value, mode) => ({ enabled: true, value, ...(mode ? { mode } : {}) });
const off = (value, mode) => ({ enabled: false, value, ...(mode ? { mode } : {}) });
const TOTALS_CASES = [
  ['no-charges', [TOTALS_LINES]],
  ['empty-charges', [TOTALS_LINES, {}]],
  ['percent-discount', [TOTALS_LINES, { discount: on(3, 'PERCENT') }]],
  ['amount-discount', [TOTALS_LINES, { discount: on(250, 'AMOUNT') }]],
  ['discount-without-mode-is-flat', [TOTALS_LINES, { discount: on(250) }]],
  ['discount-off', [TOTALS_LINES, { discount: off(3, 'PERCENT') }]],
  ['all-charges', [TOTALS_LINES, {
    discount: on(2.5, 'PERCENT'), freight: on(1250.5), insurance: on(80.255), other: on(15),
  }]],
  ['charges-off-are-ignored', [TOTALS_LINES, { freight: off(1250.5), insurance: off(80), other: { value: 15 } }]],
  ['values-as-text-and-null', [TOTALS_LINES, { discount: on('3', 'PERCENT'), freight: on('100.005'), insurance: on(null) }]],
  ['negative-discount', [TOTALS_LINES, { discount: on(-5, 'PERCENT') }]],
  ['percent-of-odd-total', [[{ amount: 1000.1 }, { amount: 0.005 }], { discount: on(12.5, 'PERCENT') }]],
  ['unpriced-lines-add-nothing', [[{ amount: null, quantity: 10 }, { quantity: 5, amount: 12.5 }, { quantity: 2.5 }], {}]],
  ['half-cents-accumulate', [Array.from({ length: 7 }, () => ({ amount: 1.005, quantity: 1 })), { freight: on(0.005) }]],
  ['only-non-merchandise', [[SAMPLE_CHARGE], { discount: on(10, 'PERCENT') }]],
  ['empty-lines', [[], { freight: on(100) }]],
  ['null-lines', [null, { discount: on(250, 'AMOUNT') }]],
];
const TOTAL_CASES = TOTALS_CASES.map(([id, args]) => ({ id: `invoiceTotals/${id}`, fn: invoiceTotals, args }));
TOTAL_CASES.push(
  { id: 'invoiceTotals/throws/null-line', fn: invoiceTotals, args: [[FIRST_LINE, null], {}], throws: true },
  { id: 'invoiceTotals/throws/null-charges', fn: invoiceTotals, args: [TOTALS_LINES, null], throws: true },
);

const IGST_CASES = [
  ['five-percent', [24683.75, 96.45, 5]],
  ['twelve-percent', [24683.75, 96.45, 12]],
  ['rupee-invoice', [150000, 1, 5]],
  ['no-rate', [24683.75, null, 5]],
  ['zero-rate', [24683.75, 0, 12]],
  ['negative-rate', [24683.75, -96.45, 5]],
  ['rate-as-text', [24683.75, '96.45', 5]],
  ['no-igst-rate', [24683.75, 96.45, null]],
  ['no-net-total', [null, 96.45, 5]],
  ['half-paisa', [1.005, 1, 5]],
  ['fractional-igst-rate', [999.99, 83.1234, 0.1]],
  ['large', [12345678.9, 83.12, 18]],
  ['everything-missing', [null, null, null]],
];

const PL_TOTALS = {
  jomo: { cartons: 61, pieces: 3150, netWeightKg: 659.39, grossWeightKg: 719.3, cbm: 4.62, sizeQty: { M: 1000, L: 1150, XL: 1000 } },
  vgt: { cartons: 900, pieces: 32400, netWeightKg: 8044.4, grossWeightKg: 8678.6, cbm: 64.8 },
  prenatal: { cartons: 36, pieces: 2304, netWeightKg: 123, grossWeightKg: 141.6, cbm: 1.35 },
};
const AGGREGATE_CASES = [
  ['two-lists', [[PL_TOTALS.jomo, PL_TOTALS.vgt]]],
  ['three-lists', [[PL_TOTALS.jomo, PL_TOTALS.vgt, PL_TOTALS.prenatal]]],
  ['one-list', [[PL_TOTALS.prenatal]]],
  ['each-addition-rounds', [[{ netWeightKg: 0.0004 }, { netWeightKg: 0.0004 }, { netWeightKg: 0.0004 }]]],
  ['halves-round-up-each-time', [[{ grossWeightKg: 0.0005, cbm: 0.0015 }, { grossWeightKg: 0.0005, cbm: 0.0015 }, { grossWeightKg: 0.0005, cbm: 0.0015 }]]],
  ['missing-figures-add-nothing', [[{ cartons: 10 }, {}, { pieces: 5, cbm: 0.1 }]]],
  ['holes', [[null, PL_TOTALS.jomo, null]]],
  ['figures-as-text', [[{ cartons: '61', pieces: '3150', netWeightKg: '659.39' }, PL_TOTALS.prenatal]]],
  ['fractional-cartons-kept', [[{ cartons: 12.5, pieces: 0.5 }]]],
  ['empty', [[]]],
  ['null', [null]],
];

const SIZE_RANGE_CASES = [
  ['mens-preset', [['XL', 'M', 'XXL', 'L'], MENS_SIZES]],
  ['without-preset-alphabetical', [['XL', 'M', 'XXL', 'L']]],
  ['kids-preset', [['104', '74', '98', '140'], KIDS_EU_SIZES]],
  ['kids-numbers-without-preset', [['104', '74', '98', '110']]],
  ['baby-preset', [['86/92', '50/56', '62/68'], BABY_SIZES]],
  ['baby-months-without-preset', [['12-18M', '3-6M', '6-12M', '0-3M']]],
  ['one-size', [['M', 'M', ' M ']]],
  ['unknown-after-known', [['XL', '2XL', 'M', '5XL', '10XL'], ['M', 'L', 'XL']]],
  ['unranked-numbers-before-letters', [['S', 'M', '104'], ['M']]],
  ['preset-trimmed', [['M', 'L'], [' L ', ' M ']]],
  ['preset-repeat-ranks-last', [['M', 'L'], ['M', 'L', 'M']]],
  ['equal-numbers-keep-their-order', [['01', '1', '001']]],
  ['case-variants', [['XL', 'xl', 'Xl']]],
  ['numbers-as-numbers', [[74, 104, 80], [74, 80, 104]]],
  ['waist-lengths', [['32W/32L', '30W/32L', '30W/30L', '34W/32L']]],
  ['blanks-only', [['', ' ', null]]],
  ['empty', [[]]],
  ['null', [null]],
  ['null-preset-without-sizes', [[], null]],
];

const CASES = [
  ...COLOUR_NAMES.map(([id, name]) => ({ id: `defaultMatchColour/${id}`, fn: defaultMatchColour, args: [name] })),
  ...COLOUR_KEYS.map(([id, name]) => ({ id: `colourKey/${id}`, fn: colourKey, args: [name] })),
  ...[
    ['jomo-every-type', [JOMO]],
    ['jomo-pantone-matcher', [JOMO_ALL, { matchColour: 'colourKey' }]],
    ['jomo-default-matcher', [JOMO_ALL, { matchColour: 'default' }]],
    ['empty-options', [JOMO_ALL, {}]],
    ['vgt-numeric-sizes', [VGT]],
    ['prenatal-master-polybags', [PRENATAL, { matchColour: 'colourKey' }]],
    ['edge-rows', [Object.values(EDGE)]],
    ['mixed-colour-rows', [[EDGE.mixedEdge, J.mixed], { matchColour: 'colourKey' }]],
    ['unusable-rows-skipped', [[EDGE.noRange, EDGE.inverted, null, {}, EDGE.ratioNoPacks, EDGE.mixedNone]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `packedAtoms/${id}`, fn: packedAtoms, args })),
  {
    id: 'packedAtoms/jsonb-size-order',
    fn: packedAtoms,
    argsJson: '[[{"id":"j","packingType":"SOLID","cartonFrom":1,"cartonTo":1,"sizeQty":{"L":3,"M":1,"104":2},'
      + '"articleNos":{"L":"A-3","M":"A-1","104":"A-2"},"eanBySize":{"104":"8712345009999"}},'
      + '{"id":"m","packingType":"MIXED","cartonFrom":2,"cartonTo":3,"mixedRows":[{"colorName":"Navy","sizeQty":{"XL":1,"98":2}}]}]]',
  },
  ...SIZE_RANGE_CASES.map(([id, args]) => ({ id: `sizeRangeLabel/${id}`, fn: sizeRangeLabel, args })),
  { id: 'sizeRangeLabel/null-preset-throws', fn: sizeRangeLabel, args: [['M'], null], throws: true },
  ...TEMPLATE_CASES.map(([id, args]) => ({ id: `renderTemplate/${id}`, fn: renderTemplate, args })),
  { id: 'renderTemplate/scope-left-out', fn: renderTemplate, args: ['{{row.styleNo}} only'] },
  { id: 'DEFAULT_GROUP_BY/constant', fn: DEFAULT_GROUP_BY, args: [] },
  { id: 'GROUPABLE_KEYS/constant', fn: GROUPABLE_KEYS, args: [] },
  ...LINE_CASES,
  ...RECALC_CASES.map(([id, args]) => ({ id: `recalcLine/${id}`, fn: recalcLine, args })),
  { id: 'recalcLine/null-line-throws', fn: recalcLine, args: [null], throws: true },
  ...TOTAL_CASES,
  ...IGST_CASES.map(([id, args]) => ({ id: `igstBlock/${id}`, fn: igstBlock, args })),
  ...AGGREGATE_CASES.map(([id, args]) => ({ id: `aggregatePlTotals/${id}`, fn: aggregatePlTotals, args })),
  ...RATE_CASES.map(([id, args]) => ({ id: `makeRateResolver/${id}`, fn: makeRateResolver, args })),
];

test('expDocInvoiceCalc parity fixtures', () => {
  const { count } = writeFixtures('expDocInvoiceCalc', CASES, { api: API });
  expect(count).toBe(CASES.length);
});
