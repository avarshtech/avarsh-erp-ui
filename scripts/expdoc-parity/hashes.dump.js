// Parity fixtures for the hashing helpers of src/utils/expDocCalc.js -> erp-purchase ContentHashes (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The server keeps the browser's FNV-1a over canonical JSON for content and acknowledgement hashes (programme plan,
// Phase 0 step D): they only detect changes, and they must match bit for bit while the browser and the server both
// compute them. An acknowledgement given in the browser applies on the server only if the hash of its values agrees,
// and V-13 compares an invoice's stored packing-list hash with the server's.
//
// calc.dump.js lists these four as not ported; this dump ports them. Its `api` is just the four, so a case is still
// required for each. The rows are JOMO's, VGT's and Prenatal's demo cartons (as calc.dump.js has them); the cartons
// are expanded from those rows by the browser's own expandCartonNos, as a sticker run expands them.
import { test, expect } from 'vitest';
import * as calc from '../../src/utils/expDocCalc.js';
import { writeFixtures } from './writeFixtures.js';

const {
  canonical, fnv1a, contentHashOfRows, cartonHash, expandCartonNos,
} = calc;
const API = {
  canonical, fnv1a, contentHashOfRows, cartonHash,
};

const ch = (...codes) => String.fromCharCode(...codes);
const SEP = ch(0x241f); // the PO key separator, as expDocPoKeys.js has it

/** A packing-list row as rowsOfUnit + printedRows shape it, with every field a hash reads. */
const row = (id, over) => ({
  id,
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
  orderId: 1042,
  orderNo: 'SG/26-27/1042',
  buyerPoNo: 'PO-884213',
  destination: 'Rotterdam',
  poKey: `PO-884213${SEP}Rotterdam`,
  styleNo: 'ST-2026-0441',
  numberGroup: 'list',
  sourceEntryId: 101,
  packingDate: '2026-10-01',
  ...over,
  ownFrom: over.ownFrom ?? over.cartonFrom,
  ownTo: over.ownTo ?? over.cartonTo,
});

const J_SOLID = row('101:1-47', {
  cartonFrom: 1, cartonTo: 47, danNo: 'DAN-4471', colorName: 'Navy',
  articleNos: { M: 'ART-99120', L: 'ART-99121', XL: 'ART-99122' },
  eanBySize: { M: '8712345001018', L: '8712345001025', XL: '8712345001032' },
  sizeQty: { M: 10, L: 20, XL: 30 }, netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35,
});
const J_RATIO = row('101:48-57', {
  packingType: 'RATIO', cartonFrom: 48, cartonTo: 57, danNo: 'DAN-4472', colorName: 'Flame Scarlet 18-1662 TCX',
  ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
  netWeightKg: 9.2, grossWeightKg: 10, lengthCm: 60, breadthCm: 40, heightCm: 30,
});
const J_MIXED = row('101:58-60', {
  packingType: 'MIXED', cartonFrom: 58, cartonTo: 60, danNo: 'DAN-4473',
  mixedRows: [
    { colorName: 'Navy', sizeQty: { M: 5, L: 5 } },
    { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } },
  ],
  netWeightKg: 7, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25,
});
const J_EXTRA = row('101:61-61', {
  sectionKey: 'EXTRA', packingType: 'EXTRA', cartonFrom: 61, cartonTo: 61, danNo: 'DAN-4474', colorName: 'Navy',
  sizeQty: { M: 3, L: 4 }, netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20,
});
const JOMO = [J_SOLID, J_RATIO, J_MIXED, J_EXTRA];

const vgt = (id, cartonFrom, cartonTo, colorName, sizeQty, netWeightKg, grossWeightKg) => row(id, {
  orderId: 1055, orderNo: 'SG/26-27/1055', styleNo: 'ST-2026-0512', buyerPoNo: 'VGT-2026-771', destination: 'Antwerp',
  poKey: `VGT-2026-771${SEP}Antwerp`, cartonFrom, cartonTo, colorName, sizeQty, netWeightKg, grossWeightKg,
  lengthCm: 60, breadthCm: 40, heightCm: 30,
});
const VGT = [
  vgt('102:1-300', 1, 300, 'Ecru', { 74: 12, 80: 12, 86: 12 }, 8.4, 9.1),
  vgt('102:301-600', 301, 600, 'Ecru', { 92: 12, 98: 12, 104: 12 }, 9.1, 9.8),
  vgt('102:601-900', 601, 900, 'Dusty Rose', { 110: 12, 116: 12, 140: 10 }, 9.9, 10.6),
];

