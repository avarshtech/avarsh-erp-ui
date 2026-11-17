// Parity fixtures for src/utils/expDocCalc.js -> erp-purchase CartonCalc, CartonRanges,
// CartonExpansion, OrderVsPacked and BindingPaths (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The rows are the demo cartons of services/expdoc/expDocMockData.js (JOMO's five packing types,
// VGT's 900-carton scale case, Prenatal's master polybags), written out here so the fixtures never
// change with today's date or fiscal year, plus the edge cases each rule has to survive.
import { test, expect } from 'vitest';
import * as calc from '../../src/utils/expDocCalc.js';
import { writeFixtures } from './writeFixtures.js';

const {
  round, round2, round3, round5, toMilliKg, fromMilliKg, toMm,
  cartonCount, piecesPerAssortment, piecesPerMpb, piecesPerCarton, totalPieces, sizeQtyPerCarton, totalSizeQty,
  cartonVolumeMm3, cbmPerCarton, dimensionsLabel, hasWeights, hasDimensions,
  rowTotals, sectionTotals, grandTotals, weightPerPiece, packedQuantities, orderVsPacked,
  toRanges, countCartons, findRangeOverlaps, findRangeGaps, mergeRanges, intersectRanges, rangesContain, formatRanges,
  expandCartons, expandCartonRange, expandCartonNos, readPath,
} = calc;

// The server hashes with SHA-256 (later phase), so the browser's FNV-1a staleness tokens are not ported
const NOT_PORTED = {
  canonical: 'sorted-key JSON for the FNV hash; the server hashes its own way',
  fnv1a: 'browser staleness token; the server uses SHA-256',
  contentHashOfRows: 'FNV-1a over canonical rows; replaced by a server hash',
  cartonHash: 'FNV-1a over sticker bindings; replaced by a server hash',
};

const SEP = String.fromCharCode(0x241f); // the PO key separator, as expDocPoKeys.js has it

// ─── Packing-list rows, as rowsOfUnit + printedRows shape them ────────────────────
const ENTRY = {
  jomo: { id: 101, orderId: 1042, orderNo: 'SG/26-27/1042', packingNo: 'CPK/26-27/1001', styleNo: 'ST-2026-0441', garmentName: "Men's Slim Fit Polo", compositionText: '95% COTTON 5% ELASTANE', packingDate: '2026-10-01' },
  vgt: { id: 102, orderId: 1055, orderNo: 'SG/26-27/1055', packingNo: 'CPK/26-27/1002', styleNo: 'ST-2026-0512', garmentName: "Girls' Printed Tee", compositionText: '100% ORGANIC COTTON', packingDate: '2026-10-03' },
  prenatal: { id: 103, orderId: 1061, orderNo: 'SG/26-27/1061', packingNo: 'CPK/26-27/1003', styleNo: 'ST-2026-0588', garmentName: 'Baby 3-pack Bodysuit', compositionText: '100% COTTON INTERLOCK', packingDate: '2026-10-05' },
};

const plRow = (entry, { groupId, ...g }) => {
  const poKey = `${g.buyerPoNo ?? ''}${SEP}${g.destination ?? ''}`;
  const sectionKey = g.sectionKey || 'MAIN';
  return {
    id: `${entry.id}:${poKey}:${sectionKey}:${g.cartonFrom}-${g.cartonTo}`,
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
    netWeightKg: null,
    grossWeightKg: null,
    lengthCm: null,
    breadthCm: null,
    heightCm: null,
    articleNos: null,
    eanBySize: null,
    orderLineId: 1,
    remarks: null,
    completionFlag: true,
    ...g,
    sectionKey,
    ownFrom: g.cartonFrom,
    ownTo: g.cartonTo,
    numberGroup: 'list',
    orderId: entry.orderId,
    orderNo: entry.orderNo,
    poKey,
    styleNo: g.styleNo || entry.styleNo,
    garmentName: entry.garmentName,
    compositionText: entry.compositionText,
    sourceEntryId: entry.id,
    sourceEntryNo: entry.packingNo,
    sourceGroupId: groupId,
    packingDate: entry.packingDate,
  };
};

const JOMO_PO = { buyerPoNo: 'PO-884213', destination: 'Rotterdam' };
const J_SOLID = plRow(ENTRY.jomo, {
  groupId: 1, ...JOMO_PO, packingType: 'SOLID', cartonFrom: 1, cartonTo: 47, danNo: 'DAN-4471', colorName: 'Navy',
  articleNos: { M: 'ART-99120', L: 'ART-99121', XL: 'ART-99122' },
  eanBySize: { M: '8712345001018', L: '8712345001025', XL: '8712345001032' },
  sizeQty: { M: 10, L: 20, XL: 30 }, netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35,
  // Carton Packing's decorated copies: carried, never read
  cartonCount: 47, piecesPerCarton: 60, totalPieces: 2820, cbm: 0.084,
});
const J_RATIO = plRow(ENTRY.jomo, {
  groupId: 2, ...JOMO_PO, packingType: 'RATIO', cartonFrom: 48, cartonTo: 57, danNo: 'DAN-4472', colorName: 'Flame Scarlet 18-1662 TCX',
  articleNos: { M: 'ART-99130', L: 'ART-99131', XL: 'ART-99132', XXL: 'ART-99133' },
  eanBySize: { M: '8712345002015', L: '8712345002022' },
  ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
  netWeightKg: 9.2, grossWeightKg: 10, lengthCm: 60, breadthCm: 40, heightCm: 30,
});
const J_MIXED = plRow(ENTRY.jomo, {
  groupId: 3, ...JOMO_PO, packingType: 'MIXED', cartonFrom: 58, cartonTo: 60, danNo: 'DAN-4473',
  articleNos: { M: 'ART-99120', L: 'ART-99121' },
  mixedRows: [
    { colorName: 'Navy', sizeQty: { M: 5, L: 5 } },
    { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 }, articleNos: { M: 'ART-99130' }, eanBySize: { M: '8712345002015' } },
  ],
  netWeightKg: 7, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25,
});
const J_EXTRA = plRow(ENTRY.jomo, {
  groupId: 4, ...JOMO_PO, sectionKey: 'EXTRA', packingType: 'EXTRA', cartonFrom: 61, cartonTo: 61, danNo: 'DAN-4474', colorName: 'Navy',
  articleNos: { M: 'ART-99120', L: 'ART-99121' },
  sizeQty: { M: 3, L: 4 }, netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20,
});
const JOMO_MAIN = [J_SOLID, J_RATIO, J_MIXED];
const JOMO_ALL = [...JOMO_MAIN, J_EXTRA];

