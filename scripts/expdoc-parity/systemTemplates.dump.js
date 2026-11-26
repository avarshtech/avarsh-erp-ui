// Parity fixtures for src/utils/expDocSystemTemplates.js -> erp-purchase PlTemplates (README.md), written to
// expDocSystemTemplates.json: the built-in standard layouts, exactly as the browser holds them, so the API's classpath
// copy of the standard packing-list layout (and of the invoice and sticker ones, which the same export holds) can be
// proven identical, and which keys a template snapshot carries as its layout.
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The constants SYSTEM_TEMPLATES (all three standard layouts, keyed by document type) and LAYOUT_KEYS are recorded
// through adapters of their own names that return them (README.md: named adapters). Not recorded (notPorted):
// isSystemTemplateId, because the browser maps a SYSTEM-* id to null before it reaches the API (templateId null is the
// standard layout there); completeLayout, which only the template builder uses to fill a new layout from the standard.
import { test, expect } from 'vitest';
import * as templates from '../../src/utils/expDocSystemTemplates.js';
import { writeFixtures } from './writeFixtures.js';

const { systemTemplateFor, pickLayout } = templates;

const SYSTEM_TEMPLATES = function SYSTEM_TEMPLATES() {
  return templates.SYSTEM_TEMPLATES;
};
const LAYOUT_KEYS = function LAYOUT_KEYS() {
  return templates.LAYOUT_KEYS;
};
const API = { ...templates, SYSTEM_TEMPLATES, LAYOUT_KEYS };
const NOT_PORTED = {
  isSystemTemplateId: 'the browser maps a SYSTEM-* template id to null before it reaches the API',
  completeLayout: 'template authoring only: the builder fills a new layout from the standard one',
};

const EM_DASH = String.fromCharCode(0x2014);

// A buyer template as the screens hold it: the API record with its layout flattened onto it
// (exportTemplateAdapter.fromApi), plus what the AI reader left in extractionMeta
const JOMO_PL = {
  id: 14,
  templateCode: 'JOMO-PL',
  name: `JOMO ${EM_DASH} Packing List`,
  docType: 'PACKING_LIST',
  buyerId: 12,
  buyerName: 'JOMO BV',
  status: 'ACTIVE',
  effectiveFrom: '2026-09-01',
  effectiveTo: null,
  source: 'API',
  version: 2,
  lockVersion: 5,
  buyerCode: null,
  versions: [{ id: 13, version: 1, status: 'RETIRED', publishedAt: '2026-08-20T10:15:00' }, { id: 14, version: 2, status: 'ACTIVE', publishedAt: '2026-09-01T09:00:00' }],
  latestVersion: 2,
  hasNewerVersion: false,
  isSystem: false,
  extractionMeta: { model: 'reader', confidence: 0.91 },
  identity: { titleText: 'PACKING LIST', showLogo: false, paper: 'A4', orientation: 'LANDSCAPE', marginsMm: [8, 8, 8, 8] },
  headerFields: [
    { key: 'plNo', label: 'P/L No.', binding: 'pl.plNo', mandatory: true },
    { key: 'invoiceNo', label: 'Invoice No.', binding: 'invoice.invoiceNo' },
  ],
  addressBlocks: [{ key: 'consignee', label: 'Consignee', binding: 'shipment.consignee.block' }],
  textBlocks: [{ key: 'shippingMarks', placement: 'FOOTER', text: 'JOMO BV / ROTTERDAM / C/NO 1-UP' }],
  columns: [
    { key: 'cartonRange', label: 'CTN NO', binding: 'row.cartonRange', width: 80, align: 'center' },
    { key: '__sizes', label: 'Sizes', binding: 'row.sizeQty', type: 'SIZE_GRID', align: 'right', total: 'SUM' },
  ],
  sizeSet: { source: 'FIXED', fixedSizes: ['M', 'L', 'XL', 'XXL'], hideEmptySizeColumns: false },
  packingTypesAllowed: ['SOLID', 'RATIO'],
  sheets: [{ key: 'MAIN', title: 'PACKING LIST', include: ['MAIN', 'EXTRA'], showSectionTotals: true }],
  invoiceLineGrain: null,
  formatting: { font: 'Calibri', baseFontPt: 9 },
  printWeights: false,
  printDimensions: true,
  mandatoryForSubmit: ['row.cartonFrom', 'row.cartonTo', 'row.buyerPoNo'],
  mandatoryForDocGen: [],
};

const CASES = [
  { id: 'SYSTEM_TEMPLATES/constant', fn: SYSTEM_TEMPLATES, args: [] },
  { id: 'LAYOUT_KEYS/constant', fn: LAYOUT_KEYS, args: [] },
  ...[
    ['packing-list', ['PACKING_LIST']],
    ['invoice', ['INVOICE']],
    ['sticker', ['STICKER']],
    ['unknown-type', ['CERTIFICATE_OF_ORIGIN']],
    ['lower-case-is-unknown', ['packing_list']],
    ['null', [null]],
    ['left-off', []],
  ].map(([id, args]) => ({ id: `systemTemplateFor/${id}`, fn: systemTemplateFor, args })),
  ...[
    ['standard-packing-list', [templates.SYSTEM_TEMPLATES.PACKING_LIST]],
    ['standard-invoice', [templates.SYSTEM_TEMPLATES.INVOICE]],
    ['standard-sticker', [templates.SYSTEM_TEMPLATES.STICKER]],
    ['buyer-template-as-the-screens-hold-it', [JOMO_PL]],
    ['null-values-kept', [{ id: 15, name: 'Bare', columns: null, sheets: null, printWeights: false }]],
    ['layout-keys-only', [{ id: 16, templateCode: 'X', docType: 'INVOICE', charges: { freight: { enabled: false } }, igst: { enabled: true } }]],
    ['empty', [{}]],
    ['left-off', []],
  ].map(([id, args]) => ({ id: `pickLayout/${id}`, fn: pickLayout, args })),
  { id: 'pickLayout/throws/null-template', fn: pickLayout, args: [null], throws: true },
];

test('expDocSystemTemplates parity fixtures', () => {
  const { count } = writeFixtures('expDocSystemTemplates', CASES, { api: API, notPorted: NOT_PORTED });
  expect(count).toBe(CASES.length);
});