const PRENATAL = [
  row('103:1-24', {
    orderId: 1061, styleNo: 'ST-2026-0588', buyerPoNo: 'PRE-55120', packingType: 'MPB', cartonFrom: 1, cartonTo: 24,
    colorName: 'White', ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8,
    netWeightKg: 5.125, grossWeightKg: 5.9, lengthCm: 50, breadthCm: 30, heightCm: 25,
  }),
  row('103:25-36', {
    orderId: 1061, styleNo: 'ST-2026-0588', buyerPoNo: 'PRE-55120', cartonFrom: 25, cartonTo: 36, colorName: 'Soft Blue',
    sizeQty: { '74/80': 24, '86/92': 24 }, lengthCm: 50, breadthCm: 30, heightCm: 25, completionFlag: false,
  }),
];

// ─── canonical ────────────────────────────────────────────────────────────────────
const CANONICAL = [
  ['null', [null]],
  ['true', [true]],
  ['false', [false]],
  ['zero', [0]],
  ['integer', [42]],
  ['negative-fraction', [-17.25]],
  ['shortest-digits', [0.1 + 0.2]],
  ['large-integer-in-full', [123456789012345680000]],
  ['exponent-from-1e21', [1e21]],
  ['small-exponent', [1.5e-7]],
  ['small-plain', [0.000001]],
  ['largest-double', [Number.MAX_VALUE]],
  ['smallest-double', [Number.MIN_VALUE]],
  ['plain-string', ['Navy']],
  ['empty-string', ['']],
  ['escapes', ['quote " backslash \\ slash / tab \t newline \n return \r feed \f back \b']],
  ['control-characters', [ch(0, 1, 0x1f, 0x7f, 0x80, 0x9f)]],
  ['unicode-kept', [`Pr${ch(0xe9)}natal ${ch(0x2013)} PO${SEP}Rotterdam ${ch(0xa0)}`]],
  ['line-separators-kept', [ch(0x2028, 0x2029)]],
  ['surrogate-pair-kept', [`smile ${ch(0xd83d, 0xde00)}`]],
  ['lone-surrogates-escaped', [`${ch(0xd800)}x${ch(0xdc00)} ${ch(0xdbff)}`]],
  ['empty-object', [{}]],
  ['empty-array', [[]]],
  ['keys-sorted-at-every-level', [{ b: 1, a: 2, c: { z: 1, y: [{ q: 1, p: 2 }] } }]],
  ['array-index-keys-first', [{ XL: 30, M: 10, 104: 2, 74: 1, L: 20, 10: 0, 9: 0 }]],
  ['keys-that-are-not-indices', [{ '01': 1, '-1': 2, 1.5: 3, 4294967295: 4, 4294967294: 5, '50/56': 6, '': 7 }]],
  ['keys-by-code-unit', [{ b: 1, B: 2, a: 3, _: 4, [ch(0xe9)]: 5, Z: 6, [ch(0xd83d, 0xde00)]: 7, [ch(0xff5e)]: 8 }]],
  ['arrays-keep-their-order', [[3, 1, 2, { b: 1, a: 0 }, [2, 1]]]],
  ['nulls-kept', [{ a: null, b: [null, 1, null] }]],
  ['acknowledgement-values', [{ orderQty: 1500, shippedQty: 1410, missing: ['HS code', 'rate'], from: 1, to: null }]],
  ['nested-sizes', [{ sizeQty: { L: 20, M: 10 }, mixedRows: [{ sizeQty: { 98: 1, 104: 2 }, colorName: 'Ecru' }] }]],
  ['no-argument', []],
].map(([id, args]) => ({ id: `canonical/${id}`, fn: canonical, args }));
CANONICAL.push(
  // jsonb hands keys back in its own order; the browser re-orders integer keys when it parses, Jackson keeps the
  // text's order, and a long past 2^53 reads as the nearest double on both sides
  { id: 'canonical/jsonb-order-and-a-long', fn: canonical, argsJson: '[{"M":1,"104":2,"L":3,"10":4,"id":9007199254740993}]' },
  { id: 'canonical/number-written-as-a-decimal', fn: canonical, argsJson: '[{"qty":12.0,"rate":8.750,"big":1E3}]' },
);