const VGT_PO = { buyerPoNo: 'VGT-2026-771', destination: 'Antwerp' };
const vgt = (groupId, cartonFrom, cartonTo, colorName, sizeQty, netWeightKg, grossWeightKg) => plRow(ENTRY.vgt, {
  groupId, ...VGT_PO, cartonFrom, cartonTo, colorName, sizeQty, netWeightKg, grossWeightKg, lengthCm: 60, breadthCm: 40, heightCm: 30,
});
const VGT_ROWS = [
  vgt(5, 1, 300, 'Ecru', { 74: 12, 80: 12, 86: 12 }, 8.4, 9.1),
  vgt(6, 301, 600, 'Ecru', { 92: 12, 98: 12, 104: 12 }, 9.1, 9.8),
  vgt(7, 601, 860, 'Dusty Rose', { 110: 12, 116: 12, 122: 12 }, 9.9, 10.6),
  vgt(8, 861, 900, 'Dusty Rose', { 128: 10, 134: 10, 140: 10 }, 8.8, 9.5),
];

const PRE_PO = { buyerPoNo: 'PRE-55120', destination: 'Rotterdam' };
const P_MPB = plRow(ENTRY.prenatal, {
  groupId: 9, ...PRE_PO, packingType: 'MPB', cartonFrom: 1, cartonTo: 24, colorName: 'White',
  ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8,
  netWeightKg: 5.125, grossWeightKg: 5.9, lengthCm: 50, breadthCm: 30, heightCm: 25,
});
const P_NO_WEIGHT = plRow(ENTRY.prenatal, {
  groupId: 10, ...PRE_PO, cartonFrom: 25, cartonTo: 36, colorName: 'Soft Blue',
  sizeQty: { '74/80': 24, '86/92': 24 }, lengthCm: 50, breadthCm: 30, heightCm: 25, completionFlag: false,
});
const PRENATAL = [P_MPB, P_NO_WEIGHT];

/** A full row moved to other carton numbers, for the cases that list every carton. */
const at = (row, cartonFrom, cartonTo) => ({ ...row, cartonFrom, cartonTo, id: `${row.id}@${cartonFrom}` });

