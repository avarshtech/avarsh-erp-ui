/**
 * Seed data for the Export Documentation mock store.
 *
 * Conventions carried over from srMockData.js:
 *  - Every date is relative to today via d(offset), so the demo never goes stale.
 *  - Every seeded record carries a comment naming the demo case it exists to prove.
 *  - docSeq is an explicit mirror of the backend sys_doc_counters (prefix, fy_code).
 *
 * BUMP SEED_VERSION on any change to this file, or existing demo browsers keep the
 * stale copy. Bumping discards user-entered demo data — that is the documented
 * reset path.
 *
 * Carton data is stored as RANGES (cartonFrom..cartonTo), never one row per carton.
 * Entry CPK/26-27/1002 deliberately covers 900 cartons in four rows to prove that
 * an unbounded carton count costs nothing in the store.
 */
import dayjs from 'dayjs';
import { docNo, fiscalYearLabel, EXPDOC_PREFIX, FIRST_DOC_NUMBER } from './expDocDocNumbers';
import {
  PACKING_TYPE,
  SECTION_KEY,
  PACKING_ENTRY_STATUS,
  LINE_GRAIN,
  DEFAULT_TENANT_CONFIG,
} from '../../utils/expDocConstants';

// 12 (2026-10-08): shipments take the consignee from the buyer master and carry
// their orders; sub-client, end customer, seal, pallets and delivery centre removed.
// 13 (2026-10-08): carton-sticker templates moved to the API, so the STK-n seeds are
// gone (a stored run naming one would be looked up there); JOMO rows carry EANs for
// some sizes, and every packing entry a season.
// 14 (2026-10-08): shipments moved to the API. The seeded shipments, ports and
// incoterms are gone, and packing entries bind to a shipment of their buyer.
export const SEED_VERSION = 14;

const FY = fiscalYearLabel();
const d = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
const ts = (offsetDays, time = '10:00') => `${d(offsetDays)} ${time}`;

