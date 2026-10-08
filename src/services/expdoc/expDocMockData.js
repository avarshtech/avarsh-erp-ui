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
  TEMPLATE_STATUS,
  DOC_TYPE,
  FACE_RENDER,
  PAPER,
  LINE_GRAIN,
  DEFAULT_TENANT_CONFIG,
} from '../../utils/expDocConstants';

// 12 (2026-10-08): shipments take the consignee from the buyer master and carry
// their orders; sub-client, end customer, seal, pallets and delivery centre removed.
export const SEED_VERSION = 12;

const FY = fiscalYearLabel();
const d = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
const ts = (offsetDays, time = '10:00') => `${d(offsetDays)} ${time}`;

// ─── Size sets ──────────────────────────────────────────────────────────────────
const MENS_SIZES = ['M', 'L', 'XL', 'XXL', 'XXXL'];
const KIDS_EU_SIZES = ['74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140'];
const BABY_SIZES = ['50/56', '62/68', '74/80', '86/92'];

// ─── Masters ────────────────────────────────────────────────────────────────────

const SEED_PORTS = [
  { code: 'INMAA1', name: 'Chennai Sea', country: 'India', type: 'SEA' },
  { code: 'INTUT1', name: 'Tuticorin Sea', country: 'India', type: 'SEA' },
  { code: 'INMAA4', name: 'Chennai Air', country: 'India', type: 'AIR' },
  { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', type: 'SEA' },
  { code: 'BEANR', name: 'Antwerp', country: 'Belgium', type: 'SEA' },
  { code: 'DEHAM', name: 'Hamburg', country: 'Germany', type: 'SEA' },
  { code: 'USNYC', name: 'New York', country: 'USA', type: 'SEA' },
];

// Incoterms 2020 — a fixed constant list, not a maintainable master.
const SEED_INCOTERMS = [
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
];

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

// ─── Templates ──────────────────────────────────────────────────────────────────
// Carton-sticker templates only. Packing-list and invoice templates live in the API
// (/export-docs/templates) and the standard layouts in utils/expDocSystemTemplates.js.
// Sticker ids are strings so a sticker can never collide with an API template id.

const buildTemplates = () => [
  {
    // Two-face sticker layout — the JOMO LONG SIDE / SHORT SIDE pattern (PRD §9.2).
    id: 'STK-3',
    templateCode: 'JOMO-AMG-STICKER',
    name: 'JOMO — AMG — Carton Sticker',
    buyerId: null,
    buyerCode: 'JOMO',
    docType: DOC_TYPE.STICKER,
    version: 1,
    status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-180),
    effectiveTo: null,
    clonedFromId: null,
    publishedAt: ts(-180),
    publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [],
    addressBlocks: [],
    columns: [],
    sheets: [],
    invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'JOMO-AMG',
      paperDefault: PAPER.A4_2UP,
      faces: [
        {
          key: 'LONG',
          title: 'LONG SIDE',
          render: FACE_RENDER.STACK,
          border: { style: 'solid', widthPt: 1.5 },
          lines: [
            { key: 'buyer', label: null, binding: 'buyer.name', fontPt: 22, bold: true, align: 'CENTER' },
            { key: 'po', label: 'ORDER NO', binding: 'carton.buyerPoNo', fontPt: 12 },
            { key: 'style', label: 'STYLE', binding: 'carton.styleNo', fontPt: 12 },
            { key: 'colour', label: 'COLOUR', binding: 'carton.colorName', fontPt: 12 },
            { key: 'pieces', label: 'QTY', binding: 'carton.pieces', suffix: ' PCS', fontPt: 12 },
            { key: 'ctn', label: 'CARTON', binding: 'carton.nOfN', fontPt: 16, bold: true },
            { key: 'origin', label: 'MADE IN', binding: 'exporter.country', fontPt: 14, bold: true },
          ],
          sizeGrid: null,
          barcode: null,
        },
        {
          key: 'SHORT',
          title: 'SHORT SIDE',
          render: FACE_RENDER.STACK,
          border: { style: 'solid', widthPt: 1.5 },
          lines: [
            { key: 'dan', label: 'DAN', binding: 'carton.danNo', fontPt: 16, bold: true },
            { key: 'ctn', label: 'CARTON', binding: 'carton.nOfN', fontPt: 16, bold: true },
            { key: 'nw', label: 'N.W.', binding: 'carton.netWeightKg', suffix: ' KG', decimals: 3, fontPt: 12 },
            { key: 'gw', label: 'G.W.', binding: 'carton.grossWeightKg', suffix: ' KG', decimals: 3, fontPt: 12 },
            { key: 'dims', label: 'MEAS.', binding: 'carton.dimensions', suffix: ' CM', fontPt: 11 },
          ],
          sizeGrid: null,
          barcode: { type: 'CODE128', binding: 'carton.cartonNo', enabled: false, heightMm: 12 },
        },
      ],
      // Drives V-08 at sticker generation: these must be present or the affected
      // cartons are named and generation is blocked.
      mandatoryFields: ['carton.danNo', 'carton.netWeightKg', 'carton.grossWeightKg'],
    },
    formatting: { font: 'Arial' },
    printWeights: true,
    printDimensions: true,
    mandatoryForSubmit: [],
    mandatoryForDocGen: [],
  },
  {
    // JOMO SCA customer — two faces again, but a different field set: this is the
    // variation the template engine has to absorb without new code (PRD 9.2).
    id: 'STK-5',
    templateCode: 'JOMO-SCA-STICKER',
    name: 'JOMO — SCA — Carton Sticker',
    buyerId: null, buyerCode: 'JOMO',
    docType: DOC_TYPE.STICKER, version: 1, status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-180), effectiveTo: null, clonedFromId: 'STK-3',
    publishedAt: ts(-180), publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [], addressBlocks: [], columns: [], sheets: [], invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'JOMO-SCA',
      paperDefault: PAPER.A4_2UP,
      faces: [
        {
          // The buyer's own carton-marking sheet: a THIS SIDE UP head, the shipping
          // mark, then ten fields whose colons line up in a column. COLON_LIST is
          // what holds that alignment however long a label runs.
          key: 'LONG', title: 'LONG SIDE', render: FACE_RENDER.COLON_LIST,
          border: { style: 'solid', widthPt: 1.5 },
          caption: 'THIS SIDE UP',
          symbol: 'THIS_SIDE_UP',
          lines: [
            // The shipping mark head. Fixed text: the ERP has no field for it, and
            // §10 says a template carries what the data model does not.
            { key: 'mark', label: null, binding: 'fixed:BJJI:', fontPt: 13, bold: true },
            { key: 'clientOrder', label: 'CLIENT ORDER No', binding: 'carton.buyerPoNo', fontPt: 12 },
            { key: 'po', label: 'PO No', binding: 'pl.orderNos', fontPt: 12 },
            { key: 'article', label: 'CLIENT ARTICLE No', binding: 'carton.articleNo', fontPt: 12 },
            { key: 'style', label: 'STYLE No', binding: 'carton.styleNo', fontPt: 12 },
            { key: 'ctn', label: 'CARTON No', binding: 'carton.nOfN', fontPt: 12 },
            { key: 'port', label: 'PORT OF DESTINATION', binding: 'carton.destination', fontPt: 12 },
            { key: 'colour', label: 'COLOR', binding: 'carton.colorName', fontPt: 12 },
            { key: 'size', label: 'SIZE', binding: 'carton.sizeText', fontPt: 12 },
            { key: 'qty', label: 'QUANTITY', binding: 'carton.pieces', suffix: ' PCS', fontPt: 12 },
          ],
          sizeGrid: null, barcode: null,
        },
        {
          // Three weights-and-measures lines only. The carton number and the port
          // are NOT repeated here: the buyer's sheet puts both on the long side.
          // Colons align the same way, so the two faces read as one document.
          key: 'SHORT', title: 'SHORT SIDE', render: FACE_RENDER.COLON_LIST,
          border: { style: 'solid', widthPt: 1.5 },
          lines: [
            { key: 'nw', label: 'NET WEIGHT', binding: 'carton.netWeightKg', suffix: ' KGS', decimals: 3, fontPt: 12 },
            { key: 'gw', label: 'GROSS WEIGHT', binding: 'carton.grossWeightKg', suffix: ' KGS', decimals: 3, fontPt: 12 },
            { key: 'dims', label: 'CARTON MEASUREMENT', binding: 'carton.dimensions', suffix: ' CM', fontPt: 12 },
          ],
          sizeGrid: null, barcode: null,
        },
      ],
      // Every field the buyer's sheet prints has to be there before the run goes out,
      // or a carton ships with a blank line where the customer looks for its article.
      mandatoryFields: [
        'carton.netWeightKg', 'carton.grossWeightKg', 'carton.buyerPoNo',
        'carton.articleNo', 'carton.destination',
      ],
    },
    formatting: { font: 'Arial' }, printWeights: true, printDimensions: true,
    mandatoryForSubmit: [], mandatoryForDocGen: [],
  },
  {
    // Prenatal solid pack — a single face, FROM/TO addressing.
    id: 'STK-6',
    templateCode: 'PRENATAL-SOLID-STICKER',
    name: 'Prénatal — Solid Pack — Carton Sticker',
    buyerId: null, buyerCode: 'PRENATAL',
    docType: DOC_TYPE.STICKER, version: 1, status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-120), effectiveTo: null, clonedFromId: null,
    publishedAt: ts(-120), publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [], addressBlocks: [], columns: [], sheets: [], invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'PRENATAL-SOLID',
      paperDefault: PAPER.A5,
      faces: [
        {
          key: 'MAIN', title: null, render: FACE_RENDER.STACK,
          border: { style: 'solid', widthPt: 1.5 },
          lines: [
            { key: 'from', label: 'FROM', binding: 'exporter.name', fontPt: 12 },
            { key: 'to', label: 'TO', binding: 'fixed:PRENATAL / NETHERLAND', fontPt: 12, bold: true },
            { key: 'style', label: 'STYLE', binding: 'carton.styleNo', fontPt: 12 },
            { key: 'order', label: 'ORDER', binding: 'carton.buyerPoNo', fontPt: 12 },
            { key: 'colour', label: 'COLOUR', binding: 'carton.colorName', fontPt: 12 },
            { key: 'qty', label: 'QTY', binding: 'carton.pieces', suffix: ' PCS', fontPt: 12 },
            { key: 'ctn', label: 'C/NO', binding: 'carton.nOfN', fontPt: 14, bold: true },
            { key: 'nw', label: 'N.W.', binding: 'carton.netWeightKg', suffix: ' KG', decimals: 3, fontPt: 11 },
            { key: 'gw', label: 'G.W.', binding: 'carton.grossWeightKg', suffix: ' KG', decimals: 3, fontPt: 11 },
          ],
          sizeGrid: null, barcode: null,
        },
      ],
      mandatoryFields: ['carton.netWeightKg', 'carton.grossWeightKg'],
    },
    formatting: { font: 'Arial' }, printWeights: true, printDimensions: false,
    mandatoryForSubmit: [], mandatoryForDocGen: [],
  },
  {
    // Prenatal ratio pack — the one layout that prints a colour x size table.
    id: 'STK-7',
    templateCode: 'PRENATAL-RATIO-STICKER',
    name: 'Prénatal — Ratio Pack — Carton Sticker',
    buyerId: null, buyerCode: 'PRENATAL',
    docType: DOC_TYPE.STICKER, version: 1, status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-120), effectiveTo: null, clonedFromId: 'STK-6',
    publishedAt: ts(-120), publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [], addressBlocks: [], columns: [], sheets: [], invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'PRENATAL-RATIO',
      paperDefault: PAPER.A5,
      faces: [
        {
          key: 'MAIN', title: null, render: FACE_RENDER.STACK,
          border: { style: 'solid', widthPt: 1.5 },
          lines: [
            { key: 'to', label: 'TO', binding: 'fixed:PRENATAL / NETHERLAND', fontPt: 12, bold: true },
            { key: 'style', label: 'STYLE', binding: 'carton.styleNo', fontPt: 12 },
            { key: 'order', label: 'ORDER', binding: 'carton.buyerPoNo', fontPt: 12 },
            { key: 'ctn', label: 'C/NO', binding: 'carton.nOfN', fontPt: 14, bold: true },
            { key: 'qty', label: 'TOTAL', binding: 'carton.pieces', suffix: ' PCS', fontPt: 12 },
          ],
          sizeGrid: { enabled: true, rows: 'COLOUR', cols: 'SIZE' },
          barcode: null,
        },
      ],
      mandatoryFields: ['carton.netWeightKg'],
    },
    formatting: { font: 'Arial' }, printWeights: true, printDimensions: false,
    mandatoryForSubmit: [], mandatoryForDocGen: [],
  },
  {
    // Vingino — a bordered key/value table, and the ONLY analysed buyer whose label
    // carries a barcode (its EAN, printed as a number today). PRD 19.
    id: 'STK-8',
    templateCode: 'VINGINO-STICKER',
    name: 'Vingino — Carton Sticker',
    buyerId: null, buyerCode: 'VINGINO',
    docType: DOC_TYPE.STICKER, version: 1, status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-90), effectiveTo: null, clonedFromId: null,
    publishedAt: ts(-90), publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [], addressBlocks: [], columns: [], sheets: [], invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'VINGINO',
      paperDefault: PAPER.A4_2X2,
      faces: [
        {
          key: 'MAIN', title: null, render: FACE_RENDER.TABLE,
          border: { style: 'solid', widthPt: 1 },
          lines: [
            { key: 'ctn', label: 'Carton no', binding: 'carton.nOfN' },
            { key: 'supplier', label: 'Supplier number', binding: 'fixed:SUP-4471' },
            { key: 'po', label: 'PO', binding: 'carton.buyerPoNo' },
            { key: 'article', label: 'Article no', binding: 'carton.styleNo' },
            { key: 'colour', label: 'Colour', binding: 'carton.colorName' },
            { key: 'qty', label: 'Quantity', binding: 'carton.pieces' },
            { key: 'dims', label: 'Carton dimension', binding: 'carton.dimensions', suffix: ' cm' },
            { key: 'gw', label: 'Gross weight', binding: 'carton.grossWeightKg', suffix: ' kg', decimals: 3 },
            { key: 'nw', label: 'Net weight', binding: 'carton.netWeightKg', suffix: ' kg', decimals: 3 },
            { key: 'season', label: 'Season / run', binding: 'fixed:SS26 / R2' },
          ],
          sizeGrid: null,
          barcode: { type: 'CODE128', binding: 'carton.cartonNo', enabled: true, heightMm: 14 },
        },
      ],
      mandatoryFields: ['carton.grossWeightKg', 'carton.netWeightKg', 'carton.dimensions'],
    },
    formatting: { font: 'Arial' }, printWeights: true, printDimensions: true,
    mandatoryForSubmit: [], mandatoryForDocGen: [],
  },
  {
    // Van Gennip — the nine-line monospace block that is copy-pasted by hand
    // hundreds of times today (PRD 2). One template row replaces all of it.
    id: 'STK-9',
    templateCode: 'VGT-STICKER',
    name: 'Van Gennip — Carton Sticker',
    buyerId: null, buyerCode: 'VGT',
    docType: DOC_TYPE.STICKER, version: 1, status: TEMPLATE_STATUS.ACTIVE,
    effectiveFrom: d(-150), effectiveTo: null, clonedFromId: null,
    publishedAt: ts(-150), publishedBy: 'R. Kumar',
    identity: { titleText: 'CARTON MARKING', showLogo: false },
    headerFields: [], addressBlocks: [], columns: [], sheets: [], invoiceLineGrain: null,
    stickerLayout: {
      layoutId: 'VGT',
      paperDefault: PAPER.A4_2X2,
      faces: [
        {
          key: 'MAIN', title: null, render: FACE_RENDER.TEXT_BLOCK,
          border: { style: 'none' },
          lines: [
            { key: 'article', label: 'ARTICLE NUMBER', binding: 'carton.styleNo' },
            { key: 'colour', label: 'COLOUR', binding: 'carton.colorName' },
            { key: 'qty', label: 'QUANTITY', binding: 'carton.pieces' },
            { key: 'ctn', label: 'CARTON NUMBER', binding: 'carton.nOfN' },
            { key: 'nw', label: 'NET WEIGHT', binding: 'carton.netWeightKg', suffix: ' KG', decimals: 3 },
            { key: 'gw', label: 'GROSS WEIGHT', binding: 'carton.grossWeightKg', suffix: ' KG', decimals: 3 },
            { key: 'meas', label: 'MEASUREMENT', binding: 'carton.dimensions', suffix: ' CM' },
            { key: 'origin', label: 'MADE IN', binding: 'fixed:INDIA' },
            { key: 'order', label: 'ORDER', binding: 'carton.buyerPoNo' },
          ],
          sizeGrid: null, barcode: null,
        },
      ],
      mandatoryFields: ['carton.netWeightKg', 'carton.grossWeightKg', 'carton.dimensions'],
    },
    formatting: { font: 'Courier New' }, printWeights: true, printDimensions: true,
    mandatoryForSubmit: [], mandatoryForDocGen: [],
  },
];