// ─── Lean rows: only what the arithmetic reads, plus the edges ────────────────────
const L = {
  solid: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 47, colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 }, netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35 },
  ratio: { packingType: 'RATIO', cartonFrom: 48, cartonTo: 57, ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4, netWeightKg: 9.2, grossWeightKg: 10, lengthCm: 60, breadthCm: 40, heightCm: 30 },
  mixed: { packingType: 'MIXED', cartonFrom: 58, cartonTo: 60, mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }], netWeightKg: 7, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25 },
  extra: { sectionKey: 'EXTRA', packingType: 'EXTRA', cartonFrom: 61, cartonTo: 61, sizeQty: { M: 3, L: 4 }, netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20 },
  mpb: { packingType: 'MPB', cartonFrom: 1, cartonTo: 24, ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8, netWeightKg: 5.125, grossWeightKg: 5.9, lengthCm: 50, breadthCm: 30, heightCm: 25 },
  kids: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 300, sizeQty: { 74: 12, 80: 12, 86: 12 }, netWeightKg: 8.4, grossWeightKg: 9.1, lengthCm: 60, breadthCm: 40, heightCm: 30 },
  noWeights: { packingType: 'SOLID', cartonFrom: 25, cartonTo: 36, sizeQty: { '74/80': 24, '86/92': 24 }, netWeightKg: null, grossWeightKg: null, lengthCm: 50, breadthCm: 30, heightCm: 25 },
  // A stored pieces-per-assortment wins over the ratio; the decorated copies are ignored
  storedPieces: { packingType: 'RATIO', cartonFrom: 5, cartonTo: 9, ratio: { S: 1, M: 2, L: 2, XL: 1 }, piecesPerAssortment: 7, assortmentsPerCarton: 3, cartonCount: 99, piecesPerCarton: 999, totalPieces: 9999, cbm: 9, netWeightKg: 6.3, grossWeightKg: 7 },
  storedZero: { packingType: 'RATIO', cartonFrom: 1, cartonTo: 2, ratio: { M: 1, L: 1 }, piecesPerAssortment: 0, assortmentsPerCarton: 2 },
  ratioFractional: { packingType: 'RATIO', cartonFrom: 1, cartonTo: 4, ratio: { M: 0.5, L: 1.25 }, assortmentsPerCarton: 3 },
  mpbFromRatio: { packingType: 'MPB', cartonFrom: 1, cartonTo: 10, ratio: { S: 1, M: 2, L: 3 }, pcsPerMpb: null, mpbPerCarton: 5 },
  mpbZeroPcs: { packingType: 'MPB', cartonFrom: 1, cartonTo: 10, ratio: { S: 1, M: 2 }, pcsPerMpb: 0, mpbPerCarton: 5 },
  mpbBare: { packingType: 'MPB', cartonFrom: 1, cartonTo: 10 },
  ratioNoPacks: { packingType: 'RATIO', cartonFrom: 1, cartonTo: 2, ratio: { M: 1, L: 1 }, assortmentsPerCarton: null },
  mixedEdge: { packingType: 'MIXED', cartonFrom: 70, cartonTo: 72, mixedRows: [null, { colorName: 'Navy', sizeQty: { M: 2, L: 0 } }, { colorName: 'Red' }, { colorName: 'navy ', sizeQty: { M: 1, XL: 3 } }] },
  mixedNone: { packingType: 'MIXED', cartonFrom: 1, cartonTo: 1, mixedRows: null },
  unknownType: { packingType: 'BUNDLE', cartonFrom: 1, cartonTo: 4, sizeQty: { M: 4, L: 4 } },
  noType: { cartonFrom: 3, cartonTo: 3, sizeQty: { M: 4 } },
  fractional: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 3, sizeQty: { M: 2.5, L: 0.5, XL: 0 }, netWeightKg: 0.3333, grossWeightKg: 0.6667, lengthCm: 33.3, breadthCm: 22.2, heightCm: 11.1 },
  negativeQty: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { S: 0, M: -2, L: 5 } },
  // Weights and dimensions that land on a half when scaled
  rounding: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 3, sizeQty: { M: 1 }, netWeightKg: 1.0005, grossWeightKg: 2.0005, lengthCm: 60.25, breadthCm: 40.05, heightCm: 35.15 },
  roundingMore: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 7, sizeQty: { M: 3 }, netWeightKg: 0.0005, grossWeightKg: 13.4995, lengthCm: 60.05, breadthCm: 40.95, heightCm: 35.55 },
  numericAndAlpha: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { XL: 1, 104: 2, M: 3, 98: 4 } },
  // Numbers typed as text, as a careless client might send them
  strings: { packingType: 'SOLID', cartonFrom: '3', cartonTo: '7', sizeQty: { M: '10', L: '' }, netWeightKg: '12.5', grossWeightKg: '13', lengthCm: '60', breadthCm: '40', heightCm: '35' },
  noRange: { packingType: 'SOLID', cartonFrom: null, cartonTo: 5, sizeQty: { M: 10 }, netWeightKg: 5 },
  inverted: { packingType: 'SOLID', cartonFrom: 10, cartonTo: 5, sizeQty: { M: 10 }, netWeightKg: 5 },
  zeroFrom: { packingType: 'SOLID', cartonFrom: 0, cartonTo: 3, sizeQty: { M: 1 } },
  // cartonCount checks for 0 only, so a negative start still counts
  negativeFrom: { packingType: 'SOLID', cartonFrom: -5, cartonTo: 10, sizeQty: { M: 2 }, netWeightKg: 1, grossWeightKg: 2, lengthCm: 10, breadthCm: 10, heightCm: 10 },
  large: { packingType: 'SOLID', cartonFrom: 1000000, cartonTo: 1999999, sizeQty: { M: 20, L: 20 }, netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35 },
  // Two billion cartons: the volume total passes 2^53, where double rounding has to agree
  huge: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 2000000000, sizeQty: { M: 30 }, netWeightKg: 11.111, grossWeightKg: 12.345, lengthCm: 61.3, breadthCm: 41.7, heightCm: 35.9 },
  zeroDim: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { M: 1 }, lengthCm: 0, breadthCm: 40, heightCm: 35 },
  tinyDim: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { M: 1 }, lengthCm: 0.04, breadthCm: 40, heightCm: 35 },
  negativeDim: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { M: 1 }, lengthCm: -60, breadthCm: 40, heightCm: 35, netWeightKg: -1, grossWeightKg: 2 },
  grossOnly: { packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { M: 1 }, netWeightKg: 1, grossWeightKg: 0 },
  empty: {},
  none: null,
};

const perRow = (fn, names, extra = []) => [
  ...names.map((name) => ({ id: `${fn.name}/${name}`, fn, args: [L[name]] })),
  ...extra.map(([id, args]) => ({ id: `${fn.name}/${id}`, fn, args })),
];

