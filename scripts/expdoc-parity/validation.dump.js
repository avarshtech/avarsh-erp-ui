// Parity fixtures for src/utils/expDocValidation.js -> erp-purchase com.avarsh.erp.exportdoc.validation (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The contexts are built the way the browser builds them today, from the browser's own helpers:
//  - a packing list's SAVE / SUBMIT check as expDocMockPackingLists.decoratePl assembles it (the list, its shipment,
//    template, totals, tolerance, order breakdown, the shipment's lists, packedElsewhere, the colourKey matcher,
//    the order blocks with their buyer-plan matches, coveredPos);
//  - the finalise re-check at APPROVE (changeStatus), which leaves out shipment, blocks and coveredPos;
//  - the sticker pre-flight at STICKER (expDocMockStickers.checkStickerGeneration);
//  - Carton Packing's check of one entry (CartonPackingForm): only rows, without numbering groups;
//  - an invoice as expDocMockInvoices.decorateInvoice assembles it.
// Acknowledgements are built by the browser's buildAcknowledgement from the browser's own findings, so a case that
// says one applies, or no longer applies after an edit, is true by construction. A case about one rule leaves out
// the context keys that rule does not read (ruleCtx), so the fixture stays lean and the rule's findings are not
// buried under the quantity rules'; the whole context is in the jomo, V-01, quantity, V-15 and gate cases.
//
// Named adapters (README.md):
//  - validate(ctx, options): ctx.matchColour 'colourKey' is services/expdoc/expDocMockCommon.js's colourKey (left
//    out, the browser's default); ctx.coveredPos is written as an array and made the Set the browser keeps;
//    options.rules, when given, names rules by code and becomes those RULES entries in that order.
//  - RULES: the catalogue as data: each rule's code, title, phases, and its severity at every phase (V-08's is a
//    function of the phase).
import { test, expect } from 'vitest';
import * as validation from '../../src/utils/expDocValidation.js';
import {
  grandTotals, sectionTotals, contentHashOfRows, packedQuantities,
} from '../../src/utils/expDocCalc.js';
import { aggregatePlTotals } from '../../src/utils/expDocInvoiceCalc.js';
import { matchPlan, planChip } from '../../src/utils/expDocPlanMatch.js';
import { colourKey } from '../../src/services/expdoc/expDocMockCommon.js';
import { SYSTEM_TEMPLATES, STANDARD_PL_HEADER_FIELDS } from '../../src/utils/expDocSystemTemplates.js';
import { PHASE } from '../../src/utils/expDocConstants.js';
import { writeFixtures } from './writeFixtures.js';

const { makeTargetKey, acknowledgementApplies, buildAcknowledgement } = validation;

// ─── Adapters ─────────────────────────────────────────────────────────────────────
const MATCHERS = { colourKey };
const RULE_BY_CODE = new Map(validation.RULES.map((r) => [r.code, r]));

const validate = function validate(ctx, options) {
  const real = { ...ctx };
  if (typeof ctx.matchColour === 'string') real.matchColour = MATCHERS[ctx.matchColour];
  if (Array.isArray(ctx.coveredPos)) real.coveredPos = new Set(ctx.coveredPos);
  if (options === undefined) return validation.validate(real);
  if (!Array.isArray(options.rules)) return validation.validate(real, options);
  return validation.validate(real, { ...options, rules: options.rules.map((code) => RULE_BY_CODE.get(code)) });
};

const RULES = function RULES() {
  return validation.RULES.map((rule) => ({
    code: rule.code,
    title: rule.title,
    phases: rule.phases,
    severity: Object.fromEntries(Object.values(PHASE)
      .map((phase) => [phase, typeof rule.severity === 'function' ? rule.severity(phase) : rule.severity])),
  }));
};

const API = { ...validation, validate, RULES };

// ─── Rows ─────────────────────────────────────────────────────────────────────────
const ch = (...codes) => String.fromCharCode(...codes);
const SEP = ch(0x241f); // the PO key separator, as expDocPoKeys.js has it
const EN_DASH = ch(0x2013); // formatRanges joins a range's ends with it
const EM_DASH = ch(0x2014); // the invoice description template separates its parts with it
const K_RTM = `PO-884213${SEP}Rotterdam`;
const K_HAM = `PO-884250${SEP}Hamburg`;