// ─── Size sets ──────────────────────────────────────────────────────────────────
const MENS_SIZES = ['M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_EU_SIZES = ['74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140'];
const BABY_SIZES = ['50/56', '62/68', '74/80', '86/92'];

// ─── Masters ────────────────────────────────────────────────────────────────────
// Incoterms are a fixed list in utils/expDocConstants.js; ports are the API's port catalogue.

// Garment HS codes with their IGST rate. The rate is fiscal rather than stylistic,
// which is why it lives on the code and not on the style.
const SEED_HS_CODES = [
  { code: '6109', description: 'T-shirts, singlets and other vests, knitted', igstRate: 12, defaultForCategory: 'Knit' },
  { code: '6110', description: 'Jerseys, pullovers, cardigans, knitted', igstRate: 12, defaultForCategory: 'Sweater' },
  { code: '6203', description: "Men's or boys' suits, trousers, woven", igstRate: 12, defaultForCategory: 'Denim' },
  { code: '6204', description: "Women's or girls' suits, trousers, woven", igstRate: 12, defaultForCategory: 'Woven' },
  { code: '6206', description: "Women's or girls' blouses and shirts, woven", igstRate: 12, defaultForCategory: 'Woven' },
  { code: '6111', description: 'Babies garments and clothing accessories, knitted', igstRate: 12, defaultForCategory: 'Baby' },
  { code: '6217', description: 'Other made-up clothing accessories', igstRate: 12, defaultForCategory: 'Default' },
];

/**
 * Buyer commercial profiles — keyed by buyerCode AND buyerName, because the real
 * buyer master supplies ids we cannot know at seed time. Lookup falls back to a
 * neutral default so an unseeded buyer still produces a usable document.
 *
 * Everything here is a MOCK-ONLY data gap: currency, incoterm, payment terms and
 * tolerance do not exist on mst_buyers today. The consignee and notify party are
 * NOT here — a shipment takes them from the real buyer master (the buyer, its
 * shipping locations and its bank).
 */
const SEED_BUYER_COMMERCIAL = [
  {
    buyerCode: 'JOMO',
    buyerName: 'JOMO BV',
    currency: 'EUR',
    incoterm: 'FOB',
    paymentTerms: 'TT 60 DAYS FROM BL DATE',
    tolerancePercent: 2,
    allowMultiInvoicePerPl: false,
  },
  {
    buyerCode: 'VGT',
    buyerName: 'Van Gennip Textiles BV',
    currency: 'EUR',
    incoterm: 'CIF',
    paymentTerms: 'TT 45 DAYS',
    tolerancePercent: 0,
    allowMultiInvoicePerPl: false,
  },
  {
    buyerCode: 'PRENATAL',
    buyerName: 'Prénatal Moeder en Kind BV',
    currency: 'EUR',
    incoterm: 'FOB',
    paymentTerms: 'D/A 45 DAYS',
    tolerancePercent: 0,
    allowMultiInvoicePerPl: false,
    discountPercent: 3, // the Prénatal 3% discount line (PRD §8.4)
  },
];

/** The demo buyer code a real buyer's name maps to, or null; the profiles are keyed by both. */
export const buyerCodeOf = (buyerName) => {
  const name = String(buyerName ?? '').trim().toLowerCase();
  return SEED_BUYER_COMMERCIAL.find((b) => b.buyerName.toLowerCase() === name)?.buyerCode ?? null;
};

export const DEFAULT_BUYER_COMMERCIAL = {
  buyerCode: null,
  buyerName: null,
  currency: 'USD',
  incoterm: 'FOB',
  paymentTerms: 'TT 30 DAYS',
  tolerancePercent: DEFAULT_TENANT_CONFIG.defaultTolerancePercent,
  allowMultiInvoicePerPl: false,
};

/**
 * Exporter fields the org master does not carry. Mirrors the shape of the SR
 * module's SEED_COMPANY_PROFILE_EXTRA; the real org record supplies name, address,
 * GSTIN, PAN and the bank block.
 */
const SEED_EXPORTER_PROFILE_EXTRA = {
  iecNumber: 'AAACS1234F',
  panNumber: 'AAACS1234F',
  adCode: '6390004-1900001',
  lutNumber: 'AD330324000123X',
  gstStateCode: '33',
  swiftCode: 'UCBAINBB033',
  aepcRegnNo: 'TN/12345/2019',
  rexNumber: 'INREX3300123',
  starExportHouse: 'Two Star Export House — Cert. 33/2024',
  signatory: 'Authorised Signatory',
  declarations: [
    { order: 1, code: 'IGST', text: 'SUPPLY MEANT FOR EXPORT WITH PAYMENT OF IGST' },
    { order: 2, code: 'ORIGIN', text: 'We declare that the goods are wholly obtained / produced in India.' },
    { order: 3, code: 'TRUE_VALUE', text: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.' },
  ],
  invoiceSeries: [{ code: 'EXP', label: 'Export commercial invoice' }],
};

/** Last 30 days of rates so an invoice dated in the past still finds one. */
const buildFxRates = () => {
  const rows = [];
  for (let i = 0; i < 30; i += 1) {
    const date = d(-i);
    rows.push({ date, from: 'USD', to: 'INR', rate: 83.2 + ((i % 7) * 0.05) });
    rows.push({ date, from: 'EUR', to: 'INR', rate: 90.4 + ((i % 5) * 0.07) });
    rows.push({ date, from: 'GBP', to: 'INR', rate: 105.6 + ((i % 6) * 0.09) });
  }
  return rows;
};

// ─── Packing entries ────────────────────────────────────────────────────────────

/**
 * Order numbers follow the ERP standard: OrderService generates them with the "SG"
 * prefix through DocumentNumberService, so they read SG/<FY>/<NNNN>.
 */
const orderNo = (seq) => docNo('SG', seq, FY);

/**
 * Ordered quantities per style / colour / size, snapshotted onto the packing entry.
 *
 * The entry is where a real order is bound, so this is where the breakdown belongs:
 * the packing list then reads it from the entry rather than re-fetching an order
 * that may have moved on, and order-vs-packed keeps working for seeded demo data
 * whose order numbers do not exist in a given database.
 */
/*
 * One ordered line per style/colour/size, mirroring the real order's
 * `colorRows[].quantities` x `sizePrices`. `rate` is the order's FOB price and may
 * be a flat number or a per-size map — real orders price per size, and the invoice
 * needs that to default a rate without anyone typing one.
 */
const ob = (styleNo, colorName, sizes, rate = null) =>
  Object.entries(sizes).map(([size, orderQty]) => ({
    styleNo,
    colorName,
    size,
    orderQty,
    orderRate: rate === null ? null
      : (typeof rate === 'object' ? (rate[size] ?? null) : rate),
  }));

let groupSeq = 0;
const g = (over) => {
  groupSeq += 1;
  return {
    id: groupSeq,
    seq: groupSeq,
    sectionKey: SECTION_KEY.MAIN,
    packingType: PACKING_TYPE.SOLID,
    cartonFrom: 1,
    cartonTo: 1,
    packingCode: null,
    danNo: null,
    // Every seeded entry binds a single order line (lineNo 1), mirroring its
    // orderLineRefs. Left null, the per-order-line invoice grain would collapse
    // every order into one line.
    orderLineId: 1,
    buyerPoNo: null,
    destination: null,
    styleNo: null,
    colorName: null,
    articleNos: null,
    eanBySize: null,
    sizeQty: null,
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
    completionFlag: true,
    version: 0,
    ...over,
  };
};

const buildPackingEntries = () => [
  {
    // The reference entry: all five packing types in one document, and the
    // 1–47 solid + extra-carton-48 control case from PRD §25.
    id: 1,
    packingNo: docNo(EXPDOC_PREFIX.PACKING_ENTRY, 1001, FY),
    status: PACKING_ENTRY_STATUS.COMPLETED,
    orderNo: orderNo(1042),
    buyerCode: 'JOMO',
    buyerName: 'JOMO BV',
    styleNo: 'ST-2026-0441',
    garmentName: "Men's Slim Fit Polo",
    // Drives the HS-code default. No such field exists on the real style master —
    // see the data-gap ledger; the API phase owes stl_styles.hs_code.
    garmentCategory: 'Knit',
    compositionText: '95% COTTON 5% ELASTANE',
    // What a sticker prints as `carton.season` for every carton of this entry.
    season: 'AW26',
    sizePresetName: 'Men M–XXXL',
    sizes: MENS_SIZES,
    orderLineRefs: [
      { orderLineId: 1, lineNo: 1, buyerPoNo: 'PO-884213', destination: 'Rotterdam', dispatchDate: d(10) },
    ],
    orderBreakdown: [
      // Navy L is +0.95% (inside the 2% JOMO tolerance) -> INFO.
      // Navy XL is -6% -> WARN needing a reason. Everything else matches exactly.
      ...ob('ST-2026-0441', 'Navy', { M: 488, L: 950, XL: 1500 }, 8.75),
      ...ob('ST-2026-0441', 'Flame Scarlet 18-1662 TCX', { M: 49, L: 86, XL: 80, XXL: 40 }, 8.75),
    ],
    groups: [
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 1, cartonTo: 47,
        danNo: 'DAN-4471', buyerPoNo: 'PO-884213',
        destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: 'Navy',
        // The buyer's own article number, one per size — what JOMO's SCA carton
        // marking prints as CLIENT ARTICLE No.
        articleNos: { M: 'ART-99120', L: 'ART-99121', XL: 'ART-99122' },
        // One EAN-13 per size, for a template that prints a barcode per size. Only
        // this row has them all: the next has some, the rest none — so a barcode run
        // over the whole list shows the "no EAN" path as well as the printed one.
        eanBySize: { M: '8712345001018', L: '8712345001025', XL: '8712345001032' },
        sizeQty: { M: 10, L: 20, XL: 30 },
        netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35,
      }),
      g({
        packingType: PACKING_TYPE.RATIO, cartonFrom: 48, cartonTo: 57,
        danNo: 'DAN-4472', buyerPoNo: 'PO-884213',
        destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: 'Flame Scarlet 18-1662 TCX',
        articleNos: { M: 'ART-99130', L: 'ART-99131', XL: 'ART-99132', XXL: 'ART-99133' },
        // XL and XXL deliberately have no EAN.
        eanBySize: { M: '8712345002015', L: '8712345002022' },
        ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
        netWeightKg: 9.2, grossWeightKg: 10.0, lengthCm: 60, breadthCm: 40, heightCm: 30,
      }),
      g({
        packingType: PACKING_TYPE.MIXED, cartonFrom: 58, cartonTo: 60,
        danNo: 'DAN-4473', buyerPoNo: 'PO-884213',
        destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: null,
        articleNos: { M: 'ART-99120', L: 'ART-99121' },
        mixedRows: [
          { colorName: 'Navy', sizeQty: { M: 5, L: 5 } },
          { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } },
        ],
        netWeightKg: 7.0, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25,
      }),
      g({
        // Leftover odd carton with its own smaller dimensions (PRD §24.4).
        sectionKey: SECTION_KEY.EXTRA, packingType: PACKING_TYPE.EXTRA,
        cartonFrom: 61, cartonTo: 61,
        danNo: 'DAN-4474', buyerPoNo: 'PO-884213',
        destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: 'Navy',
        articleNos: { M: 'ART-99120', L: 'ART-99121' },
        sizeQty: { M: 3, L: 4 },
        netWeightKg: 2.005, grossWeightKg: 2.5, lengthCm: 40, breadthCm: 30, heightCm: 20,
      }),
    ],
    version: 4,
    lastUpdated: ts(-2, '16:20'),
    updatedBy: 'Priya S.',
    createdAt: ts(-6, '09:05'),
    createdBy: 'Priya S.',
  },
  {
    // Scale case: 900 cartons in four rows. Proves totals stay O(rows) and the
    // store stays small no matter how large the order is.
    id: 2,
    packingNo: docNo(EXPDOC_PREFIX.PACKING_ENTRY, 1002, FY),
    status: PACKING_ENTRY_STATUS.COMPLETED,
    orderNo: orderNo(1055),
    buyerCode: 'VGT',
    buyerName: 'Van Gennip Textiles BV',
    styleNo: 'ST-2026-0512',
    garmentName: "Girls' Printed Tee",
    garmentCategory: 'Knit',
    compositionText: '100% ORGANIC COTTON',
    season: '2026-WINTER',
    sizePresetName: 'Kids EU 74–140',
    sizes: KIDS_EU_SIZES,
    orderLineRefs: [
      { orderLineId: 1, lineNo: 1, buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', dispatchDate: d(22) },
    ],
    orderBreakdown: [
      // Exact match throughout — the clean 900-carton case.
      ...ob('ST-2026-0512', 'Ecru', { 74: 3600, 80: 3600, 86: 3600, 92: 3600, 98: 3600, 104: 3600 },
        { 74: 4.10, 80: 4.10, 86: 4.20, 92: 4.20, 98: 4.35, 104: 4.35 }),
      ...ob('ST-2026-0512', 'Dusty Rose', { 110: 3120, 116: 3120, 122: 3120, 128: 400, 134: 400, 140: 400 },
        { 110: 4.50, 116: 4.50, 122: 4.65, 128: 4.65, 134: 4.80, 140: 4.80 }),
    ],
    groups: [
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 1, cartonTo: 300,
        buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', styleNo: 'ST-2026-0512',
        colorName: 'Ecru', sizeQty: { 74: 12, 80: 12, 86: 12 },
        netWeightKg: 8.4, grossWeightKg: 9.1, lengthCm: 60, breadthCm: 40, heightCm: 30,
      }),
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 301, cartonTo: 600,
        buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', styleNo: 'ST-2026-0512',
        colorName: 'Ecru', sizeQty: { 92: 12, 98: 12, 104: 12 },
        netWeightKg: 9.1, grossWeightKg: 9.8, lengthCm: 60, breadthCm: 40, heightCm: 30,
      }),
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 601, cartonTo: 860,
        buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', styleNo: 'ST-2026-0512',
        colorName: 'Dusty Rose', sizeQty: { 110: 12, 116: 12, 122: 12 },
        netWeightKg: 9.9, grossWeightKg: 10.6, lengthCm: 60, breadthCm: 40, heightCm: 30,
      }),
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 861, cartonTo: 900,
        buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', styleNo: 'ST-2026-0512',
        colorName: 'Dusty Rose', sizeQty: { 128: 10, 134: 10, 140: 10 },
        netWeightKg: 8.8, grossWeightKg: 9.5, lengthCm: 60, breadthCm: 40, heightCm: 30,
      }),
    ],
    version: 2,
    lastUpdated: ts(-1, '11:40'),
    updatedBy: 'Karthik R.',
    createdAt: ts(-3, '14:10'),
    createdBy: 'Karthik R.',
  },
  {
    // Still OPEN, and deliberately missing weights on one row — binds to a packing
    // list with a warning (PRD §7.1) and blocks sticker generation (V-08).
    id: 3,
    packingNo: docNo(EXPDOC_PREFIX.PACKING_ENTRY, 1003, FY),
    status: PACKING_ENTRY_STATUS.OPEN,
    orderNo: orderNo(1061),
    buyerCode: 'PRENATAL',
    buyerName: 'Prénatal Moeder en Kind BV',
    styleNo: 'ST-2026-0588',
    garmentName: 'Baby 3-pack Bodysuit',
    garmentCategory: 'Baby',
    compositionText: '100% COTTON INTERLOCK',
    season: 'SS27',
    sizePresetName: 'Baby 50/56–86/92',
    sizes: BABY_SIZES,
    orderLineRefs: [
      { orderLineId: 1, lineNo: 1, buyerPoNo: 'PRE-55120', destination: 'Rotterdam', dispatchDate: d(36) },
    ],
    orderBreakdown: [
      // Prenatal carries a 0% tolerance, so the 24-piece excess on 86/92 warns.
      ...ob('ST-2026-0588', 'White', { '50/56': 384, '62/68': 384, '74/80': 384 }, 6.90),
      ...ob('ST-2026-0588', 'Soft Blue', { '74/80': 288, '86/92': 264 }, 6.90),
    ],
    groups: [
      g({
        // Master polybag: PCS/MPB x MPB/CTN, with the pack ratio so size columns resolve.
        packingType: PACKING_TYPE.MPB, cartonFrom: 1, cartonTo: 24,
        buyerPoNo: 'PRE-55120', destination: 'Rotterdam', styleNo: 'ST-2026-0588',
        colorName: 'White',
        ratio: { '50/56': 2, '62/68': 2, '74/80': 2 }, pcsPerMpb: 6, mpbPerCarton: 8,
        netWeightKg: 5.125, grossWeightKg: 5.9, lengthCm: 50, breadthCm: 30, heightCm: 25,
      }),
      g({
        packingType: PACKING_TYPE.SOLID, cartonFrom: 25, cartonTo: 36,
        buyerPoNo: 'PRE-55120', destination: 'Rotterdam', styleNo: 'ST-2026-0588',
        colorName: 'Soft Blue',
        sizeQty: { '74/80': 24, '86/92': 24 },
        // Weights intentionally absent — the V-08 demo case.
        netWeightKg: null, grossWeightKg: null, lengthCm: 50, breadthCm: 30, heightCm: 25,
        completionFlag: false,
      }),
    ],
    version: 1,
    lastUpdated: ts(0, '09:15'),
    updatedBy: 'Priya S.',
    createdAt: ts(-1, '15:30'),
    createdBy: 'Priya S.',
  },
];