const ROW_CASES = [
  ...perRow(cartonCount, ['solid', 'ratio', 'mixed', 'extra', 'mpb', 'kids', 'noRange', 'inverted', 'zeroFrom', 'negativeFrom', 'large', 'huge', 'strings', 'numericAndAlpha', 'empty', 'none'], [
    ['single-carton', [{ cartonFrom: 7, cartonTo: 7 }]],
    ['near-int-max', [{ cartonFrom: 2147483000, cartonTo: 2147483647 }]],
  ]),
  ...perRow(piecesPerAssortment, ['ratio', 'storedPieces', 'storedZero', 'ratioFractional', 'ratioNoPacks', 'mpb', 'solid', 'strings', 'empty', 'none']),
  ...perRow(piecesPerMpb, ['mpb', 'mpbFromRatio', 'mpbZeroPcs', 'mpbBare', 'ratio', 'solid', 'empty', 'none']),
  ...perRow(piecesPerCarton, ['solid', 'ratio', 'mixed', 'extra', 'mpb', 'kids', 'noWeights', 'storedPieces', 'ratioFractional', 'mpbFromRatio', 'mpbBare', 'ratioNoPacks', 'mixedEdge', 'mixedNone', 'unknownType', 'noType', 'fractional', 'negativeQty', 'strings', 'empty', 'none']),
  ...perRow(totalPieces, ['solid', 'ratio', 'mixed', 'extra', 'mpb', 'kids', 'storedPieces', 'inverted', 'negativeFrom', 'large', 'huge', 'fractional', 'none']),
  ...perRow(sizeQtyPerCarton, ['solid', 'ratio', 'mixed', 'extra', 'mpb', 'kids', 'noWeights', 'ratioFractional', 'mpbFromRatio', 'mpbBare', 'ratioNoPacks', 'mixedEdge', 'mixedNone', 'unknownType', 'noType', 'fractional', 'negativeQty', 'numericAndAlpha', 'strings', 'empty', 'none']),
  ...perRow(totalSizeQty, ['solid', 'ratio', 'mixed', 'mpb', 'kids', 'mixedEdge', 'inverted', 'negativeFrom', 'fractional', 'numericAndAlpha', 'none']),
  ...perRow(cartonVolumeMm3, ['solid', 'ratio', 'mixed', 'extra', 'rounding', 'roundingMore', 'fractional', 'huge', 'zeroDim', 'negativeDim', 'strings', 'empty', 'none']),
  ...perRow(cbmPerCarton, ['solid', 'ratio', 'mixed', 'extra', 'rounding', 'fractional', 'huge', 'zeroDim', 'negativeDim', 'empty'], [
    ['five-decimals', [L.solid, { cbmDecimals: 5 }]],
    ['no-decimals', [L.solid, { cbmDecimals: 0 }]],
    ['zero-divisor-is-default', [L.solid, { cbmDivisor: 0 }]],
    ['volumetric-divisor', [L.solid, { cbmDivisor: 6000, cbmDecimals: 2 }]],
    ['null-decimals-is-default', [L.rounding, { cbmDecimals: null }]],
    ['null-config', [L.solid, null]],
  ]),
  ...perRow(dimensionsLabel, ['solid', 'extra', 'rounding', 'roundingMore', 'fractional', 'huge', 'zeroDim', 'tinyDim', 'negativeDim', 'strings', 'noRange', 'empty', 'none']),
  ...perRow(hasWeights, ['solid', 'noWeights', 'negativeDim', 'grossOnly', 'strings', 'fractional', 'empty', 'none']),
  ...perRow(hasDimensions, ['solid', 'zeroDim', 'tinyDim', 'negativeDim', 'strings', 'noRange', 'empty', 'none']),
  ...perRow(rowTotals, ['solid', 'ratio', 'mixed', 'extra', 'mpb', 'kids', 'noWeights', 'rounding', 'roundingMore', 'fractional', 'negativeFrom', 'large', 'huge', 'numericAndAlpha', 'none'], [
    ['one-weight-decimal', [L.solid, { weightDecimals: 1, cbmDecimals: 4 }]],
    ['two-weight-decimals', [L.rounding, { weightDecimals: 2 }]],
  ]),
];

// ─── Rounding and units ───────────────────────────────────────────────────────────
const ROUNDING_CASES = [
  ...[
    ['default-dp', [1.005]], ['classic-1.005', [1.005, 2]], ['1.335', [1.335, 2]], ['2.675', [2.675, 2]],
    ['negative', [-1.005, 2]], ['just-under-half', [1.0049999, 2]], ['half-to-0dp', [0.5, 0]], ['1.5-to-0dp', [1.5, 0]],
    ['2.5-to-0dp', [2.5, 0]], ['minus-half', [-0.5, 0]], ['minus-1.5', [-1.5, 0]], ['minus-2.5', [-2.5, 0]],
    ['123.456-0dp', [123.456, 0]], ['123.456-1dp', [123.456, 1]], ['4-decimals-at-3', [123.4565, 3]],
    ['tiny-5dp', [0.000015, 5]], ['tiny-5dp-b', [0.000025, 5]], ['sum-drift', [0.1 + 0.2, 2]],
    ['null', [null, 2]], ['text-number', ['3.14159', 3]], ['huge', [1e21, 2]], ['overflow-is-null', [1e308, 2]],
    ['big-weight', [1234567.8915, 3]],
  ].map(([id, args]) => ({ id: `round/${id}`, fn: round, args })),
  ...[[1.005], [1.335], [-2.675], [0.125], [null], [99.995], [1 / 3], [12.48 * 47]]
    .map((args, i) => ({ id: `round2/${i + 1}`, fn: round2, args })),
  ...[[1.0005], [0.0005], [2.0045], [-0.0005], [586.56], [1 / 3], [null], [12.4875]]
    .map((args, i) => ({ id: `round3/${i + 1}`, fn: round3, args })),
  ...[[0.000005], [0.0000049], [1 / 3], [2 / 3], [0.004425531914893617], [null], [12.123455], [-0.000015]]
    .map((args, i) => ({ id: `round5/${i + 1}`, fn: round5, args })),
  ...[[12.48], [2.005], [1.0005], [0.0005], [-0.0005], [null], ['2.5'], [13.4999], [9.2], [0.1 + 0.2]]
    .map((args, i) => ({ id: `toMilliKg/${i + 1}`, fn: toMilliKg, args })),
  ...[[12480], [2005], [0], [null], [1], [-1500], [123456789], [1.5]]
    .map((args, i) => ({ id: `fromMilliKg/${i + 1}`, fn: fromMilliKg, args })),
  ...[[60], [60.25], [40.05], [35.15], [0.05], [-0.05], [null], ['35.5'], [12.345], [999.95]]
    .map((args, i) => ({ id: `toMm/${i + 1}`, fn: toMm, args })),
];

// ─── Totals ───────────────────────────────────────────────────────────────────────
const EDGE_ROWS = [L.noRange, L.inverted, L.zeroFrom, L.empty, null, L.solid];
const JOMO_SECTIONS = [
  { key: 'MAIN', title: 'Packing List', order: 0, rows: JOMO_MAIN },
  { key: 'EXTRA', title: 'Extra Cartons', order: 1, rows: [J_EXTRA] },
];
const VGT_SECTIONS = [{ key: 'MAIN', title: 'Packing List', order: 0, rows: VGT_ROWS }];

