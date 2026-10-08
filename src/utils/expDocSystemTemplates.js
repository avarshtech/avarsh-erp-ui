/**
 * Export Documentation — the built-in standard layouts.
 *
 * What a packing list, invoice or carton sticker prints when its buyer has no template
 * of its own (PRD §15: offer the standard template rather than fail), and the starting
 * point for a new template. These are product defaults that ship with the renderer, not
 * demo data — they change in the same commit as the renderer that draws them.
 *
 * Buyer templates of every document type live in the API (/export-docs/templates).
 */
import {
  DOC_TYPE, TEMPLATE_STATUS, LINE_GRAIN, PACKING_TYPE, SECTION_KEY, PAPER, FACE_RENDER, STICKER_LINE_KIND,
} from './expDocConstants';

/** Where a template row came from: the API, or a built-in standard layout. */
export const TEMPLATE_SOURCE = { API: 'API', SYSTEM: 'SYSTEM' };

export const SYSTEM_TEMPLATE_ID = {
  [DOC_TYPE.PACKING_LIST]: 'SYSTEM-PACKING_LIST',
  [DOC_TYPE.INVOICE]: 'SYSTEM-INVOICE',
  [DOC_TYPE.STICKER]: 'SYSTEM-STICKER',
};

export const isSystemTemplateId = (id) => String(id ?? '').startsWith('SYSTEM-');

/**
 * Every key a template's layout may carry — what is saved as `layout` in the API and
 * what the renderer, validator and builder read. One list, so a key the builder edits
 * can never be silently dropped on save.
 */
export const LAYOUT_KEYS = [
  'identity', 'headerFields', 'addressBlocks', 'textBlocks', 'columns', 'sizeSet',
  'packingTypesAllowed', 'sheets', 'invoiceHeader', 'invoiceColumns', 'invoiceLineGrain',
  'charges', 'igst', 'bankBlock', 'ediAccounts', 'declarations', 'annexeSheets', 'series',
  'stickerLayout', 'formatting', 'printWeights', 'printDimensions', 'mandatoryForSubmit', 'mandatoryForDocGen',
];

export const STANDARD_PL_COLUMNS = [
  { key: 'cartonRange', label: 'Carton No.', binding: 'row.cartonRange', width: 92, align: 'center' },
  { key: 'cartons', label: 'No. of Ctns', binding: 'row.cartonCount', width: 84, align: 'right', total: 'SUM' },
  { key: 'buyerPoNo', label: 'PO No.', binding: 'row.buyerPoNo', width: 120 },
  { key: 'styleNo', label: 'Style', binding: 'row.styleNo', width: 120 },
  { key: 'colour', label: 'Colour', binding: 'row.colorName', width: 140 },
  { key: '__sizes', label: 'Sizes', binding: 'row.sizeQty', type: 'SIZE_GRID', align: 'right', total: 'SUM' },
  { key: 'pcsPerCarton', label: 'Pcs / Ctn', binding: 'calc.piecesPerCarton', width: 84, align: 'right' },
  { key: 'totalPieces', label: 'Total Pcs', binding: 'calc.totalPieces', width: 92, align: 'right', total: 'SUM' },
  { key: 'netWeightKg', label: 'N.W. (kg)', binding: 'row.netWeightKg', width: 92, align: 'right', decimals: 3, total: 'SUM_EXPANDED' },
  { key: 'grossWeightKg', label: 'G.W. (kg)', binding: 'row.grossWeightKg', width: 92, align: 'right', decimals: 3, total: 'SUM_EXPANDED' },
  { key: 'dims', label: 'L × B × H (cm)', binding: 'calc.dimensions', width: 128, align: 'center' },
  { key: 'cbm', label: 'CBM', binding: 'calc.cbm', width: 84, align: 'right', decimals: 3, total: 'SUM_EXPANDED' },
];

export const STANDARD_PL_HEADER_FIELDS = [
  { key: 'plNo', label: 'Packing List No.', binding: 'pl.plNo', mandatory: true },
  { key: 'plDate', label: 'Date', binding: 'pl.plDate', mandatory: true, format: 'DD-MMM-YYYY' },
  { key: 'shipmentNo', label: 'Shipment', binding: 'shipment.shipmentNo' },
  { key: 'etd', label: 'ETD', binding: 'shipment.etd', format: 'DD-MMM-YYYY' },
  { key: 'portOfLoading', label: 'Port of Loading', binding: 'shipment.portOfLoading' },
  { key: 'portOfDischarge', label: 'Port of Discharge', binding: 'shipment.portOfDischarge' },
  // Bound to the document's resolved value, not the shipment's raw one: a packing
  // list may override its container and seal (§12.1), and the resolved path falls
  // back to the shipment when it has not.
  { key: 'containerNos', label: 'Container No.', binding: 'pl.resolved.containerNo' },
  { key: 'sealNo', label: 'Seal No.', binding: 'pl.resolved.sealNo' },
  { key: 'marksAndNos', label: 'Marks & Nos.', binding: 'pl.marksAndNos' },
  { key: 'descriptionOfGoods', label: 'Description of Goods', binding: 'pl.descriptionOfGoods' },
];