const NAVY = {
  packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10, L: 20, XL: 30 },
  netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35,
};
const BLACK = { ...NAVY, colorName: 'Black', sizeQty: { M: 12, L: 20, XL: 30 } };
const SCARLET_RATIO = {
  packingType: 'RATIO', colorName: 'Flame Scarlet 18-1662 TCX', ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
  netWeightKg: 9.2, grossWeightKg: 10, lengthCm: 60, breadthCm: 40, heightCm: 30,
};
const MIXED = {
  packingType: 'MIXED', colorName: null,
  mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }],
  netWeightKg: 7, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25,
};
const MIXED_BLACK = { ...MIXED, mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Black', sizeQty: { M: 3, L: 2 } }] };
const NAVY_EXTRA = {
  sectionKey: 'EXTRA', packingType: 'EXTRA', colorName: 'Navy', sizeQty: { M: 3, L: 4 },
  netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20,
};

/**
 * A packing-list row as rowsOfUnit + printedRows shape it: JOMO's order 1042, PO-884213 to Rotterdam, unless said.
 * Kept to the fields a filled-in row carries (a stored row has the rest as null): no rule tells a null field from a
 * missing one except where a message prints it, and the carton numbers that messages print are always here. A row
 * appears three times in a context (the list, the shipment's lists, the order blocks), so the fixture stays lean.
 */
const row = (id, from, to, contents = NAVY, extra = {}) => ({
  id,
  sectionKey: 'MAIN',
  packingCode: null,
  danNo: 'DAN-4471',
  completionFlag: true,
  orderId: 1042,
  orderNo: 'SG/26-27/1042',
  styleNo: 'ST-2026-0441',
  buyerPoNo: 'PO-884213',
  destination: 'Rotterdam',
  poKey: K_RTM,
  sourceEntryId: 101,
  numberGroup: 'list',
  ...contents,
  cartonFrom: from,
  cartonTo: to,
  ...extra,
});
const HAM = {
  buyerPoNo: 'PO-884250', destination: 'Hamburg', poKey: K_HAM, sourceEntryId: 104,
};

const J1 = row('101:1-47', 1, 47);
const J2 = row('101:48-57', 48, 57, SCARLET_RATIO, { danNo: 'DAN-4472', sourceGroupId: 2 });
const J3 = row('101:58-60', 58, 60, MIXED, { danNo: 'DAN-4473', sourceGroupId: 3 });
const J4 = row('101:61-61', 61, 61, NAVY_EXTRA, { danNo: 'DAN-4474', sourceGroupId: 4 });
const JOMO = [J1, J2, J3, J4];

// ─── Documents ────────────────────────────────────────────────────────────────────
const CONSIGNEE = { name: 'JOMO BV', block: 'JOMO BV\nKeizersgracht 214\n1016 DZ Amsterdam\nNetherlands' };
const SHIPMENT = {
  id: 31, shipmentNo: 'SHP/26-27/1007', status: 'OPEN', buyerId: 12, buyerName: 'JOMO BV', etd: '2026-10-20', eta: '2026-11-18',
  modeOfTransport: 'SEA', vesselFlightNo: 'MAERSK KENSINGTON 442W', portOfLoadingName: 'Chennai', portOfLoading: 'Chennai (INMAA)',
  portOfDischargeName: 'Rotterdam', portOfDischarge: 'Rotterdam (NLRTM)', finalDestination: 'Amsterdam',
  containerNos: ['MSKU 1234567'], containerCount: 1, consignee: CONSIGNEE,
  notify: { kind: 'BANK', name: 'ING Bank N.V.', block: 'ING Bank N.V.\nBijlmerdreef 106\nAmsterdam' },
  orders: [{ orderId: 1042, orderNo: 'SG/26-27/1042', styleNo: 'ST-2026-0441' }], orderNos: ['SG/26-27/1042'],
  packingListCount: 2, invoiceCount: 1,
};

const sectionsOf = (rows) => ['MAIN', 'EXTRA']
  .map((key, order) => {
    const own = rows.filter((r) => (r.sectionKey || 'MAIN') === key);
    return { key, title: key === 'MAIN' ? 'Packing List' : 'Extra Cartons', order, rows: own, totals: sectionTotals(own) };
  })
  .filter((s) => s.rows.length);

/** A packing list as decoratePl hands it to validate, with the header fields a template may bind. */
const plOf = (id, plNo, rows, extra = {}) => {
  const sections = sectionsOf(rows);
  return {
    id,
    plNo,
    revision: 0,
    status: 'DRAFT',
    shipmentId: 31,
    shipmentNo: 'SHP/26-27/1007',
    buyerId: 12,
    buyerName: 'JOMO BV',
    plDate: '2026-10-12',
    descriptionOfGoods: "MEN'S KNITTED POLO SHIRTS, 95% COTTON 5% ELASTANE",
    marksAndNos: 'JOMO / ROTTERDAM / C/NO. 1-61',
    containerNo: null,
    sealNo: null,
    remarks: null,
    numbering: 'CONTINUE',
    firstCartonNo: 1,
    tolerancePercent: 2,
    orderNos: ['SG/26-27/1042'],
    sections,
    totals: grandTotals(sections),
    contentHash: contentHashOfRows(rows),
    version: 3,
    resolved: { consignee: CONSIGNEE, containerNo: 'MSKU 1234567', sealNo: null },
    overridden: { containerNo: false },
    ...extra,
  };
};

const pick = (tpl) => ({
  id: tpl.id,
  templateCode: tpl.templateCode,
  name: tpl.name,
  docType: tpl.docType,
  version: tpl.version,
  headerFields: tpl.headerFields,
  printWeights: tpl.printWeights,
  printDimensions: tpl.printDimensions,
  mandatoryForSubmit: tpl.mandatoryForSubmit,
  mandatoryForDocGen: tpl.mandatoryForDocGen,
  igst: tpl.igst ?? null,
});
const STD_PL_FULL = SYSTEM_TEMPLATES.PACKING_LIST;
const STD_PL = pick(STD_PL_FULL);
const STD_INV_FULL = SYSTEM_TEMPLATES.INVOICE;
const STD_INV = pick(STD_INV_FULL);

/** JOMO's own layout, as the API stores a buyer template: more mandatory header fields, and DAN numbers on every row. */
const JOMO_TPL = {
  id: 44,
  templateCode: 'JOMO-PL',
  name: 'JOMO SCA packing list',
  docType: 'PACKING_LIST',
  version: 2,
  headerFields: [
    ...STANDARD_PL_HEADER_FIELDS,
    { key: 'vessel', label: 'Vessel / Voyage', binding: 'shipment.vesselFlightNo', mandatory: true },
    { key: 'pod', label: 'Port of Discharge', binding: 'shipment.portOfDischarge', mandatory: true },
    { key: 'origin', label: 'Country of Origin', binding: 'fixed:INDIA', mandatory: true },
    { key: 'iec', label: 'IEC No.', binding: 'exporter.iecNo', mandatory: true },
    { key: 'buyerRef', label: 'Buyer', binding: 'buyer.name', mandatory: true },
    { key: 'remarks', label: 'Remarks', binding: 'pl.remarks', mandatory: false },
  ],
  printWeights: true,
  printDimensions: true,
  mandatoryForSubmit: ['row.cartonFrom', 'row.cartonTo', 'row.danNo', 'pl.marksAndNos', 'shipment.etd', 'style.hsCode', 'calc.cbm'],
  mandatoryForDocGen: ['row.netWeightKg', 'row.grossWeightKg', 'row.lengthCm', 'row.breadthCm', 'row.heightCm', 'row.danNo'],
  igst: null,
};

const ob = (styleNo, colorName, qty, rate, po = 'PO-884213', destination = 'Rotterdam') => Object.entries(qty)
  .map(([size, orderQty]) => ({
    styleNo, colorName, size, orderQty, orderRate: rate, buyerPoNo: po, destination, sourceOrderNo: 'SG/26-27/1042',
  }));
// Navy L is +0.95% (inside JOMO's 2%), Navy XL -6% (outside); everything else matches exactly.
const BREAKDOWN = [
  ...ob('ST-2026-0441', 'Navy', { M: 488, L: 950, XL: 1500 }, 8.75),
  ...ob('ST-2026-0441', 'Flame Scarlet 18-1662 TCX', { M: 49, L: 86, XL: 80, XXL: 40 }, 8.75),
];

// ─── Blocks (expDocPlAssemble.blocksOf) ───────────────────────────────────────────
/** A plan row as expDocPlPlan.applyPlan keeps it. */
const plan = (id, from, to, contents = NAVY, extra = {}) => ({
  id, sectionKey: 'MAIN', ...contents, cartonFrom: from, cartonTo: to, buyerPoNo: 'PO-884213', destination: 'Rotterdam',
  danNo: null, poKey: K_RTM, notShipping: null, ...extra,
});
const NOT_SHIPPING = { notShipping: { reason: 'Buyer cut the PO by 10 cartons' } };

const poOf = (key, buyerPoNo, rows, { onShipment = true, planRows = null, destination = 'Rotterdam' } = {}) => {
  const match = planRows ? matchPlan(planRows, rows) : null;
  return {
    plan: match,
    planChip: match ? planChip(match) : null,
    key,
    buyerPoNo,
    destination,
    label: buyerPoNo ? `${buyerPoNo} / ${destination}` : 'Without PO',
    onShipment,
    rows,
    totals: sectionTotals(rows),
    units: [],
    offers: [],
    removed: [],
  };
};
const blockOf = (orderId, orderNo, pos, { onShipment = true } = {}) => ({
  orderId,
  orderNo,
  styleNo: 'ST-2026-0441',
  garmentName: "Men's Slim Fit Polo",
  onShipment,
  unreadable: false,
  pos,
  unplaced: [],
  totals: sectionTotals(pos.flatMap((p) => p.rows)),
  planRows: [],
  empty: false,
});
const covered = (...pairs) => pairs.map(([orderId, key]) => `${orderId}|${key ?? ''}`);

/**
 * A list as the store keeps it, the shape decoratePl passes in plsInShipment: the stored record, not a decorated one.
 */
const stored = (pl) => ({
  id: pl.id,
  plNo: pl.plNo,
  status: pl.status,
  shipmentId: pl.shipmentId,
  contentHash: pl.contentHash,
  sections: pl.sections.map(({
    key, title, order, rows,
  }) => ({
    key, title, order, rows,
  })),
});

// ─── Contexts ─────────────────────────────────────────────────────────────────────
/** decoratePl's context for a list of JOMO's shipment; `extra` replaces keys, `pl` its own fields. */
const plCtx = (rows, { pl: plExtra = {}, ...extra } = {}) => {
  const pl = plOf(7, 'PKL/26-27/1007', rows, plExtra);
  return {
    pl,
    shipment: SHIPMENT,
    template: STD_PL,
    totals: pl.totals,
    tolerancePercent: pl.tolerancePercent,
    orderBreakdown: BREAKDOWN,
    plsInShipment: [stored(pl)],
    packedElsewhere: {},
    matchColour: 'colourKey',
    blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', rows)])],
    coveredPos: covered([1042, K_RTM]),
    ...extra,
  };
};

/** changeStatus's finalise re-check: decoratePl's context without the shipment, blocks and coveredPos. */
const approveCtx = (ctx) => {
  const {
    shipment, blocks, coveredPos, ...rest
  } = ctx;
  return rest;
};

/** checkStickerGeneration's context: the list and its own template, nothing packed elsewhere. */
const stickerCtx = (ctx) => ({
  pl: ctx.pl,
  template: ctx.template,
  totals: ctx.pl.totals,
  tolerancePercent: ctx.pl.tolerancePercent,
  orderBreakdown: ctx.orderBreakdown,
  plsInShipment: ctx.plsInShipment,
  packedElsewhere: {},
});

/**
 * The context without the given keys. A key is left out rather than set to undefined, because the fixture writes
 * undefined as null, and a null matcher is not the browser's default one (orderVsPacked would call it).
 */
const omit = (ctx, ...keys) => Object.fromEntries(Object.entries(ctx).filter(([k]) => !keys.includes(k)));

/**
 * decoratePl's context for a case about one rule, without the keys that rule does not read (the shipment's other
 * lists, the order breakdown, the blocks), so its findings are not buried under the quantity rules' and the fixture
 * stays lean. `keep` names the ones it does read. The whole context is in the jomo, V-01, quantity and gate cases.
 */
const SIDE_KEYS = ['plsInShipment', 'orderBreakdown', 'blocks', 'coveredPos'];
const ruleCtx = (rows, opts = {}, keep = []) => omit(plCtx(rows, opts), ...SIDE_KEYS.filter((k) => !keep.includes(k)));

/** Carton Packing's check of one entry's groups (CartonPackingForm): rows only, no numbering groups. */
const entryCtx = (groups) => ({ pl: { sections: [{ key: 'MAIN', rows: groups }] } });

const otherPl = (id, plNo, rows, status = 'DRAFT') => stored(plOf(id, plNo, rows, { status }));

const BASE = plCtx(JOMO);
/** The quantity rules read the order breakdown, not the blocks or the shipment's other lists. */
const qtyCtx = (rows, opts = {}) => ruleCtx(rows, opts, ['orderBreakdown']);
const QTY = qtyCtx(JOMO);
const AT = '2026-10-14 16:20';
const must = (finding, what) => {
  if (!finding) throw new Error(`The scenario raised no ${what}`);
  return finding;
};
const findingOf = (ctx, phase, code, n = 0) => must(validate(ctx, { phase }).findings.filter((f) => f.code === code)[n], `${code} at ${phase}`);
const ackOf = (finding, reason = 'Agreed with the buyer by email on 12-Oct-2026') => buildAcknowledgement(finding, reason, 'Priya S.', AT);

const cases = [];
/** One validate case per phase: `validate/<name>@<phase>`. */
const add = (name, ctx, phases, options = {}) => {
  phases.forEach((phase) => cases.push({ id: `validate/${name}@${phase}`, fn: validate, args: [ctx, { phase, ...options }] }));
};
const { SAVE, SUBMIT, APPROVE, EDIT, STICKER, DOC_GEN } = PHASE;
const { INVOICE_CREATE, INVOICE_OPEN, INVOICE_SAVE, INVOICE_APPROVE } = PHASE;

// ─── The JOMO list as it stands ───────────────────────────────────────────────────
add('jomo/as-decorated', BASE, [EDIT, SAVE, SUBMIT]);
add('jomo/finalise-recheck', approveCtx(BASE), [APPROVE]);
add('jomo/sticker-preflight', stickerCtx(BASE), [STICKER, DOC_GEN]);
add('jomo/full-standard-template', { ...BASE, template: STD_PL_FULL }, [SAVE, SUBMIT]);

// ─── V-01 duplicate carton number in the shipment ─────────────────────────────────
{
  const mine = stored(plOf(7, 'PKL/26-27/1007', JOMO));
  const second = otherPl(8, 'PKL/26-27/1008', [row('104:41-80', 41, 80, NAVY, HAM)]);
  add('v01/continuing-lists-clash', { ...BASE, plsInShipment: [mine, second] }, [EDIT, SAVE]);
  add('v01/continuing-lists-clash-at-approve', approveCtx({ ...BASE, plsInShipment: [mine, second] }), [APPROVE]);
  add('v01/cancelled-and-superseded-are-ignored', {
    ...BASE,
    plsInShipment: [mine, { ...second, status: 'CANCELLED' }, { ...second, id: 9, plNo: 'PKL/26-27/1007-R1', status: 'SUPERSEDED' }],
  }, [SAVE]);
  add('v01/final-and-released-lists-count', {
    ...BASE,
    plsInShipment: [{ ...second, status: 'FINAL' }, mine, { ...second, id: 9, plNo: 'PKL/26-27/1009', status: 'EXPORTED' }],
  }, [SAVE]);
  const twoRanges = otherPl(10, 'PKL/26-27/1010', [row('105:1-5', 1, 5, NAVY, HAM), row('105:55-70', 55, 70, NAVY, HAM)]);
  add('v01/one-finding-per-list-ranges-merged', { ...BASE, plsInShipment: [second, mine, twoRanges] }, [SAVE]);
  add('v01/other-without-a-number', { ...BASE, plsInShipment: [mine, { ...second, plNo: null }] }, [SAVE]);
  add('v01/an-empty-list-says-nothing', plCtx([], { plsInShipment: [stored(plOf(7, 'PKL/26-27/1007', [])), second] }), [SAVE]);

  // Restart per PO: two POs may both print carton 1; the same PO, a continuing list or a style may not
  const poRow = (id, group, from, to, po = HAM) => row(id, from, to, NAVY, { ...po, numberGroup: group });
  const perPo = [poRow('a', 'po:PO-884213', 1, 20, {}), poRow('b', 'po:PO-884250', 1, 10)];
  const perPoCtx = plCtx(perPo, { pl: { numbering: 'PER_PO' } });
  add('v01/restart-groups', {
    ...perPoCtx,
    plsInShipment: [
      stored(perPoCtx.pl),
      otherPl(11, 'PKL/26-27/1011', [poRow('c', 'po:PO-884299', 1, 30)]),
      otherPl(12, 'PKL/26-27/1012', [poRow('d', 'po:PO-884250', 8, 12)]),
      otherPl(13, 'PKL/26-27/1013', [poRow('e', 'list', 15, 25)]),
      otherPl(14, 'PKL/26-27/1014', [poRow('f', 'order:1055', 1, 3)]),
    ],
  }, [SAVE]);
  const ungrouped = [row('g1', 1, 10, NAVY, { numberGroup: null }), row('g2', 11, 20, NAVY, { numberGroup: null })];
  const ungroupedCtx = plCtx(ungrouped);
  add('v01/rows-without-a-group-are-one-list', {
    ...ungroupedCtx, plsInShipment: [stored(ungroupedCtx.pl), otherPl(15, 'PKL/26-27/1015', [poRow('h', 'po:PO-884250', 1, 5)])],
  }, [SAVE]);
}

// ─── V-02 carton range overlap ────────────────────────────────────────────────────
add('v02/two-rows-overlap', ruleCtx([J1, row('101:40-57', 40, 57, SCARLET_RATIO), J3, J4]), [EDIT, SUBMIT]);
add('v02/three-rows-chain', ruleCtx([row('a', 1, 10), row('b', 5, 12), row('c', 11, 15)]), [SAVE]);
add('v02/same-range-twice', ruleCtx([row('a', 1, 10), row('b', 1, 10)]), [SAVE]);
add('v02/one-carton', ruleCtx([row('a', 1, 10), row('b', 10, 20)]), [SAVE]);
// Each range is compared with the one before it only: 10-20 hides 30-40's overlap with 1-100 (kept as the browser has it)
add('v02/a-long-range-hides-a-pair', ruleCtx([row('a', 1, 100), row('b', 10, 20), row('c', 30, 40)]), [SAVE]);
add('v02/restart-groups', ruleCtx([
  row('a', 1, 10, NAVY, { numberGroup: 'po:PO-884213' }),
  row('b', 1, 10, NAVY, { ...HAM, numberGroup: 'po:PO-884250' }),
  row('c', 5, 6, NAVY, { ...HAM, numberGroup: 'po:PO-884250' }),
]), [SAVE]);

// ─── Carton Packing's own check of one entry ──────────────────────────────────────
{
  const group = (id, from, to, contents = NAVY) => ({
    id, packingType: 'SOLID', cartonFrom: from, cartonTo: to, packingCode: null, danNo: null, buyerPoNo: 'PO-884213',
    destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: null, articleNos: null, eanBySize: null, sizeQty: null,
    mixedRows: null, ratio: null, assortmentsPerCarton: null, pcsPerMpb: null, mpbPerCarton: null, netWeightKg: null,
    grossWeightKg: null, lengthCm: null, breadthCm: null, heightCm: null, remarks: null, completionFlag: true, ...contents,
  });
  add('carton-packing/clean', entryCtx([group('g1', 1, 47), group('g2', 48, 57, SCARLET_RATIO)]), [SAVE]);
  add('carton-packing/overlap-and-missing-range', entryCtx([
    group('g1', 1, 10), group('g2', 5, 12), group('g3', null, 15), group('g4', 20, 25, { sizeQty: {} }),
  ]), [EDIT, SAVE]);
}

// ─── V-03 gaps ────────────────────────────────────────────────────────────────────
{
  const gappedRows = [J1, row('101:52-61', 52, 61, SCARLET_RATIO)];
  const gapped = ruleCtx(gappedRows);
  add('v03/one-gap', gapped, [SAVE, SUBMIT, APPROVE]);
  add('v03/several-gaps', ruleCtx([row('a', 1, 5), row('b', 8, 8), row('c', 12, 20)]), [SUBMIT]);
  add('v03/gaps-of-two-groups-merged', ruleCtx([
    row('a', 1, 5, NAVY, { numberGroup: 'po:PO-884213' }), row('b', 8, 10, NAVY, { numberGroup: 'po:PO-884213' }),
    row('c', 1, 5, NAVY, { ...HAM, numberGroup: 'po:PO-884250' }), row('d', 7, 10, NAVY, { ...HAM, numberGroup: 'po:PO-884250' }),
  ]), [SUBMIT]);
  const ack = ackOf(findingOf(gapped, SUBMIT, 'V-03'), 'Cartons 48 to 51 were dropped after the QC re-check');
  add('v03/acknowledged', gapped, [SUBMIT, APPROVE], { acknowledgements: [ack] });
  const before = ruleCtx([J1, row('101:51-61', 51, 61, SCARLET_RATIO)]);
  const staleAck = ackOf(findingOf(before, SUBMIT, 'V-03'), 'Cartons 48 to 50 were dropped');
  add('v03/acknowledgement-no-longer-applies', gapped, [SUBMIT], { acknowledgements: [staleAck] });
  add('v03/sticker', stickerCtx(plCtx(gappedRows)), [STICKER]);
  add('v03/sticker-acknowledged', stickerCtx(plCtx(gappedRows)), [STICKER], { acknowledgements: [ack] });
}

// ─── V-20, V-21, V-17, V-18, V-19: blocks and the buyer's plan ────────────────────
{
  const blockCtx = (rows, opts) => ruleCtx(rows, opts, ['blocks', 'coveredPos']);
  // A: one PO packed partly as planned, partly differently, and outside the plan
  const planA = [plan('plan-1', 1, 40), plan('plan-2', 41, 55), plan('plan-3', 56, 60, MIXED)];
  const packedA = [row('a', 1, 40), row('b', 41, 47), row('c', 56, 60, MIXED_BLACK), row('d', 81, 85)];
  const ctxA = blockCtx(packedA, {
    blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', packedA, { planRows: planA })])],
  });
  add('plan/partly-differently-and-outside', ctxA, [SAVE, SUBMIT]);
  add('plan/finalise-recheck-has-no-blocks', approveCtx(ctxA), [APPROVE]);
  add('plan/without-a-po-number', blockCtx(packedA, {
    blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(null, '', packedA, { planRows: planA })])],
    coveredPos: covered([1042, null]),
  }), [SUBMIT]);

  // B: two packed rows in one plan row, differing in different ways
  const planB = [plan('plan-1', 1, 20)];
  const packedB = [row('a', 1, 10, BLACK), row('b', 11, 20, { ...NAVY, sizeQty: { M: 10, L: 20, XL: 25 } })];
  const ctxB = blockCtx(packedB, { blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', packedB, { planRows: planB })])] });
  add('plan/two-differences-in-one-plan-row', ctxB, [SAVE]);
  const ackB = ackOf(findingOf(ctxB, SAVE, 'V-18'), 'Buyer accepted Black for the first ten cartons');
  add('plan/difference-acknowledged', ctxB, [SAVE, SUBMIT], { acknowledgements: [ackB] });
  const packedB1 = [row('a', 1, 10, BLACK), row('b', 11, 20)];
  const ctxB1 = blockCtx(packedB1, { blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', packedB1, { planRows: planB })])] });
  add('plan/difference-acknowledgement-no-longer-applies', ctxB, [SUBMIT], {
    acknowledgements: [ackOf(findingOf(ctxB1, SAVE, 'V-18'))],
  });

  // C: a range marked Not shipping needs no packing; one not marked does
  const planC = [plan('plan-1', 1, 10, NAVY, NOT_SHIPPING), plan('plan-2', 11, 20), plan('plan-3', 21, 30)];
  const packedC = [row('a', 21, 30)];
  add('plan/not-shipping-and-not-packed', blockCtx(packedC, {
    blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', packedC, { planRows: planC })])],
  }), [SUBMIT]);

  // D: V-20, cartons or a plan for what the shipment no longer carries
  const ham = [row('h1', 1, 10, NAVY, HAM), row('h2', 11, 12, NAVY, HAM)];
  add('v20/po-off-the-shipment-with-cartons', blockCtx([...JOMO, ...ham], {
    blocks: [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', JOMO), poOf(K_HAM, 'PO-884250', ham, { onShipment: false, destination: 'Hamburg' })])],
  }), [SAVE, SUBMIT]);
  add('v20/po-off-the-shipment-with-a-plan', blockCtx(JOMO, {
    blocks: [blockOf(1042, 'SG/26-27/1042', [
      poOf(K_RTM, 'PO-884213', JOMO),
      poOf(K_HAM, 'PO-884250', [], { onShipment: false, destination: 'Hamburg', planRows: [plan('plan-9', 1, 10, NAVY, { poKey: K_HAM })] }),
    ])],
  }), [SAVE, SUBMIT]);
  const vgt = [row('v1', 1, 30, NAVY, { orderId: 1055, orderNo: 'SG/26-27/1055', poKey: null, buyerPoNo: null })];
  add('v20/order-off-the-shipment-with-cartons', blockCtx([...JOMO, ...vgt], {
    blocks: [
      blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', JOMO)]),
      blockOf(1055, 'SG/26-27/1055', [poOf(null, null, vgt, { onShipment: false })], { onShipment: false }),
    ],
  }), [SAVE]);
  add('v20/order-off-the-shipment-with-a-plan', blockCtx(JOMO, {
    blocks: [
      blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', JOMO)]),
      blockOf(1055, null, [poOf(null, null, [], { onShipment: false, planRows: [plan('plan-1', 1, 5, NAVY, { poKey: null })] })], { onShipment: false }),
    ],
  }), [SAVE]);

  // E: V-21, a shipment PO with no cartons anywhere
  const twoPos = [blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', JOMO), poOf(K_HAM, 'PO-884250', [], { destination: 'Hamburg' })])];
  const v21 = blockCtx(JOMO, { blocks: twoPos });
  add('v21/po-without-cartons', v21, [SAVE, SUBMIT, APPROVE]);
  add('v21/covered-by-another-list', { ...v21, coveredPos: covered([1042, K_RTM], [1042, K_HAM]) }, [SUBMIT]);
  add('v21/no-covered-set', { ...v21, coveredPos: null }, [SUBMIT]);
  add('v21/acknowledged', v21, [SUBMIT], {
    acknowledgements: [ackOf(findingOf(v21, SUBMIT, 'V-21'), 'PO-884250 ships on the next vessel')],
  });
  add('v21/order-without-pos-and-an-order-off-the-shipment', blockCtx(JOMO, {
    blocks: [
      blockOf(1042, 'SG/26-27/1042', [poOf(K_RTM, 'PO-884213', JOMO)]),
      blockOf(1061, 'SG/26-27/1061', [poOf(null, null, [])]),
      blockOf(1070, 'SG/26-27/1070', [poOf(null, null, [], { onShipment: false })], { onShipment: false }),
    ],
  }), [SUBMIT]);
}

// ─── V-06 structurally impossible carton data ─────────────────────────────────────
add('v06/incomplete-ranges', ruleCtx([row('a', null, 5), row('b', 0, 5), row('c', 6, null)]), [EDIT, SAVE]);
add('v06/backwards-range', ruleCtx([row('a', 10, 5)]), [SAVE]);
add('v06/no-pieces', ruleCtx([row('a', 1, 5, { ...NAVY, sizeQty: {} }), row('b', 6, 7, { ...MIXED, mixedRows: null })]), [SAVE]);
add('v06/pack-counts-missing', ruleCtx([
  row('a', 1, 5, { ...SCARLET_RATIO, assortmentsPerCarton: null }),
  row('b', 6, 9, {
    packingType: 'MPB', colorName: 'White', ratio: { '50/56': 2, '62/68': 2 }, pcsPerMpb: 4, mpbPerCarton: 0,
  }),
]), [SAVE]);
add('v06/negative-and-fractional-sizes', ruleCtx([
  row('a', 1, 5, { ...NAVY, sizeQty: { S: 0, M: -2, L: 2.5, XL: 10 } }),
  row('b', 6, 8, { ...SCARLET_RATIO, ratio: { M: 0.5, L: 1.25 }, assortmentsPerCarton: 3 }),
]), [EDIT, SUBMIT]);

// ─── V-07 gross below net ─────────────────────────────────────────────────────────
{
  const light = ruleCtx([{ ...J1, grossWeightKg: 11.9 }, J2, J3, J4]);
  add('v07/row-and-list-totals', light, [SAVE, SUBMIT]);
  add('v07/row-only', ruleCtx([J1, J2, J3, { ...J4, grossWeightKg: 2 }]), [SAVE]);
  add('v07/missing-weights-are-not-compared', ruleCtx([{ ...J1, grossWeightKg: null }, { ...J2, netWeightKg: 0, grossWeightKg: 1 }]), [SAVE]);
  add('v07/stale-totals-only', { ...ruleCtx(JOMO), totals: { ...BASE.totals, grossWeightKg: 640.5 } }, [SAVE]);
  add('v07/row-without-a-range', ruleCtx([row('a', null, 5, { ...NAVY, grossWeightKg: 10 })]), [SAVE]);
  const ack = ackOf(findingOf(light, SAVE, 'V-07'), 'Weighed again: the scale was tared wrong');
  add('v07/acknowledged', light, [SUBMIT], { acknowledgements: [ack] });
  add('v07/acknowledgement-no-longer-applies', ruleCtx([{ ...J1, grossWeightKg: 11.8 }, J2, J3, J4]), [SUBMIT], { acknowledgements: [ack] });
}

// ─── V-08 missing weight or dimension ─────────────────────────────────────────────
{
  const gapRows = [{ ...J1, netWeightKg: null }, { ...J2, heightCm: 0 }, { ...J3, netWeightKg: 0, grossWeightKg: null, lengthCm: null }, J4];
  const gaps = ruleCtx(gapRows);
  add('v08/standard-template', gaps, [SAVE, SUBMIT, DOC_GEN]);
  add('v08/finalise-recheck', approveCtx(gaps), [APPROVE]);
  add('v08/sticker', stickerCtx(plCtx(gapRows)), [STICKER]);
  add('v08/print-flags-when-nothing-is-declared', {
    ...gaps, template: { ...STD_PL, mandatoryForDocGen: [], printWeights: true, printDimensions: false },
  }, [SUBMIT]);
  add('v08/nothing-printed', {
    ...gaps, template: { ...STD_PL, mandatoryForDocGen: null, printWeights: false, printDimensions: false },
  }, [SUBMIT, STICKER]);
  add('v08/no-template', omit(gaps, 'template'), [SUBMIT]);
  add('v08/jomo-template', { ...gaps, template: JOMO_TPL }, [SUBMIT]);
  add('v08/declared-fields-of-every-kind', ruleCtx([
    { ...J1, packingCode: null, danNo: '' },
    { ...J2, packingCode: 'PK-2', completionFlag: false },
    { ...J3, packingCode: 'PK-3' },
  ], {
    template: {
      ...STD_PL,
      name: 'Prenatal carton list',
      mandatoryForDocGen: [
        'row.danNo', 'row.packingCode', 'row.completionFlag', 'row.eanBySize.M', 'row.NetWeight', 'row.sizeQty',
        'row.mixedRows', 'pl.marksAndNos', 'row.heightCm',
      ],
    },
  }), [SUBMIT]);
  const ack = ackOf(findingOf(gaps, SUBMIT, 'V-08'), 'Carton weights are printed on the label by hand');
  add('v08/acknowledged', gaps, [SUBMIT], { acknowledgements: [ack] });
  // At STICKER the same finding is an error: the acknowledgement still matches, and still does not let it through
  add('v08/acknowledged-but-an-error-at-sticker', stickerCtx(plCtx(gapRows)), [STICKER], { acknowledgements: [ack] });
}

// ─── V-04, V-05, V-09: packed against ordered ─────────────────────────────────────
{
  add('qty/negative-variance-within', { ...QTY, orderBreakdown: [...BREAKDOWN.slice(0, 2), { ...BREAKDOWN[2], orderQty: 1420 }, ...BREAKDOWN.slice(3)] }, [SAVE]);
  add('qty/excess-outside', { ...QTY, orderBreakdown: [...BREAKDOWN.slice(0, 6), { ...BREAKDOWN[6], orderQty: 30 }] }, [SUBMIT]);
  add('qty/zero-tolerance', { ...QTY, tolerancePercent: 0 }, [SUBMIT]);
  add('qty/fractional-tolerance', { ...QTY, tolerancePercent: 2.5, orderBreakdown: [...BREAKDOWN.slice(0, 2), { ...BREAKDOWN[2], orderQty: 1446 }, ...BREAKDOWN.slice(3)] }, [SUBMIT]);
  add('qty/no-tolerance-given', { ...QTY, tolerancePercent: null }, [SUBMIT]);
  const ack = ackOf(findingOf(BASE, SUBMIT, 'V-05'), 'Buyer agreed a short shipment of XL');
  add('qty/short-acknowledged', QTY, [SUBMIT, APPROVE], { acknowledgements: [ack] });
  const lessPacked = qtyCtx([{ ...J1, sizeQty: { M: 10, L: 20, XL: 29 } }, J2, J3, J4]);
  add('qty/short-acknowledgement-no-longer-applies', lessPacked, [SUBMIT], { acknowledgements: [ack] });
  const black = row('101:62-63', 62, 63, BLACK, { sourceGroupId: 5 });
  const navyXxl = row('101:64-64', 64, 64, { ...NAVY, sizeQty: { XXL: 6 } }, { sourceGroupId: 6 });
  const unordered = qtyCtx([...JOMO, black, navyXxl]);
  add('qty/colour-and-size-not-on-the-order', unordered, [SAVE, SUBMIT]);
  add('qty/not-on-the-order-acknowledged', unordered, [SUBMIT], {
    acknowledgements: [ackOf(findingOf(unordered, SAVE, 'V-09', 1), 'Black is the buyer approved substitute')],
  });
  add('qty/no-order-breakdown', { ...unordered, orderBreakdown: [] }, [SUBMIT]);
  add('qty/no-order-breakdown-given', omit(unordered, 'orderBreakdown'), [SUBMIT]);
  // The order spells the colour without TCX: the Pantone-aware key matches it, the default one does not
  const shortName = BREAKDOWN.map((l) => (l.colorName.startsWith('Flame') ? { ...l, colorName: 'FLAME SCARLET 18-1662' } : l));
  add('qty/pantone-key-matches', { ...QTY, orderBreakdown: shortName }, [SUBMIT]);
  add('qty/default-key-does-not', { ...omit(QTY, 'matchColour'), orderBreakdown: shortName }, [SUBMIT]);
}

// ─── V-15 over-packing across the shipment ────────────────────────────────────────
{
  const otherRows = [row('104:62-65', 62, 65, NAVY, { sourceEntryId: 104 }), row('104:66-70', 66, 70, SCARLET_RATIO, { sourceEntryId: 104 })];
  const elsewhere = packedQuantities(otherRows, { matchColour: colourKey });
  add('v15/over-packed-across-lists', { ...QTY, packedElsewhere: elsewhere }, [SAVE, SUBMIT]);
  add('v15/acknowledged', { ...QTY, packedElsewhere: elsewhere }, [SUBMIT], {
    acknowledgements: [ackOf(findingOf({ ...QTY, packedElsewhere: elsewhere }, SAVE, 'V-15'), 'The other list is being cancelled')],
  });
  add('v15/keyed-by-the-pantone-matcher', { ...QTY, packedElsewhere: { 'st-2026-0441||18-1662||xxl': 10 } }, [SAVE]);
  // Keyed the default way while the list matches Pantone-aware: every lookup misses, as the browser warns
  add('v15/keyed-the-wrong-way-misses', { ...QTY, packedElsewhere: { 'st-2026-0441||flame scarlet 18-1662 tcx||xxl': 10 } }, [SAVE]);
  add('v15/default-matcher-default-keys', {
    ...omit(QTY, 'matchColour'), packedElsewhere: { 'st-2026-0441||flame scarlet 18-1662 tcx||xxl': 10, 'st-2026-0441||navy||m': 0.5 },
  }, [SAVE]);
  add('v15/nothing-elsewhere', { ...QTY, packedElsewhere: {} }, [SAVE]);
  add('v15/no-packed-elsewhere-given', omit(QTY, 'packedElsewhere'), [SAVE]);
  add('v15/not-on-the-order-is-v09s', {
    ...QTY, packedElsewhere: { 'st-2026-0441||black||m': 5 }, pl: plOf(7, 'PKL/26-27/1007', [...JOMO, row('x', 62, 62, BLACK)]),
  }, [SAVE]);
}

// ─── V-12 mandatory template fields on a packing list ─────────────────────────────
{
  add('v12/date-empty', ruleCtx(JOMO, { pl: { plDate: null } }), [SAVE, SUBMIT]);
  const jomo = ruleCtx([J1, { ...J2, danNo: null }, { ...J3, danNo: '' }, J4], {
    pl: { marksAndNos: '' }, shipment: { ...SHIPMENT, vesselFlightNo: null }, template: JOMO_TPL,
  });
  add('v12/jomo-template', jomo, [SUBMIT]);
  add('v12/jomo-template-without-a-shipment', { ...jomo, shipment: null }, [SUBMIT]);
  add('v12/jomo-template-finalise-recheck', approveCtx(jomo), [APPROVE]);
  add('v12/exporter-and-buyer-in-scope', {
    ...jomo, exporter: { name: 'Avarsh Garments Pvt Ltd', iecNo: null, country: 'INDIA' }, buyer: { name: '', code: 'JOMO' },
  }, [SUBMIT]);
  add('v12/a-duplicate-path-loses-its-label', ruleCtx(JOMO, {
    pl: { plDate: '' }, template: { ...STD_PL, mandatoryForSubmit: ['pl.plDate', 'pl.plNo'] },
  }), [SUBMIT]);
  add('v12/labels-made-from-paths', ruleCtx(JOMO, {
    template: {
      ...STD_PL,
      name: 'VGT export packing list',
      mandatoryForSubmit: [
        'shipment.port_of_loading', 'shipment.notify-party', 'pl.resolved.sealNo', 'shipment.portOfDischargeID',
        'shipment.ETD', 'pl.x.', 'shipment.consignee.taxId',
      ],
    },
  }), [SUBMIT]);
  add('v12/values-that-are-not-blank', ruleCtx(JOMO, {
    template: {
      ...STD_PL,
      mandatoryForSubmit: [
        'pl.firstCartonNo', 'pl.revision', 'pl.overridden.containerNo', 'shipment.containerNos', 'pl.orderNos.0',
        'pl.sections.0.rows.length', 'pl.plNo.length', 'shipment', 'pl', 'shipment.consignee.block', 'shipment.containerNos.3',
      ],
    },
  }), [SUBMIT]);
  add('v12/row-paths-read-the-last-segment', ruleCtx([J1, { ...J2, cartonFrom: null }], {
    template: { ...STD_PL, mandatoryForSubmit: ['row.cartonFrom', 'row.eanBySize.M', 'row.remarks', 'row.completionFlag'] },
  }), [SUBMIT]);
  add('v12/template-without-a-name', ruleCtx(JOMO, { template: { mandatoryForSubmit: ['pl.remarks'] } }), [SUBMIT]);
  add('v12/header-fields-that-do-not-count', ruleCtx(JOMO, {
    pl: { remarks: null, sealNo: '' },
    template: {
      ...STD_PL,
      mandatoryForSubmit: [],
      headerFields: [
        { key: 'a', label: 'Remarks', binding: 'pl.remarks', mandatory: false },
        { key: 'b', label: 'Blank binding', binding: '', mandatory: true },
        { key: 'c', label: 'Fixed text', binding: 'fixed:', mandatory: true },
        { key: 'd', label: null, binding: 'pl.sealNo', mandatory: 'yes' },
        { key: 'e', label: '', binding: 'pl.resolved.sealNo', mandatory: 1 },
        { key: 'f', label: 'Seal again', binding: 'pl.sealNo', mandatory: true },
      ],
    },
  }), [SUBMIT]);
  add('v12/invoice-paths-skipped-on-a-list', ruleCtx(JOMO, {
    template: { ...STD_PL, mandatoryForSubmit: ['invoice.incoterm', 'invoice.paymentTerms'] },
  }), [SUBMIT]);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────────
const JOMO_PL = plOf(7, 'PKL/26-27/1007', JOMO, { status: 'FINAL' });
const livePl = (pl) => ({
  id: pl.id, plNo: pl.plNo, status: pl.status, totals: pl.totals, cartonRangeLabel: `1${EN_DASH}61`, contentHash: pl.contentHash, version: pl.version,
});
const line = (seq, over = {}) => ({
  id: seq,
  seq,
  key: 'ST-2026-0441||navy',
  description: `Men's Slim Fit Polo ${EM_DASH} ST-2026-0441 ${EM_DASH} Navy`,
  materialNo: null,
  styleNo: 'ST-2026-0441',
  colorName: 'Navy',
  size: null,
  sizeRange: 'M-XL',
  buyerPoNo: 'PO-884213',
  orderLineId: 1,
  orderNo: 'SG/26-27/1042',
  articleNo: null,
  hsCode: '61051000',
  composition: '95% COTTON 5% ELASTANE',
  packagingAttributes: null,
  quantity: 2857,
  rate: 8.75,
  unit: 'PCS',
  nonMerchandise: false,
  sourceAtoms: [],
  amount: 24998.75,
  orderRate: 8.75,
  rateIsBlended: false,
  unpricedQty: 0,
  ...over,
});
const LINES = [
  line(1),
  line(2, {
    key: 'ST-2026-0441||18-1662', description: `Men's Slim Fit Polo ${EM_DASH} ST-2026-0441 ${EM_DASH} Flame Scarlet 18-1662 TCX`,
    colorName: 'Flame Scarlet 18-1662 TCX', sizeRange: 'M-XXL', quantity: 255, amount: 2231.25,
  }),
];
const invoiceOf = (over = {}) => ({
  id: 501,
  invoiceNo: null,
  provisionalNo: 'DRAFT-501',
  status: 'DRAFT',
  revision: 0,
  shipmentId: 31,
  buyerId: 12,
  buyerName: 'JOMO BV',
  invoiceDate: '2026-10-14',
  currency: 'EUR',
  fxRate: 89.35,
  fxSource: 'CUSTOMS',
  incoterm: 'FOB',
  incotermPlace: 'Chennai',
  paymentTerms: 'TT 60 days from B/L',
  consignee: CONSIGNEE,
  notify: null,
  countryOfFinalDestination: 'Netherlands',
  igstRatePct: 5,
  charges: { discount: { enabled: true, mode: 'PERCENT', value: 0 }, freight: { enabled: true, value: 0 } },
  totalsOverride: null,
  lines: LINES,
  annexes: [],
  packingListRefs: [{ plId: 7, plNo: 'PKL/26-27/1007', plContentHash: JOMO_PL.contentHash, plVersion: 3 }],
  acknowledgements: [],
  ...over,
});
/** decorateInvoice's context for an invoice over JOMO's list. */
const invCtx = (over = {}, extra = {}) => ({
  invoice: invoiceOf(over),
  plTotals: aggregatePlTotals([JOMO_PL.totals]),
  shipment: SHIPMENT,
  template: STD_INV,
  rateDeviationPercent: 5,
  allowMultiInvoicePerPl: false,
  livePls: [livePl(JOMO_PL)],
  invoicesForPls: [],
  ...extra,
});
const INV = invCtx();
const ALL_INVOICE_PHASES = [INVOICE_CREATE, INVOICE_OPEN, INVOICE_SAVE, INVOICE_APPROVE];

add('invoice/as-decorated', INV, ALL_INVOICE_PHASES);
add('invoice/full-standard-template', { ...INV, template: STD_INV_FULL }, [INVOICE_SAVE]);
add('invoice/packing-list-phases-check-nothing-of-it', INV, [SAVE, SUBMIT]);

// ─── V-10 invoice against the packing lists ───────────────────────────────────────
{
  const short = invCtx({ lines: [line(1, { quantity: 2800 }), LINES[1]] });
  add('v10/line-quantities', short, [INVOICE_SAVE, INVOICE_APPROVE]);
  add('v10/indian-digit-grouping', invCtx({ lines: [line(1, { quantity: 123456 })] }, { plTotals: { ...INV.plTotals, pieces: 1250000.5 } }), [INVOICE_SAVE]);
  add('v10/a-sample-charge-is-not-goods', invCtx({
    lines: [...LINES, line(3, { description: 'Sample charge', nonMerchandise: true, quantity: 10, hsCode: null, rate: null, orderRate: null })],
  }), [INVOICE_SAVE]);
  add('v10/only-non-merchandise', invCtx({ lines: [line(1, { nonMerchandise: true, quantity: 5 })] }), [INVOICE_SAVE]);
  add('v10/stated-totals', invCtx({
    totalsOverride: {
      cartons: 60, netWeightKg: 701.5654, grossWeightKg: '712.5', cbm: 5.2575,
    },
  }), [INVOICE_SAVE]);
  add('v10/stated-totals-that-agree-or-are-blank', invCtx({
    totalsOverride: {
      cartons: '61', netWeightKg: '', grossWeightKg: null, cbm: 'n/a',
    },
  }), [INVOICE_SAVE]);
  add('v10/rounding-at-the-printed-decimals', invCtx({ totalsOverride: { cbm: 5.2565, netWeightKg: 1e21 } }, {
    plTotals: { ...INV.plTotals, cbm: 5.256 },
  }), [INVOICE_SAVE]);
  add('v10/no-packing-list-totals', invCtx({ lines: [line(1, { quantity: 1 })] }, { plTotals: null }), [INVOICE_SAVE]);
  const ack = ackOf(findingOf(short, INVOICE_SAVE, 'V-10'), '57 pieces held back for the buyer sample');
  add('v10/acknowledged', short, [INVOICE_APPROVE], { acknowledgements: [ack] });
  add('v10/acknowledgement-no-longer-applies', invCtx({ lines: [line(1, { quantity: 2790 }), LINES[1]] }), [INVOICE_APPROVE], { acknowledgements: [ack] });
}

// ─── V-11 rate against the order's price ──────────────────────────────────────────
{
  const drift = invCtx({
    lines: [
      line(1, { rate: 9.5 }),
      line(2, { rate: 8.9, description: '' }),
      line(3, { rate: 8, description: null }),
      line(4, { rate: null }),
      line(5, { rate: 9.1875 }),
      line(6, { rate: 12, orderRate: null }),
      line(7, { rate: 12, nonMerchandise: true }),
      line(8, { rate: 0.1 + 0.2, orderRate: 0.25 }),
    ],
  });
  add('v11/rates', drift, [INVOICE_SAVE, INVOICE_APPROVE]);
  add('v11/limit-off', { ...drift, rateDeviationPercent: 0 }, [INVOICE_SAVE]);
  add('v11/limit-not-given', omit(drift, 'rateDeviationPercent'), [INVOICE_SAVE]);
  add('v11/a-wider-limit', { ...drift, rateDeviationPercent: 12.5 }, [INVOICE_SAVE]);
  const ack = ackOf(findingOf(drift, INVOICE_SAVE, 'V-11'), 'Price revised by the buyer on 10-Oct');
  add('v11/acknowledged', drift, [INVOICE_APPROVE], { acknowledgements: [ack] });
  add('v11/acknowledgement-no-longer-applies', invCtx({ lines: [line(1, { rate: 9.6 })] }), [INVOICE_APPROVE], { acknowledgements: [ack] });
}

// ─── V-12 mandatory fields on an invoice ──────────────────────────────────────────
{
  add('v12-invoice/header-fields-empty', invCtx({ incoterm: '', paymentTerms: null, consignee: {} }), [INVOICE_SAVE, INVOICE_APPROVE]);
  add('v12-invoice/lines-missing-hs-code-and-rate', invCtx({
    lines: [
      line(1, { hsCode: null }),
      line(2, { rate: null }),
      line(3, { hsCode: '', rate: null, description: '' }),
      line(4, { rate: 0 }),
      line(5, { description: 'Sample charge', nonMerchandise: true, hsCode: null, rate: null }),
    ],
  }), [INVOICE_SAVE]);
  add('v12-invoice/igst-needs-an-exchange-rate', invCtx({ fxRate: null }), [INVOICE_SAVE]);
  add('v12-invoice/igst-and-a-zero-rate', invCtx({ fxRate: 0 }), [INVOICE_SAVE]);
  add('v12-invoice/igst-off', invCtx({ fxRate: null }, { template: { ...STD_INV, igst: { enabled: false, defaultRatePct: 5 } } }), [INVOICE_SAVE]);
  add('v12-invoice/template-without-igst', invCtx({ fxRate: null }, { template: { ...STD_INV, igst: null } }), [INVOICE_SAVE]);
  add('v12-invoice/paths-into-the-invoice', invCtx({ notify: null, countryOfFinalDestination: '' }, {
    template: {
      ...STD_INV,
      name: 'JOMO commercial invoice',
      mandatoryForSubmit: [
        'invoice.notify.block', 'invoice.consignee.block', 'invoice.lines.0.hsCode', 'invoice.countryOfFinalDestination',
        'invoice.lines.9.hsCode', 'invoice.incotermPlace',
      ],
      headerFields: [{ key: 'pt', label: 'Terms of payment', binding: 'invoice.paymentTerms', mandatory: true }],
    },
  }), [INVOICE_SAVE]);
  add('v12-invoice/document-paths-on-an-invoice', invCtx({}, {
    shipment: { ...SHIPMENT, vesselFlightNo: '' },
    template: { ...STD_INV, mandatoryForSubmit: ['shipment.vesselFlightNo', 'pl.plNo', 'row.danNo', 'exporter.iecNo', 'shipment.etd'] },
  }), [INVOICE_SAVE]);
  add('v12-invoice/without-a-shipment', invCtx({}, {
    shipment: null, template: { ...STD_INV, mandatoryForSubmit: ['shipment.vesselFlightNo', 'invoice.incoterm'] },
  }), [INVOICE_SAVE]);
}

// ─── V-13 built on an older packing list ──────────────────────────────────────────
{
  const moved = { ...livePl(JOMO_PL), contentHash: 'ffee0011', version: 4 };
  const stale = invCtx({}, { livePls: [moved] });
  add('v13/packing-list-changed', stale, [INVOICE_OPEN, INVOICE_SAVE, INVOICE_APPROVE]);
  add('v13/no-hash-recorded', invCtx({ packingListRefs: [{ plId: 7, plNo: 'PKL/26-27/1007', plContentHash: null }] }, { livePls: [moved] }), [INVOICE_OPEN]);
  add('v13/packing-list-not-held', invCtx({}, { livePls: [] }), [INVOICE_OPEN]);
  add('v13/two-lists-one-changed', invCtx({
    packingListRefs: [
      { plId: 7, plNo: 'PKL/26-27/1007', plContentHash: JOMO_PL.contentHash },
      { plId: 8, plNo: 'PKL/26-27/1008', plContentHash: '0badf00d' },
    ],
  }, { livePls: [livePl(JOMO_PL), { id: 8, plNo: 'PKL/26-27/1008', status: 'FINAL', contentHash: null }] }), [INVOICE_OPEN]);
  const ack = ackOf(findingOf(stale, INVOICE_OPEN, 'V-13'), 'Only a remark changed on the list');
  add('v13/acknowledged', stale, [INVOICE_APPROVE], { acknowledgements: [ack] });
  add('v13/acknowledgement-no-longer-applies', invCtx({}, { livePls: [{ ...moved, contentHash: '12345678' }] }), [INVOICE_APPROVE], { acknowledgements: [ack] });
}

// ─── V-16 already invoiced ────────────────────────────────────────────────────────
{
  const other = (id, status, invoiceNo, plIds = [7]) => ({
    id, invoiceNo, status, packingListRefs: plIds.map((plId) => ({ plId, plNo: `PKL/26-27/100${plId}`, plContentHash: 'aa' })),
  });
  add('v16/on-a-draft-invoice', invCtx({}, { invoicesForPls: [other(502, 'DRAFT', null)] }), [INVOICE_CREATE, INVOICE_SAVE, INVOICE_APPROVE]);
  add('v16/on-a-final-invoice', invCtx({}, { invoicesForPls: [other(503, 'CANCELLED', 'EXP/26-27/1003'), other(504, 'FINAL', 'EXP/26-27/1004')] }), [INVOICE_CREATE]);
  add('v16/cancelled-superseded-and-itself-ignored', invCtx({}, {
    invoicesForPls: [other(503, 'CANCELLED', 'EXP/26-27/1003'), other(505, 'SUPERSEDED', 'EXP/26-27/1005'), other(501, 'DRAFT', null)],
  }), [INVOICE_CREATE]);
  add('v16/several-allowed', invCtx({}, { allowMultiInvoicePerPl: true, invoicesForPls: [other(502, 'DRAFT', null)] }), [INVOICE_CREATE]);
  add('v16/two-lists-both-invoiced', invCtx({
    packingListRefs: [
      { plId: 7, plNo: 'PKL/26-27/1007', plContentHash: JOMO_PL.contentHash },
      { plId: 8, plNo: 'PKL/26-27/1008', plContentHash: 'bb' },
    ],
  }, { invoicesForPls: [other(506, 'EXPORTED', 'EXP/26-27/1006', [8, 7])] }), [INVOICE_APPROVE]);
}

// ─── How validate gates, and how acknowledgements attach ──────────────────────────
{
  const warned = plCtx([J1, row('101:52-61', 52, 61, SCARLET_RATIO)]);
  add('gate/warnings-by-phase', warned, [EDIT, SAVE, SUBMIT, APPROVE, STICKER, DOC_GEN, INVOICE_SAVE]);
  add('gate/invoice-warnings-by-phase', invCtx({ lines: [line(1, { quantity: 2800, rate: 9.5 }), LINES[1]] }), ALL_INVOICE_PHASES);
  const v05 = findingOf(BASE, SUBMIT, 'V-05');
  const ack = ackOf(v05, 'First reason');
  add('ack/first-that-applies-wins', QTY, [SUBMIT], { acknowledgements: [ackOf(v05, 'Second reason, listed first'), ack] });
  add('ack/null-entries-skipped', QTY, [SUBMIT], { acknowledgements: [null, ack] });
  add('ack/null-list', QTY, [SUBMIT], { acknowledgements: null });
  add('ack/code-is-not-compared', QTY, [SUBMIT], { acknowledgements: [{ ...ack, code: 'V-99' }] });
  add('ack/values-in-another-key-order', QTY, [SUBMIT], {
    acknowledgements: [{ ...ack, values: { shippedQty: v05.values.shippedQty, orderQty: v05.values.orderQty } }],
  });
  add('ack/a-number-as-text-does-not-apply', QTY, [SUBMIT], {
    acknowledgements: [{ ...ack, values: { orderQty: String(v05.values.orderQty), shippedQty: v05.values.shippedQty } }],
  });
  add('ack/without-values', QTY, [SUBMIT], { acknowledgements: [{ ...ack, values: null }] });
  const overlap = ruleCtx([row('a', 1, 10), row('b', 5, 12)]);
  add('ack/an-error-stays-blocking', overlap, [SUBMIT], {
    acknowledgements: [ackOf(findingOf(overlap, SAVE, 'V-02'), 'Should not let an error through')],
  });
  add('ack/info-acknowledged', QTY, [SAVE], { acknowledgements: [ackOf(findingOf(QTY, SAVE, 'V-04'))] });
  add('rules/a-subset-in-the-order-given', overlap, [SAVE], { rules: ['V-06', 'V-02', 'V-17'] });
  add('rules/none', overlap, [SAVE], { rules: [] });
  cases.push(
    { id: 'validate/defaults/no-options', fn: validate, args: [BASE] },
    { id: 'validate/defaults/empty-options', fn: validate, args: [BASE, {}] },
    { id: 'validate/defaults/null-phase', fn: validate, args: [BASE, { phase: null }] },
    { id: 'validate/defaults/empty-context', fn: validate, args: [{}, { phase: SUBMIT }] },
    { id: 'validate/defaults/empty-invoice-context', fn: validate, args: [{ invoice: {} }, { phase: INVOICE_APPROVE }] },
  );
}

// ─── makeTargetKey, acknowledgementApplies, buildAcknowledgement, RULES ───────────
const T = (type, id, label = null) => ({ type, id, label });
const KEY_CASES = [
  ['sorted', ['V-02', [T('ROW', '101:48-57'), T('ROW', '101:1-47')]]],
  ['one-number', ['V-03', [T('PL', 7, 'PKL/26-27/1007')]]],
  ['none', ['V-01', []]],
  ['left-out', ['V-01']],
  ['fraction-and-big-numbers', ['V-13', [T('PACKING_LIST', 7.5), T('PACKING_LIST', 1e21), T('PACKING_LIST', 123456789012345680000)]]],
  ['null-and-boolean-ids', ['V-12', [T('INVOICE_LINE', null), T('INVOICE_FIELD', true)]]],
  ['code-unit-order', ['V-02', [T('ROW', 'b'), T('ROW', 'B'), T('ROW', 'a10'), T('ROW', 'a9'), T('ROW', ch(0xe9)), T('ROW', '_')]]],
  ['type-before-id', ['V-12', [T('ROW', 'a'), T('DOC_FIELD', 'pl.plDate'), T('INVOICE_LINE', 2)]]],
  ['po-key-separator', ['V-20', [T('BLOCK', `1042|${K_HAM}`, 'SG/26-27/1042')]]],
  ['repeated-target', ['V-02', [T('ROW', 'a'), T('ROW', 'a')]]],
  // A type left out prints "undefined", which JSON cannot carry to the server; a null type prints "null" on both
  ['null-type', ['V-02', [{ type: null, id: 'a' }]]],
].map(([id, args]) => ({ id: `makeTargetKey/${id}`, fn: makeTargetKey, args }));
KEY_CASES.push({ id: 'makeTargetKey/null-targets-throw', fn: makeTargetKey, args: ['V-02', null], throws: true });

const V05 = findingOf(BASE, SUBMIT, 'V-05');
const V12_LINE = findingOf(invCtx({ lines: [line(1, { hsCode: null, rate: null })] }), INVOICE_SAVE, 'V-12');
const V05_ACK = ackOf(V05);
const V12_ACK = ackOf(V12_LINE);
const APPLY_CASES = [
  ['same-key-and-values', [V05_ACK, V05]],
  ['values-in-another-order', [{ ...V05_ACK, values: { shippedQty: 1410, orderQty: 1500 } }, V05]],
  ['a-value-changed', [{ ...V05_ACK, values: { orderQty: 1500, shippedQty: 1400 } }, V05]],
  ['another-target', [{ ...V05_ACK, targetKey: 'V-05|LINE:ST-2026-0441|Navy|L' }, V05]],
  ['a-value-added', [{ ...V05_ACK, values: { ...V05.values, note: null } }, V05]],
  ['a-number-as-text', [{ ...V05_ACK, values: { orderQty: '1500', shippedQty: 1410 } }, V05]],
  ['list-order-matters', [{ ...V12_ACK, values: { ...V12_ACK.values, missing: ['rate', 'HS code'] } }, V12_LINE]],
  ['list-in-order', [V12_ACK, V12_LINE]],
  ['no-values-against-values', [{ ...V05_ACK, values: null }, V05]],
  ['no-values-against-no-values', [{ ...V05_ACK, values: null }, { ...V05, values: {} }]],
  ['empty-against-missing', [{ ...V05_ACK, values: {} }, { targetKey: V05.targetKey }]],
  ['code-not-compared', [{ ...V05_ACK, code: 'V-15' }, V05]],
  ['nested-values', [
    { code: 'V-18', targetKey: 'V-18|PLAN_ROW:plan-1', values: { orderId: 1042, ranges: `1${EN_DASH}20`, aspects: 'colour, sizes per carton' } },
    {
      code: 'V-18', targetKey: 'V-18|PLAN_ROW:plan-1', values: { aspects: 'colour, sizes per carton', ranges: `1${EN_DASH}20`, orderId: 1042 },
    },
  ]],
  ['both-without-a-key', [{ values: { a: 1 } }, { values: { a: 1 } }]],
].map(([id, args]) => ({ id: `acknowledgementApplies/${id}`, fn: acknowledgementApplies, args }));
APPLY_CASES.push({
  id: 'acknowledgementApplies/jsonb-key-order',
  fn: acknowledgementApplies,
  argsJson: '[{"targetKey":"V-06|ROW:a","values":{"size":"104","qty":2.5}},{"targetKey":"V-06|ROW:a","values":{"qty":2.5,"size":"104"}}]',
});

const BUILD_CASES = [
  ['warning', [V05, 'Buyer agreed a short shipment of XL by email on 12-Oct', 'Priya S.', AT]],
  ['list-values', [V12_LINE, `Line 1 is the buyer${ch(0x2019)}s "free of charge" sample`, 'Arun K.', '2026-10-15 09:05']],
  ['finding-without-values', [{ code: 'V-03', targetKey: 'V-03|PL:7' }, 'Dropped cartons', 'Priya S.', AT]],
  ['nothing-but-a-finding', [V05]],
].map(([id, args]) => ({ id: `buildAcknowledgement/${id}`, fn: buildAcknowledgement, args }));

const CASES = [
  { id: 'RULES/catalogue', fn: RULES, args: [] },
  ...KEY_CASES,
  ...APPLY_CASES,
  ...BUILD_CASES,
  ...cases,
];

test('validation parity fixtures', () => {
  const { count } = writeFixtures('expDocValidation', CASES, { api: API });
  expect(count).toBe(CASES.length);
});