const TOTALS_CASES = [
  ...[
    ['jomo-main', [JOMO_MAIN]],
    ['jomo-extra', [[J_EXTRA]]],
    ['vgt-900-cartons', [VGT_ROWS]],
    ['prenatal-missing-weights', [PRENATAL]],
    ['unusable-rows-add-nothing', [EDGE_ROWS]],
    ['empty', [[]]],
    ['null', [null]],
    ['large-and-huge', [[L.large, L.huge]]],
    ['halves-accumulate', [[L.rounding, L.rounding, L.roundingMore]]],
    ['two-decimals', [JOMO_ALL, { weightDecimals: 2, cbmDecimals: 2 }]],
    ['numeric-and-alpha-sizes', [[L.numericAndAlpha, L.kids, L.solid]]],
  ].map(([id, args]) => ({ id: `sectionTotals/${id}`, fn: sectionTotals, args })),
  ...[
    ['jomo-with-extra', [JOMO_SECTIONS]],
    ['vgt', [VGT_SECTIONS]],
    ['null', [null]],
    ['empty', [[]]],
    ['holes', [[{ key: 'MAIN', rows: null }, null, { key: 'EXTRA', rows: [L.extra, null] }]]],
    ['with-config', [JOMO_SECTIONS, { weightDecimals: 1, cbmDecimals: 5 }]],
    ['scale', [[{ key: 'MAIN', rows: [L.large] }, { key: 'EXTRA', rows: [L.huge] }]]],
    ['every-type', [[{ key: 'MAIN', rows: [...JOMO_MAIN, ...PRENATAL] }, { key: 'EXTRA', rows: [J_EXTRA] }]]],
  ].map(([id, args]) => ({ id: `grandTotals/${id}`, fn: grandTotals, args })),
  ...[
    ['jomo', [grandTotals(JOMO_SECTIONS)]],
    ['vgt', [grandTotals(VGT_SECTIONS)]],
    ['three-decimals', [grandTotals(JOMO_SECTIONS), { weightPerPieceDecimals: 3 }]],
    ['null-decimals-is-default', [{ pieces: 3, netWeightKg: 1, grossWeightKg: 2 }, { weightPerPieceDecimals: null }]],
    ['thirds', [{ pieces: 3, netWeightKg: 1, grossWeightKg: 2 }]],
    ['tiny', [{ pieces: 7, netWeightKg: 0.00001, grossWeightKg: 0.00005 }]],
    ['no-pieces', [{ pieces: 0, netWeightKg: 5, grossWeightKg: 6 }]],
    ['negative-pieces', [{ pieces: -4, netWeightKg: 1, grossWeightKg: 2 }]],
    ['empty', [{}]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `weightPerPiece/${id}`, fn: weightPerPiece, args })),
];

// ─── Order vs packed ──────────────────────────────────────────────────────────────
const ob = (styleNo, colorName, sizes, extra = {}) =>
  Object.entries(sizes).map(([size, orderQty]) => ({ styleNo, colorName, size, orderQty, ...extra }));
const JOMO_ORDERED = [
  ...ob('ST-2026-0441', 'Navy', { M: 488, L: 950, XL: 1500 }, { orderRate: 8.75, buyerPoNo: 'PO-884213', destination: 'Rotterdam' }),
  ...ob('ST-2026-0441', 'Flame Scarlet 18-1662 TCX', { M: 49, L: 86, XL: 80, XXL: 40 }, { orderRate: 8.75, buyerPoNo: 'PO-884213', destination: 'Rotterdam' }),
];
const blackRow = (cartonFrom, cartonTo, sizeQty, extra = {}) => ({ styleNo: 'NV-IT-2665', colorName: 'Black', cartonFrom, cartonTo, packingType: 'SOLID', sizeQty, ...extra });
const SPELLINGS = [
  { styleNo: ' ST-1 ', colorName: 'NAVY ', packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { M: 5 } },
  { styleNo: 'st-1', colorName: ' navy', packingType: 'SOLID', cartonFrom: 3, cartonTo: 3, sizeQty: { M: 1, ' L ': 2 } },
  { styleNo: null, colorName: null, packingType: 'SOLID', cartonFrom: 4, cartonTo: 4, sizeQty: { S: 1 } },
];