// ─── fnv1a ────────────────────────────────────────────────────────────────────────
const FNV = [
  ['empty', ['']],
  ['a', ['a']],
  ['foobar', ['foobar']],
  ['digits', ['0123456789']],
  ['canonical-of-values', [canonical({ shippedQty: 1410, orderQty: 1500 })]],
  ['canonical-of-an-empty-object', ['{}']],
  ['latin-1', [`Pr${ch(0xe9)}natal`]],
  ['separator', [`PO-884213${SEP}Rotterdam`]],
  ['surrogate-pair-as-two-units', [ch(0xd83d, 0xde00)]],
  ['lone-surrogate', [ch(0xdc00)]],
  ['highest-unit', [ch(0xffff)]],
  ['long-text', ['ST-2026-0441||navy||xl '.repeat(200)]],
].map(([id, args]) => ({ id: `fnv1a/${id}`, fn: fnv1a, args }));

// ─── contentHashOfRows ────────────────────────────────────────────────────────────
const decorated = JOMO.map((r) => ({
  // Carton Packing's decorated copies and the printed numbering's own numbers: recomputed, never hashed
  ...r, cartonCount: 99, piecesPerCarton: 999, totalPieces: 9999, cbm: 9, ownFrom: 500, ownTo: 600, numberGroup: 'po:X',
  remarks: 'checked by QC', completionFlag: false, orderNo: 'SG/26-27/9999', sourceEntryId: 999,
}));
const ROW_CASES = [
  ['jomo-five-packing-types', [JOMO]],
  ['jomo-derived-fields-do-not-count', [decorated]],
  ['jomo-in-another-order', [[J_EXTRA, J_MIXED, J_RATIO, J_SOLID]]],
  ['jomo-renumbered', [JOMO.map((r) => ({ ...r, cartonFrom: r.cartonFrom + 100, cartonTo: r.cartonTo + 100 }))]],
  ['jomo-one-weight-changed', [[{ ...J_SOLID, grossWeightKg: 13.55 }, J_RATIO, J_MIXED, J_EXTRA]]],
  ['jomo-sizes-in-another-order', [[{ ...J_SOLID, sizeQty: { XL: 30, L: 20, M: 10 } }]]],
  ['jomo-solid-only', [[J_SOLID]]],
  ['mixed-colours-swapped', [[{ ...J_MIXED, mixedRows: [...J_MIXED.mixedRows].reverse() }]]],
  ['mixed-colour-with-article-and-ean-numbers', [[{
    ...J_MIXED,
    mixedRows: [J_MIXED.mixedRows[0], { ...J_MIXED.mixedRows[1], articleNos: { M: 'ART-99130' }, eanBySize: { M: '8712345002015' } }],
  }]]],
  ['mixed-hole', [[{ ...J_MIXED, mixedRows: [null, J_MIXED.mixedRows[0]] }]]],
  ['vgt-numeric-sizes', [VGT]],
  ['prenatal-mpb-and-missing-weights', [PRENATAL]],
  ['weights-missing-are-zero', [[{ ...J_SOLID, netWeightKg: null, grossWeightKg: 0, lengthCm: null }]]],
  ['nulls-and-blanks', [[{
    ...J_SOLID, packingType: null, packingCode: '', danNo: null, buyerPoNo: '', styleNo: null, colorName: '', sizeQty: {},
  }]]],
  ['fractional-weights', [[{ ...J_SOLID, netWeightKg: 0.1 + 0.2, grossWeightKg: 1e-7, lengthCm: 60.25 }]]],
  ['unicode-text', [[{ ...J_SOLID, colorName: `Cr${ch(0xe8)}me ${ch(0x2014)} ${ch(0xd83d, 0xde00)}`, styleNo: `ST${SEP}1` }]]],
  ['empty-list', [[]]],
  ['null-list', [null]],
  ['no-argument', []],
].map(([id, args]) => ({ id: `contentHashOfRows/${id}`, fn: contentHashOfRows, args }));
ROW_CASES.push(
  // jsonb's key order for sizes: the hash sorts them, whichever order they arrive in
  {
    id: 'contentHashOfRows/jsonb-size-order',
    fn: contentHashOfRows,
    argsJson: '[[{"cartonFrom":1,"cartonTo":2,"packingType":"SOLID","sizeQty":{"L":1,"104":2,"M":3,"98":4}}]]',
  },
  { id: 'contentHashOfRows/a-null-row-throws', fn: contentHashOfRows, args: [[J_SOLID, null]], throws: true },
);