const STANDARD_DECLARATIONS = [
  { order: 1, code: 'IGST', text: 'SUPPLY MEANT FOR EXPORT WITH PAYMENT OF IGST' },
  { order: 2, code: 'ORIGIN', text: 'We declare that the goods are wholly obtained / produced in India.' },
  { order: 3, code: 'TRUE_VALUE', text: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.' },
];

const SYSTEM_ROW = {
  source: TEMPLATE_SOURCE.SYSTEM,
  isSystem: true,
  buyerId: null,
  buyerName: null,
  buyerCode: null,
  version: 1,
  status: TEMPLATE_STATUS.ACTIVE,
  effectiveFrom: null,
  effectiveTo: null,
};

/** One line of the standard carton marking: a printed label and the field it shows. */
const markLine = (key, label, binding, format = {}) => ({ key, kind: STICKER_LINE_KIND.FIELD, label, binding, ...format });

export const SYSTEM_TEMPLATES = {
  [DOC_TYPE.PACKING_LIST]: {
    ...SYSTEM_ROW,
    id: SYSTEM_TEMPLATE_ID[DOC_TYPE.PACKING_LIST],
    templateCode: 'STD-PL',
    name: 'Standard Indian Export — Packing List',
    docType: DOC_TYPE.PACKING_LIST,
    identity: { titleText: 'PACKING LIST', showLogo: true, paper: 'A4', orientation: 'LANDSCAPE', marginsMm: [10, 10, 10, 10] },
    headerFields: STANDARD_PL_HEADER_FIELDS,
    addressBlocks: [
      { key: 'exporter', label: 'Exporter', binding: 'exporter.block' },
      { key: 'consignee', label: 'Consignee', binding: 'shipment.consignee.block' },
    ],
    textBlocks: [],
    sizeSet: { source: 'ORDER_PRESET', fixedSizes: null, hideEmptySizeColumns: true },
    packingTypesAllowed: Object.values(PACKING_TYPE),
    columns: STANDARD_PL_COLUMNS,
    sheets: [
      { key: 'MAIN', title: 'PACKING LIST', include: [SECTION_KEY.MAIN], showSectionTotals: true },
      { key: 'EXTRA', title: 'EXTRA CARTONS', include: [SECTION_KEY.EXTRA], showSectionTotals: true, joinGrandTotal: true },
      { key: 'SUMMARY', title: 'SUMMARY', type: 'SUMMARY', blocks: ['GRAND_TOTAL', 'WEIGHT_PER_PIECE', 'ORDER_VS_SHIPPED'] },
    ],
    invoiceLineGrain: null,
    formatting: {
      font: 'Arial', baseFontPt: 8.5, headerFontPt: 9, titleFontPt: 13, border: 'ALL',
      weightDecimals: 3, cbmDecimals: 3, weightPerPieceDecimals: 5, dateFormat: 'DD-MMM-YYYY',
    },
    // These two drive V-08: a template that does not print weights must not block on them.
    printWeights: true,
    printDimensions: true,
    mandatoryForSubmit: ['row.cartonFrom', 'row.cartonTo'],
    mandatoryForDocGen: ['row.netWeightKg', 'row.grossWeightKg', 'row.lengthCm', 'row.breadthCm', 'row.heightCm'],
  },
  [DOC_TYPE.INVOICE]: {
    ...SYSTEM_ROW,
    id: SYSTEM_TEMPLATE_ID[DOC_TYPE.INVOICE],
    templateCode: 'STD-INVOICE',
    name: 'Standard Indian Export — Commercial Invoice',
    docType: DOC_TYPE.INVOICE,
    identity: { titleText: 'COMMERCIAL INVOICE', showLogo: true, paper: 'A4', orientation: 'PORTRAIT' },
    headerFields: [],
    addressBlocks: [
      { key: 'exporter', label: 'Exporter', binding: 'exporter.block' },
      { key: 'consignee', label: 'Consignee', binding: 'invoice.consignee.block' },
      { key: 'notify', label: 'Notify Party', binding: 'invoice.notify.block' },
    ],
    textBlocks: [],
    columns: [],
    sheets: [],
    invoiceColumns: null,
    invoiceLineGrain: {
      mode: LINE_GRAIN.PER_STYLE_SIZE_RANGE,
      // Group by what an atom carries. The size RANGE is derived from the group's
      // members, so it can never be a grouping key.
      groupBy: ['styleNo', 'colourKey'],
      descriptionTemplate: '{{style.garmentName}} — {{row.styleNo}} — {{row.colorName}}',
      rateSource: 'ORDER_SIZE_PRICE',
      hsCodeSource: 'HS_MASTER_CATEGORY',
      showPackagingAttributes: false,
      materialRows: null,
    },
    charges: {
      discount: { enabled: true, mode: 'PERCENT', default: 0 },
      freight: { enabled: true, default: 0 },
      insurance: { enabled: true, default: 0 },
      other: { enabled: true, default: 0 },
    },
    igst: { enabled: true, defaultRatePct: 12 },
    bankBlock: true,
    ediAccounts: false,
    declarations: STANDARD_DECLARATIONS,
    annexeSheets: [],
    formatting: { font: 'Arial', baseFontPt: 9, dateFormat: 'DD-MMM-YYYY' },
    printWeights: true,
    printDimensions: true,
    mandatoryForSubmit: ['invoice.consignee', 'invoice.incoterm', 'invoice.paymentTerms'],
    mandatoryForDocGen: [],
  },
  [DOC_TYPE.STICKER]: {
    ...SYSTEM_ROW,
    id: SYSTEM_TEMPLATE_ID[DOC_TYPE.STICKER],
    templateCode: 'STD-STICKER',
    name: 'Standard export carton marking',
    docType: DOC_TYPE.STICKER,
    // A carton mark carries no exporter letterhead, so no logo.
    identity: { titleText: 'CARTON STICKER', showLogo: false },
    stickerLayout: {
      paperDefault: PAPER.A4_2UP,
      faces: [
        {
          key: 'MAIN', title: 'MAIN MARK', render: FACE_RENDER.LINES, border: true, caption: null, symbol: null, logo: false,
          lines: [
            markLine('buyer', null, 'buyer.name', { bold: true, fontPt: 16, align: 'CENTER' }),
            markLine('po', 'PO NO', 'carton.buyerPoNo'),
            markLine('style', 'STYLE NO', 'carton.styleNo'),
            markLine('colour', 'COLOUR', 'carton.colorName'),
            markLine('sizes', 'SIZE', 'carton.sizes', { join: ' / ' }),
            markLine('quantity', 'QUANTITY', 'carton.pieces', { suffix: ' PCS' }),
            markLine('cartonNo', 'CARTON NO', 'carton.cartonNo', { pattern: '{n} OF {N}' }),
            markLine('port', 'PORT OF DESTINATION', 'carton.destination'),
            markLine('madeIn', 'MADE IN', 'exporter.country'),
          ],
        },
        {
          key: 'SIDE', title: 'SIDE MARK', render: FACE_RENDER.LINES, border: true, caption: null, symbol: null, logo: false,
          lines: [
            markLine('netWeight', 'NET WEIGHT', 'carton.netWeightKg', { decimals: 3, suffix: ' KGS' }),
            markLine('grossWeight', 'GROSS WEIGHT', 'carton.grossWeightKg', { decimals: 3, suffix: ' KGS' }),
            markLine('measurement', 'MEASUREMENT', 'carton.dimensions', { pattern: '{L} X {B} X {H} CMS' }),
          ],
        },
      ],
      // V-08 at print time: a carton missing one of these is named and not printed.
      mandatoryFields: ['carton.netWeightKg', 'carton.grossWeightKg', 'carton.dimensions'],
    },
    formatting: { font: 'Arial' },
    printWeights: true,
    printDimensions: true,
    mandatoryForSubmit: [],
    mandatoryForDocGen: [],
  },
};

export const systemTemplateFor = (docType) => SYSTEM_TEMPLATES[docType] || null;

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/**
 * A layout with every key the renderer and validator read.
 *
 * What the AI reader returns (or an older template carries) is kept as it is; only
 * what is MISSING is taken from the standard layout. Objects merge one level deep so
 * a document's own discount or font survives next to the standard's other settings.
 * A line grain from a different mode drops the standard's grouping and description,
 * because those belong to the standard's mode.
 */
export const completeLayout = (docType, layout = {}) => {
  const base = systemTemplateFor(docType);
  if (!base) return clone(layout);
  const out = clone(layout) || {};
  LAYOUT_KEYS.forEach((key) => {
    if (out[key] === undefined && base[key] !== undefined) out[key] = clone(base[key]);
  });
  ['identity', 'formatting', 'charges', 'igst'].forEach((key) => {
    if (layout?.[key] && base[key]) out[key] = { ...clone(base[key]), ...clone(layout[key]) };
  });
  const grain = layout?.invoiceLineGrain;
  if (grain && base.invoiceLineGrain) {
    const sameMode = !grain.mode || grain.mode === base.invoiceLineGrain.mode;
    const { groupBy, descriptionTemplate, ...shared } = base.invoiceLineGrain;
    out.invoiceLineGrain = { ...shared, ...(sameMode ? { groupBy, descriptionTemplate } : {}), ...clone(grain) };
  }
  return out;
};

/** Only the layout part of a template row, in LAYOUT_KEYS order. */
export const pickLayout = (template = {}) => LAYOUT_KEYS.reduce((acc, key) => {
  if (template[key] !== undefined) acc[key] = clone(template[key]);
  return acc;
}, {});