const VARIANCE_CASES = [
  ...[
    ['jomo', [JOMO_ALL]],
    ['spellings-merge', [SPELLINGS]],
    ['mixed-colours', [[L.mixedEdge, J_MIXED]]],
    ['ratio-without-packs-keeps-zero', [[{ ...L.ratioNoPacks, styleNo: 'ST-9', colorName: 'Red' }]]],
    ['vgt-numeric-sizes', [VGT_ROWS]],
    ['unusable-rows-skipped', [[L.noRange, L.inverted, null, {}]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `packedQuantities/${id}`, fn: packedQuantities, args })),
  ...[
    ['two-pos-one-colour', [
      [{ styleNo: 'NV-IT-2665', colorName: 'Black', size: 'L', orderQty: 40, buyerPoNo: 'NV-PO-57045' },
        { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'L', orderQty: 30, buyerPoNo: 'NV-PO-57046' }],
      [blackRow(1, 2, { L: 20 }), blackRow(3, 3, { L: 30 })]]],
    ['short-against-total', [
      [{ styleNo: 'NV-IT-2665', colorName: 'Black', size: 'M', orderQty: 40 }, { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'M', orderQty: 30 }],
      [blackRow(1, 3, { M: 20 })], { tolerancePercent: 5 }]],
    ['jomo-two-percent', [JOMO_ORDERED, JOMO_ALL, { tolerancePercent: 2 }]],
    ['jomo-no-tolerance', [JOMO_ORDERED, JOMO_ALL]],
    ['no-breakdown', [[], JOMO_ALL]],
    ['null-breakdown', [null, JOMO_ALL]],
    ['nothing-packed', [JOMO_ORDERED, null]],
    ['packed-not-ordered-keeps-labels', [[{ styleNo: 'st-1', colorName: 'Navy', size: 'M', orderQty: 5 }], SPELLINGS, { tolerancePercent: 10 }]],
    ['tolerance-as-text', [JOMO_ORDERED, JOMO_ALL, { tolerancePercent: '2' }]],
    ['tolerance-null', [JOMO_ORDERED, JOMO_ALL, { tolerancePercent: null }]],
    ['quantities-as-text-and-fractions', [
      [{ styleNo: 'NV-IT-2665', colorName: 'Black', size: 'M', orderQty: '40' }, { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'L', orderQty: 40.9 }],
      [blackRow(1, 2, { M: 20, L: 20 })]]],
    ['percent-rounding', [
      [{ styleNo: 'A', colorName: 'Red', size: 'S', orderQty: 20000 }, { styleNo: 'A', colorName: 'Red', size: 'M', orderQty: 3 },
        { styleNo: 'A', colorName: 'Red', size: 'L', orderQty: 3 }, { styleNo: 'A', colorName: 'Red', size: 'XL', orderQty: 8 }],
      [{ styleNo: 'A', colorName: 'Red', packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { S: 20201, M: 4, L: 2, XL: 9 } }],
      { tolerancePercent: 12.5 }]],
    ['negative-ordered', [[{ styleNo: 'A', colorName: 'Red', size: 'S', orderQty: -5 }], [{ styleNo: 'A', colorName: 'Red', packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { S: 5 } }], { tolerancePercent: 100 }]],
    ['first-label-wins', [
      [{ styleNo: 'ST-1', colorName: 'Navy', size: 'M', orderQty: 2 }, { styleNo: 'st-1 ', colorName: 'NAVY', size: ' M', orderQty: 4 }],
      SPELLINGS]],
    ['mixed-carton-colours', [[{ styleNo: 'ST-2026-0441', colorName: 'navy', size: 'M', orderQty: 15 }], [J_MIXED]]],
  ].map(([id, args]) => ({ id: `orderVsPacked/${id}`, fn: orderVsPacked, args })),
  // Packed sizes nobody ordered follow the size order, which the browser takes "104" first in
  {
    id: 'orderVsPacked/jsonb-size-order',
    fn: orderVsPacked,
    argsJson: '[[{"styleNo":"A","colorName":"Red","size":"XS","orderQty":1}],'
      + '[{"styleNo":"A","colorName":"Red","packingType":"SOLID","cartonFrom":1,"cartonTo":1,"sizeQty":{"L":3,"M":1,"104":2}}]]',
  },
  // A null ordered line is a caller's bug: the browser throws on it, and so must the server
  { id: 'orderVsPacked/null-line-throws', fn: orderVsPacked, args: [[null], JOMO_ALL], throws: true },
];

// ─── Carton ranges ────────────────────────────────────────────────────────────────
const r = (from, to) => ({ from, to });
const lean = (id, cartonFrom, cartonTo, extra = {}) => ({ id, packingType: 'SOLID', cartonFrom, cartonTo, sizeQty: { M: 1 }, ...extra });