// ─── Shipments ──────────────────────────────────────────────────────────────────
// A minimal entity invented by this module: no shipment record exists anywhere in
// the ERP, yet V-01 is shipment-scoped and the invoice header needs ports/vessel.
//
// The consignee is the buyer and the notify party its bank or a shipping location,
// stored as the { name, block } snapshots a saved shipment carries. A seed cannot
// know the real buyer master's location ids, so `notifyParty` is left empty: the
// user picks it on the first edit, which rebuilds both blocks from the master.

const buildShipments = () => [
  {
    id: 1,
    shipmentNo: docNo(EXPDOC_PREFIX.SHIPMENT, 1001, FY),
    status: 'OPEN',
    buyerCode: 'JOMO',
    buyerName: 'JOMO BV',
    mode: 'SEA',
    incoterm: 'FOB',
    preCarriageBy: 'ROAD',
    placeOfReceipt: 'Tiruppur',
    vesselFlightNo: 'MAERSK CHENNAI V.214W',
    portOfLoading: 'Chennai Sea',
    portOfDischarge: 'Rotterdam',
    finalDestination: 'Valkenswaard, Netherlands',
    countryOfFinalDestination: 'Netherlands',
    containerNos: ['MSKU7712345'],
    blAwbNo: null,
    blAwbDate: null,
    etd: d(12),
    eta: d(38),
    forwarder: 'Kuehne + Nagel',
    notifyParty: null,
    consigneeLocationId: null,
    consignee: { name: 'JOMO BV', locationId: null, block: 'JOMO BV\nHandelsweg 24\nValkenswaard\n5555 XT Netherlands' },
    notify: { name: 'ABN AMRO Bank N.V.', block: 'ABN AMRO Bank N.V.\nSWIFT: ABNANL2A' },
    orders: [{ orderId: null, orderNo: orderNo(1042), styleNo: 'ST-2026-0441' }],
    version: 0,
    createdAt: ts(-6),
    createdBy: 'Priya S.',
  },
  {
    id: 2,
    shipmentNo: docNo(EXPDOC_PREFIX.SHIPMENT, 1002, FY),
    status: 'OPEN',
    buyerCode: 'VGT',
    buyerName: 'Van Gennip Textiles BV',
    mode: 'SEA',
    incoterm: 'CIF',
    preCarriageBy: 'ROAD',
    placeOfReceipt: 'Tiruppur',
    vesselFlightNo: 'CMA CGM LOIRE V.0PA3RE1MA',
    portOfLoading: 'Tuticorin Sea',
    portOfDischarge: 'Antwerp',
    finalDestination: 'Uden, Netherlands',
    countryOfFinalDestination: 'Netherlands',
    containerNos: ['CMAU4451209', 'CMAU4451210'],
    blAwbNo: null,
    blAwbDate: null,
    etd: d(25),
    eta: d(52),
    forwarder: 'DSV Air & Sea',
    // Notify = a shipping location, so its address is the consignee's too.
    notifyParty: null,
    consigneeLocationId: null,
    consignee: { name: 'Van Gennip Textiles BV', locationId: null, block: 'Van Gennip Textiles BV\nNijverheidsweg 12\nUden\n5405 NL Netherlands' },
    notify: { name: 'Uden DC', block: 'Uden DC\nNijverheidsweg 12\nUden\n5405 NL Netherlands' },
    orders: [{ orderId: null, orderNo: orderNo(1055), styleNo: 'ST-2026-0512' }],
    version: 0,
    createdAt: ts(-3),
    createdBy: 'Priya S.',
  },
  {
    // D/A terms — the bank is the notify party; the buyer stays the consignee.
    id: 3,
    shipmentNo: docNo(EXPDOC_PREFIX.SHIPMENT, 1003, FY),
    status: 'OPEN',
    buyerCode: 'PRENATAL',
    buyerName: 'Prénatal Moeder en Kind BV',
    mode: 'SEA',
    incoterm: 'FOB',
    preCarriageBy: 'ROAD',
    placeOfReceipt: 'Tiruppur',
    vesselFlightNo: 'HAPAG EXPRESS V.118E',
    portOfLoading: 'Chennai Sea',
    portOfDischarge: 'Rotterdam',
    finalDestination: 'Amersfoort, Netherlands',
    countryOfFinalDestination: 'Netherlands',
    containerNos: [],
    blAwbNo: null,
    blAwbDate: null,
    etd: d(40),
    eta: d(66),
    forwarder: null,
    notifyParty: null,
    consigneeLocationId: null,
    consignee: { name: 'Prénatal Moeder en Kind BV', locationId: null, block: 'Prénatal Moeder en Kind BV\nSterrenbergweg 6\nAmersfoort\n3821 AT Netherlands' },
    notify: { name: 'Deutsche Bank AG', block: 'Deutsche Bank AG\nSWIFT: DEUTDEFF' },
    orders: [{ orderId: null, orderNo: orderNo(1061), styleNo: 'ST-2026-0588' }],
    version: 0,
    createdAt: ts(-1),
    createdBy: 'Priya S.',
  },
];

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
    shipmentId: 1,
    orderNo: orderNo(1042),
    buyerCode: 'JOMO',
    buyerName: 'JOMO BV',
    styleNo: 'ST-2026-0441',
    garmentName: "Men's Slim Fit Polo",
    // Drives the HS-code default. No such field exists on the real style master —
    // see the data-gap ledger; the API phase owes stl_styles.hs_code.
    garmentCategory: 'Knit',
    compositionText: '95% COTTON 5% ELASTANE',
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
        sizeQty: { M: 10, L: 20, XL: 30 },
        netWeightKg: 12.48, grossWeightKg: 13.5, lengthCm: 60, breadthCm: 40, heightCm: 35,
      }),
      g({
        packingType: PACKING_TYPE.RATIO, cartonFrom: 48, cartonTo: 57,
        danNo: 'DAN-4472', buyerPoNo: 'PO-884213',
        destination: 'Rotterdam', styleNo: 'ST-2026-0441', colorName: 'Flame Scarlet 18-1662 TCX',
        articleNos: { M: 'ART-99130', L: 'ART-99131', XL: 'ART-99132', XXL: 'ART-99133' },
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
    shipmentId: 2,
    orderNo: orderNo(1055),
    buyerCode: 'VGT',
    buyerName: 'Van Gennip Textiles BV',
    styleNo: 'ST-2026-0512',
    garmentName: "Girls' Printed Tee",
    garmentCategory: 'Knit',
    compositionText: '100% ORGANIC COTTON',
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
    shipmentId: 3,
    orderNo: orderNo(1061),
    buyerCode: 'PRENATAL',
    buyerName: 'Prénatal Moeder en Kind BV',
    styleNo: 'ST-2026-0588',
    garmentName: 'Baby 3-pack Bodysuit',
    garmentCategory: 'Baby',
    compositionText: '100% COTTON INTERLOCK',
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
  const shipments = buildShipments();
  const packingEntries = buildPackingEntries();
  const templates = buildTemplates();

  return {
    seedVersion: SEED_VERSION,
    // Explicit mirror of sys_doc_counters (prefix, fy_code): last number used.
    docSeq: {
      [`${EXPDOC_PREFIX.SHIPMENT}/${FY}`]: FIRST_DOC_NUMBER - 1 + shipments.length,
      [`${EXPDOC_PREFIX.PACKING_ENTRY}/${FY}`]: FIRST_DOC_NUMBER - 1 + packingEntries.length,
      [`${EXPDOC_PREFIX.PACKING_LIST}/${FY}`]: FIRST_DOC_NUMBER - 1,
      [`${EXPDOC_PREFIX.INVOICE}/${FY}`]: FIRST_DOC_NUMBER - 1,
      [`${EXPDOC_PREFIX.STICKER_RUN}/${FY}`]: FIRST_DOC_NUMBER - 1,
    },
    shipments,
    packingEntries,
    packingLists: [],
    invoices: [],
    stickerRuns: [],
    templates,
    audit: [],
    masters: {
      ports: SEED_PORTS,
      incoterms: SEED_INCOTERMS,
      hsCodes: SEED_HS_CODES,
      buyerCommercial: SEED_BUYER_COMMERCIAL,
      fxRates: buildFxRates(),
      exporterProfileExtra: SEED_EXPORTER_PROFILE_EXTRA,
      tenantConfig: { ...DEFAULT_TENANT_CONFIG },
    },
  };
};