// ─── cartonHash ───────────────────────────────────────────────────────────────────
// The print context a sticker run binds against (expDocMockStickers printScope): the list, its shipment, the
// carton's style, the buyer and the exporter. The carton itself is added as `carton`.
const CTX = {
  pl: { id: 7, plNo: 'PKL/26-27/1007', plDate: '2026-10-12', revision: 0 },
  shipment: { shipmentNo: 'SHP/26-27/1007', portOfDischarge: 'Rotterdam (NLRTM)', etd: '2026-10-20', containerNos: ['MSKU 1234567'] },
  style: { styleNo: 'ST-2026-0441-B', hsCode: '61051000', garmentName: "Men's Slim Fit Polo" },
  buyer: { name: 'JOMO BV', code: 'JOMO' },
  exporter: { name: 'Avarsh Garments Pvt Ltd', country: 'INDIA' },
};
const STANDARD = [
  'buyer.name', 'carton.buyerPoNo', 'carton.styleNo', 'carton.colorName', 'carton.sizes', 'carton.pieces',
  'carton.cartonNo', 'carton.destination', 'exporter.country', 'carton.netWeightKg', 'carton.grossWeightKg', 'carton.dimensions',
];
const [c1, c47, c48, c58, c61] = expandCartonNos(JOMO, [1, 47, 48, 58, 61]);
const [k1, k601] = expandCartonNos(VGT, [1, 601]);
const CARTON_CASES = [
  ['standard-marking-carton-1', [c1, STANDARD, CTX]],
  ['standard-marking-carton-47', [c47, STANDARD, CTX]],
  ['standard-marking-ratio', [c48, STANDARD, CTX]],
  ['standard-marking-mixed', [c58, STANDARD, CTX]],
  ['standard-marking-extra', [c61, STANDARD, CTX]],
  ['unbound-field-changed', [{ ...c1, packingCode: 'PK-7', danNo: 'DAN-0000', articleNo: 'ART-1' }, STANDARD, CTX]],
  ['bound-field-changed', [{ ...c1, colorName: 'Navy Blue' }, STANDARD, CTX]],
  ['style-path-is-not-the-carton-field', [c1, ['style.styleNo', 'carton.styleNo', 'style.hsCode'], CTX]],
  ['whole-objects', [c58, ['carton.mixedRows', 'carton.sizeQty', 'shipment'], CTX]],
  ['whole-carton', [c1, ['carton'], CTX]],
  ['index-and-length', [c1, ['carton.sizes.0', 'carton.sizes.2', 'carton.sizes.length', 'carton.colorName.length', 'carton.colorName.0', 'shipment.containerNos.0'], CTX]],
  ['missing-paths-left-out', [c1, ['carton.nope', 'nope.x', 'carton.styleNo.x', 'carton.pieces.x', '', 'carton.sizes.9'], CTX]],
  ['numeric-size-keys', [k1, ['carton.sizeQty.74', 'carton.sizeQty.80', 'carton.sizes', 'carton.cartonNo'], CTX]],
  ['vgt-carton-601', [k601, STANDARD, CTX]],
  ['null-namespace-kept-and-below-it-left-out', [c1, ['buyer', 'buyer.name', 'carton.styleNo'], { ...CTX, buyer: null }]],
  ['context-carton-is-replaced', [c1, ['carton.cartonNo', 'carton.styleNo'], { ...CTX, carton: { cartonNo: 999, styleNo: 'X' } }]],
  ['repeated-binding', [c1, ['carton.styleNo', 'carton.styleNo', 'carton.cartonNo'], CTX]],
  ['no-context', [c1, STANDARD]],
  ['null-context', [c1, STANDARD, null]],
  ['null-bindings', [c1, null, CTX]],
  ['null-carton', [null, ['carton', 'carton.cartonNo', 'buyer.name'], CTX]],
  ['nothing', []],
].map(([id, args]) => ({ id: `cartonHash/${id}`, fn: cartonHash, args }));

const CASES = [...CANONICAL, ...FNV, ...ROW_CASES, ...CARTON_CASES];

test('hashes parity fixtures', () => {
  const { count } = writeFixtures('expDocHashes', CASES, { api: API });
  expect(count).toBe(CASES.length);
});