const RANGE_CASES = [
  ...[
    ['jomo-unsorted', [[J_EXTRA, J_MIXED, J_SOLID, J_RATIO]]],
    ['unusable-rows-dropped', [[L.noRange, L.inverted, L.zeroFrom, L.negativeFrom, null, {}, lean('ok', 4, 6)]]],
    ['same-start-sorted-by-end', [[lean('b', 5, 9), lean('a', 5, 6), lean('c', 1, 1)]]],
    ['no-id', [[{ packingType: 'SOLID', cartonFrom: 2, cartonTo: 3 }]]],
    ['overlapping', [[lean('x', 1, 10), lean('y', 5, 15)]]],
    ['large-numbers', [[lean('big', 1000000, 1999999), lean('small', 1, 1)]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `toRanges/${id}`, fn: toRanges, args })),
  ...[
    ['adjacent', [[r(1, 47), r(48, 57)]]],
    ['overlapping', [[r(1, 10), r(5, 15)]]],
    ['gapped', [[r(1, 10), r(20, 30)]]],
    ['nested', [[r(1, 100), r(10, 20)]]],
    ['unsorted-duplicates', [[r(20, 30), r(1, 5), r(20, 30)]]],
    ['backwards-and-missing-skipped', [[r(5, 3), { from: null, to: 5 }, null, r(1, 1)]]],
    ['below-one-still-counts', [[r(-3, 2)]]],
    ['near-int-max', [[r(1, 2147483646), r(2147483647, 2147483647)]]],
    ['from-row-ranges', [toRanges(JOMO_ALL)]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `countCartons/${id}`, fn: countCartons, args })),
  ...[
    ['none', [[r(1, 10), r(20, 30)]]],
    ['adjacent-is-not-overlap', [[r(1, 10), r(11, 20)]]],
    ['overlapping', [[r(1, 10), r(5, 15)]]],
    ['identical', [[r(3, 8), r(3, 8)]]],
    ['nested', [[r(1, 100), r(10, 20)]]],
    // Only neighbours are compared: 30-40 is inside 1-100, but 10-20 sits between them
    ['long-range-hides-a-later-overlap', [[r(1, 100), r(10, 20), r(30, 40)]]],
    ['unsorted', [[r(50, 60), r(1, 10), r(8, 12)]]],
    ['chain', [[r(1, 5), r(4, 9), r(9, 12)]]],
    ['row-ranges-carry-their-rows', [toRanges([lean('a', 1, 10), lean('b', 10, 12, { colorName: 'Red' })])]],
    ['single-null-is-nothing', [[null]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `findRangeOverlaps/${id}`, fn: findRangeOverlaps, args })),
  { id: 'findRangeOverlaps/null-range-throws', fn: findRangeOverlaps, args: [[r(1, 2), null]], throws: true },
  ...[
    ['one-gap', [[r(1, 47), r(50, 57)]]],
    ['adjacent', [[r(1, 47), r(48, 57)]]],
    ['overlapping', [[r(1, 10), r(5, 15)]]],
    ['single', [[r(1, 10)]]],
    ['unsorted-several', [[r(40, 45), r(1, 5), r(10, 20), r(22, 22)]]],
    ['wide-gap', [[r(1, 1), r(1000000, 1000000)]]],
    ['backwards-skipped', [[r(1, 2), r(9, 4), r(6, 7)]]],
    ['near-int-max', [[r(1, 5), r(2147483640, 2147483647)]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `findRangeGaps/${id}`, fn: findRangeGaps, args })),
  ...[
    ['overlap', [[r(1, 10), r(5, 15)]]],
    ['adjacent', [[r(1, 10), r(11, 20)]]],
    ['nested', [[r(1, 100), r(10, 20)]]],
    ['unsorted', [[r(30, 40), r(1, 5), r(6, 8)]]],
    ['duplicates', [[r(2, 4), r(2, 4)]]],
    ['backwards-skipped', [[r(9, 4), r(1, 2)]]],
    ['nulls-skipped', [[null, { from: null, to: 3 }, { from: 1 }, r(7, 7)]]],
    ['below-one-kept', [[r(-3, 0), r(1, 2)]]],
    ['near-int-max', [[r(2147483600, 2147483646), r(2147483647, 2147483647)]]],
    ['row-ranges-lose-their-rows', [toRanges(JOMO_ALL)]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `mergeRanges/${id}`, fn: mergeRanges, args })),
  ...[
    ['disjoint', [[r(1, 10)], [r(20, 30)]]],
    ['partial', [[r(1, 10)], [r(5, 15)]]],
    ['nested', [[r(1, 100)], [r(10, 20), r(30, 40)]]],
    ['several-pieces', [[r(1, 10), r(20, 30)], [r(5, 25)]]],
    ['unmerged-inputs', [[r(1, 6), r(4, 10)], [r(2, 3), r(3, 9)]]],
    ['identical', [[r(4, 9)], [r(4, 9)]]],
    ['adjacent-is-empty', [[r(1, 5)], [r(6, 9)]]],
    ['single-carton', [[r(1, 5)], [r(5, 5)]]],
    ['empty-side', [[], [r(1, 5)]]],
    ['null-side', [[r(1, 5)], null]],
  ].map(([id, args]) => ({ id: `intersectRanges/${id}`, fn: intersectRanges, args })),
  ...[
    ['inside', [[r(1, 47), r(52, 52)], 10]],
    ['at-start', [[r(1, 47)], 1]],
    ['at-end', [[r(1, 47)], 47]],
    ['in-a-gap', [[r(1, 47), r(52, 52)], 50]],
    ['single-carton', [[r(1, 47), r(52, 52)], 52]],
    ['outside', [[r(1, 47)], 48]],
    ['unsorted-overlapping', [[r(40, 60), r(1, 45)], 44]],
    ['large-number', [[r(1000000, 1999999)], 1999999]],
    ['empty', [[], 1]],
    ['null-ranges', [null, 1]],
    // A null carton number compares as 0, so it is "in" a range that starts below 1
    ['null-number', [[r(1, 47)], null]],
    ['null-number-below-one', [[r(-2, 3)], null]],
  ].map(([id, args]) => ({ id: `rangesContain/${id}`, fn: rangesContain, args })),
  ...[
    ['one-range', [[r(1, 47)]]],
    ['one-carton', [[r(5, 5)]]],
    ['ranges-and-singles', [[r(1, 47), r(52, 52), r(60, 63)]]],
    ['unsorted', [[r(60, 63), r(1, 47), r(52, 52)]]],
    ['overlaps-merged', [[r(1, 10), r(5, 20)]]],
    ['adjacent-merged', [[r(1, 10), r(11, 20)]]],
    ['large-numbers', [[r(1000000, 1999999), r(2000001, 2000001)]]],
    ['row-ranges', [toRanges(JOMO_ALL)]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `formatRanges/${id}`, fn: formatRanges, args })),
];

// ─── Carton expansion ─────────────────────────────────────────────────────────────
// Few cartons per case: every carton prints in full
const JOMO_SMALL = [at(J_SOLID, 1, 2), at(J_RATIO, 3, 4), at(J_MIXED, 5, 5), at(J_EXTRA, 6, 6)];
const PRENATAL_SMALL = [at(P_MPB, 1, 2), at(P_NO_WEIGHT, 3, 3)];
const ODD_SMALL = [
  lean('neg', 1, 1, { sizeQty: { S: 0, M: -2, L: 5 } }),
  lean('frac', 2, 2, { sizeQty: { M: 2.5, L: 0.5 }, netWeightKg: 0.3333, grossWeightKg: 0.6667, lengthCm: 60.25, breadthCm: 40.05, heightCm: 35.15 }),
  lean('ratio-no-packs', 3, 3, { packingType: 'RATIO', sizeQty: null, ratio: { M: 1, L: 1 } }),
  lean('articles', 4, 4, { sizeQty: { M: 2, L: 2, XL: 0 }, articleNos: { M: 'A-1', L: 'A-1', XL: 'A-9', S: 'A-0' } }),
  lean('blank-article', 5, 5, { sizeQty: { M: 2, L: 2 }, articleNos: { M: '', L: 'A-2' } }),
];
// Sizes in jsonb's order (shorter keys first): the browser lists "104" first, and so must the server
const JSONB_ORDER_ROWS = '[[{"id":"jsonb","packingType":"SOLID","cartonFrom":1,"cartonTo":1,"sizeQty":{"L":3,"M":1,"XL":2,"104":2},'
  + '"articleNos":{"L":"A-3","M":"A-1","XL":"A-4","104":"A-2"},"eanBySize":{"M":"8712345001018","104":"8712345009999"}}]]';