// ─── Seed assembly ──────────────────────────────────────────────────────────────

export const buildSeedDb = () => {
  groupSeq = 0;
  const packingEntries = buildPackingEntries();

  // No shipments: they are the API's, mirrored over every load (expDocMockStore).
  return {
    seedVersion: SEED_VERSION,
    // Explicit mirror of sys_doc_counters (prefix, fy_code): last number used.
    docSeq: {
      [`${EXPDOC_PREFIX.PACKING_ENTRY}/${FY}`]: FIRST_DOC_NUMBER - 1 + packingEntries.length,
      [`${EXPDOC_PREFIX.PACKING_LIST}/${FY}`]: FIRST_DOC_NUMBER - 1,
      [`${EXPDOC_PREFIX.INVOICE}/${FY}`]: FIRST_DOC_NUMBER - 1,
      [`${EXPDOC_PREFIX.STICKER_RUN}/${FY}`]: FIRST_DOC_NUMBER - 1,
    },
    packingEntries,
    packingLists: [],
    invoices: [],
    stickerRuns: [],
    audit: [],
    masters: {
      hsCodes: SEED_HS_CODES,
      buyerCommercial: SEED_BUYER_COMMERCIAL,
      fxRates: buildFxRates(),
      exporterProfileExtra: SEED_EXPORTER_PROFILE_EXTRA,
      tenantConfig: { ...DEFAULT_TENANT_CONFIG },
    },
  };
};