const EXPAND_CASES = [
  ...[
    ['jomo-every-type', [JOMO_SMALL]],
    ['shipment-total', [JOMO_SMALL, { totalCartonsInShipment: 120 }]],
    ['zero-total-is-counted', [PRENATAL_SMALL, { totalCartonsInShipment: 0 }]],
    ['config', [PRENATAL_SMALL, { cfg: { cbmDecimals: 5 } }]],
    ['overlapping-rows-repeat-numbers', [[lean('a', 1, 2), lean('b', 2, 3, { colorName: 'Red' })]]],
    ['unusable-rows-skipped', [[L.noRange, null, lean('ok', 9, 10), L.inverted]]],
    ['odd-quantities', [ODD_SMALL]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `expandCartons/${id}`, fn: expandCartons, args })),
  { id: 'expandCartons/jsonb-size-order', fn: expandCartons, argsJson: JSONB_ORDER_ROWS },
  { id: 'expandCartons/null-context-throws', fn: expandCartons, args: [JOMO_SMALL, null], throws: true },
  ...[
    ['middle-slice', [JOMO_SMALL, 2, 4]],
    ['one-carton', [JOMO_SMALL, 5, 5]],
    ['backwards-is-empty', [JOMO_SMALL, 4, 2]],
    ['beyond-the-list', [JOMO_SMALL, 50, 60]],
    ['from-null-is-zero', [JOMO_SMALL, null, 2]],
    ['to-null-is-empty', [JOMO_SMALL, 1, null]],
    ['overlapping-rows', [[lean('a', 1, 4), lean('b', 3, 6, { colorName: 'Red' })], 3, 4]],
    ['large-numbers', [[lean('small', 1, 3), lean('big', 1000000, 1000005)], 1000002, 1000003]],
    // Ten million cartons before the slice: the ordinal still counts every one of them
    ['deep-slice', [[lean('long', 1, 10000000), lean('tail', 10000001, 10000002)], 9999999, 10000001]],
    ['shipment-total', [PRENATAL_SMALL, 1, 3, { totalCartonsInShipment: 61, cfg: { cbmDecimals: 2 } }]],
    ['null-rows', [null, 1, 5]],
  ].map(([id, args]) => ({ id: `expandCartonRange/${id}`, fn: expandCartonRange, args })),
  { id: 'expandCartonRange/null-context-throws', fn: expandCartonRange, args: [JOMO_SMALL, 1, 2, null], throws: true },
  ...[
    ['picked', [JOMO_SMALL, [2, 5]]],
    ['range-order-not-asked-order', [JOMO_SMALL, [6, 1, 3]]],
    ['repeats-once', [JOMO_SMALL, [4, 4, 4]]],
    ['missing-numbers-skipped', [JOMO_SMALL, [7, 99, 0, -1]]],
    ['nulls-read-as-zero', [JOMO_SMALL, [null, 3]]],
    ['numbers-as-text', [JOMO_SMALL, ['2', '6']]],
    ['overlapping-rows-repeat', [[lean('a', 1, 4), lean('b', 3, 6, { colorName: 'Red' })], [3]]],
    ['deep-numbers', [[lean('long', 1, 10000000)], [10000000, 1]]],
    ['shipment-total', [PRENATAL_SMALL, [3], { totalCartonsInShipment: 61 }]],
    ['empty', [JOMO_SMALL, []]],
    ['null', [JOMO_SMALL, null]],
    // Nothing asked for: the browser returns before it reads the context
    ['nothing-asked-null-context', [JOMO_SMALL, [], null]],
  ].map(([id, args]) => ({ id: `expandCartonNos/${id}`, fn: expandCartonNos, args })),
  { id: 'expandCartonNos/null-context-throws', fn: expandCartonNos, args: [JOMO_SMALL, [1], null], throws: true },
];

// ─── Binding paths ────────────────────────────────────────────────────────────────
const PRINT_CTX = {
  pl: { plNo: 'PKL/26-27/0007', totals: { cartons: 61, pieces: 3150 } },
  shipment: { vessel: null, pos: [{ buyerPoNo: 'PO-884213' }, { buyerPoNo: 'PO-884214' }] },
  style: { styleNo: 'ST-2026-0441', season: 'AW26' },
  carton: { cartonNo: 5, styleNo: 'CARTON-STYLE', sizes: ['M', 'L'], sizeText: 'M / L', eanBySize: { M: '8712345001018' }, blank: '', zero: 0, flag: false },
  sizes: { 74: 'seventy-four' },
};
const READ_PATH_CASES = [
  ['field', 'pl.plNo'], ['nested', 'pl.totals.cartons'], ['null-leaf', 'shipment.vessel'], ['below-null', 'shipment.vessel.name'],
  ['array-index', 'shipment.pos.1.buyerPoNo'], ['array-length', 'shipment.pos.length'], ['past-the-end', 'shipment.pos.2'],
  ['string-length', 'carton.sizeText.length'], ['string-index', 'carton.sizeText.0'], ['map-entry', 'carton.eanBySize.M'],
  ['missing-entry', 'carton.eanBySize.XL'], ['style-not-carton', 'style.styleNo'], ['carton-own', 'carton.styleNo'],
  ['blank', 'carton.blank'], ['zero', 'carton.zero'], ['false', 'carton.flag'], ['number-has-no-members', 'carton.cartonNo.x'],
  ['whole-object', 'carton.eanBySize'], ['missing-branch', 'missing.deep.path'], ['empty-path', ''], ['empty-segment', 'pl..plNo'],
  ['numeric-key', 'sizes.74'],
].map(([id, p]) => ({ id: `readPath/${id}`, fn: readPath, args: [PRINT_CTX, p] }));
READ_PATH_CASES.push(
  { id: 'readPath/null-source', fn: readPath, args: [null, 'pl.plNo'] },
  { id: 'readPath/array-source', fn: readPath, args: [[10, 20, 30], '1'] },
  { id: 'readPath/number-path', fn: readPath, args: [{ 1: 'one' }, 1] },
);

const CASES = [...ROUNDING_CASES, ...ROW_CASES, ...TOTALS_CASES, ...VARIANCE_CASES, ...RANGE_CASES, ...EXPAND_CASES, ...READ_PATH_CASES];

test('expDocCalc parity fixtures', () => {
  const { count } = writeFixtures('expDocCalc', CASES, { api: calc, notPorted: NOT_PORTED });
  expect(count).toBe(CASES.length);
});
