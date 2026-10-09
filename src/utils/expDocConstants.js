/**
 * Export Documentation — statuses, transitions, enums and labels.
 *
 * Mirrors the shape of sampleRequestConstants.js: a declarative {from: [allowed to]}
 * transition table, SCREAMING_SNAKE status values, and a label map so the UI never
 * shows a raw enum. Colour and icon config lives in statusConfig.js alongside every
 * other module's; only the vocabulary lives here.
 */

// ─── RBAC module ids ────────────────────────────────────────────────────────────
// One key per URL-addressable screen. Kept here so screens never stringly-type them.
export const EXPDOC_MODULE = {
  SHIPMENTS: 'export-shipments',
  PACKING_LIST: 'export-packing-list',
  INVOICE: 'export-invoice',
  STICKERS: 'export-stickers',
  TEMPLATES: 'export-templates',
};

// ─── Document types ─────────────────────────────────────────────────────────────
export const DOC_TYPE = {
  PACKING_LIST: 'PACKING_LIST',
  INVOICE: 'INVOICE',
  STICKER: 'STICKER',
};

export const DOC_TYPE_LABELS = {
  PACKING_LIST: 'Packing List',
  INVOICE: 'Export Invoice',
  STICKER: 'Carton Sticker',
};

// ─── Packing structures (PRD §7.2) ──────────────────────────────────────────────
export const PACKING_TYPE = {
  SOLID: 'SOLID',
  RATIO: 'RATIO',
  MPB: 'MPB',
  MIXED: 'MIXED',
  EXTRA: 'EXTRA',
};

export const PACKING_TYPE_LABELS = {
  SOLID: 'Solid size',
  RATIO: 'Ratio / assortment',
  MPB: 'Master polybag',
  MIXED: 'Mixed carton',
  EXTRA: 'Extra carton',
};

export const PACKING_TYPE_HINTS = {
  SOLID: 'One size and colour per carton; quantity entered per size.',
  RATIO: 'Size ratio per assortment; pieces per carton = sum(ratio) × assortments per carton.',
  MPB: 'Pre-bagged ratio pack; pieces per carton = pcs per MPB × MPB per carton.',
  MIXED: 'Several colours in one carton; one quantity row per colour.',
  EXTRA: 'Leftover carton with odd quantities; its own section, but joins the grand total.',
};

export const PACKING_TYPE_LIST = Object.values(PACKING_TYPE).map((code) => ({
  value: code,
  label: PACKING_TYPE_LABELS[code],
  hint: PACKING_TYPE_HINTS[code],
}));

// Section a carton group belongs to. EXTRA renders as its own section but still
// joins the grand total (PRD §7.2 / §24.4).
export const SECTION_KEY = { MAIN: 'MAIN', EXTRA: 'EXTRA' };

export const SECTION_TITLES = { MAIN: 'Packing List', EXTRA: 'Extra Cartons' };

// ─── Packing entry lifecycle ────────────────────────────────────────────────────
export const PACKING_ENTRY_STATUS = { OPEN: 'OPEN', COMPLETED: 'COMPLETED' };

export const PACKING_ENTRY_STATUS_LABELS = { OPEN: 'Open', COMPLETED: 'Completed' };

export const PACKING_ENTRY_TRANSITIONS = {
  OPEN: ['COMPLETED'],
  COMPLETED: ['OPEN'],
};

export const isPackingEntryEditable = (status) => status === PACKING_ENTRY_STATUS.OPEN;

// ─── Packing list lifecycle (PRD §16) ───────────────────────────────────────────
// Revise does NOT transition in place: it creates a new DRAFT row and moves the old
// one to SUPERSEDED, so buyers keep referencing one plNo across revisions (PRD §17).
// There is no approval step: the person who builds the document finalises it.
// FINAL is the freeze — it snapshots data and template version, which is what
// stickers, invoices and reports bind to (BR-08). It is a state, not a verdict.
export const PL_STATUS = {
  DRAFT: 'DRAFT',
  FINAL: 'FINAL',
  EXPORTED: 'EXPORTED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
};

export const PL_STATUS_LABELS = {
  DRAFT: 'Draft',
  FINAL: 'Final',
  EXPORTED: 'Released',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

export const PL_TRANSITIONS = {
  DRAFT: ['FINAL'],
  FINAL: ['EXPORTED', 'CANCELLED', 'SUPERSEDED'], // to change it, Revise creates a new draft
  EXPORTED: ['CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: [],
};

export const isPlEditable = (status) => status === PL_STATUS.DRAFT;
export const isPlDeletable = (status) => status === PL_STATUS.DRAFT;
export const isPlFinal = (status) =>
  status === PL_STATUS.FINAL || status === PL_STATUS.EXPORTED;

// ─── Export invoice lifecycle ───────────────────────────────────────────────────
// Same shape as the packing list, and for the same reason: no approver, one
// finalise by the author. The invoice number is allocated at FINAL.
export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  FINAL: 'FINAL',
  EXPORTED: 'EXPORTED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
};

export const INVOICE_STATUS_LABELS = {
  DRAFT: 'Draft',
  FINAL: 'Final',
  EXPORTED: 'Released',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

export const INVOICE_TRANSITIONS = {
  DRAFT: ['FINAL'],
  FINAL: ['EXPORTED', 'CANCELLED', 'SUPERSEDED'],
  EXPORTED: ['CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: [],
};

export const isInvoiceEditable = (status) => status === INVOICE_STATUS.DRAFT;

// ─── Shipment (API /export-docs/shipments) ──────────────────────────────────────
// OPEN until every live packing list and invoice on it is released, then CLOSED and
// read-only until one of them is cancelled or revised. Nobody presses Close: the
// documents decide (services/expdoc/expDocShipmentBridge.js).
export const SHIPMENT_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

export const SHIPMENT_STATUS_LABELS = { OPEN: 'Open', CLOSED: 'Closed' };

/** Incoterms 2020, the only values the API accepts. */
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

// ─── Invoice line grain (PRD §8.3) ──────────────────────────────────────────────
export const LINE_GRAIN = {
  PER_STYLE_SIZE_RANGE: 'PER_STYLE_SIZE_RANGE',
  PER_SIZE: 'PER_SIZE',
  PER_PO_STYLE: 'PER_PO_STYLE',
  PER_ORDER_LINE: 'PER_ORDER_LINE',
  MATERIAL_ROWS: 'MATERIAL_ROWS',
};

export const LINE_GRAIN_LABELS = {
  PER_STYLE_SIZE_RANGE: 'Per style / size range',
  PER_SIZE: 'Per size',
  PER_PO_STYLE: 'Per PO / style',
  PER_ORDER_LINE: 'Per order line (with packaging)',
  MATERIAL_ROWS: 'Simple material rows',
};

// ─── Invoice header boxes (the standard Indian export invoice grid) ────────────
// A buyer template may relabel, rebind or hide any of them (`invoiceHeader.boxes`);
// the keys are shared with the renderer and the API's reader of uploaded invoices.
export const INVOICE_BOXES = [
  { key: 'exporter', label: 'Exporter', content: "The exporter's address block" },
  { key: 'invoiceNoDate', label: 'Invoice No. & Date', content: 'Invoice number and date' },
  { key: 'exporterRef', label: "Exporter's Ref. (IEC No.)", content: 'IEC number' },
  { key: 'consignee', label: 'Consignee', content: "The invoice's consignee" },
  { key: 'buyerOrder', label: "Buyer's Order No. & Date", content: 'Order numbers and date' },
  { key: 'buyerOther', label: 'Buyer (if other than Consignee)', content: 'SAME AS CONSIGNEE, or the buyer when it differs' },
  { key: 'otherRefs', label: 'Other References', content: 'AD code, GST state, PAN, LUT, AEPC, REX, star house' },
  { key: 'notify', label: 'Notify Party', content: "The invoice's notify party" },
  { key: 'preCarriage', label: 'Pre-Carriage by', content: 'Shipment pre-carriage' },
  { key: 'placeOfReceipt', label: 'Place of Receipt by Pre-Carrier', content: 'Shipment place of receipt' },
  { key: 'countryOfOrigin', label: 'Country of Origin of Goods', content: 'INDIA' },
  { key: 'countryOfDestination', label: 'Country of Final Destination', content: 'Destination country' },
  { key: 'vessel', label: 'Vessel / Flight No.', content: 'Shipment vessel / flight' },
  { key: 'portOfLoading', label: 'Port of Loading', content: 'Shipment port of loading' },
  { key: 'terms', label: 'Terms of Delivery & Payment', content: 'Incoterm and payment terms' },
  { key: 'portOfDischarge', label: 'Port of Discharge', content: 'Shipment port of discharge' },
  { key: 'finalDestination', label: 'Final Destination', content: 'Shipment final destination' },
  // The key keeps its old name: the API's invoice reader and saved templates use it.
  { key: 'containerSeal', label: 'Container No(s).', content: 'Container numbers' },
];

// ─── Template layout vocabulary (sheets, text blocks) ───────────────────────────
export const SUMMARY_BLOCK_LABELS = {
  GRAND_TOTAL: 'Grand total (cartons, pieces, weights, CBM)',
  WEIGHT_PER_PIECE: 'Weight per piece',
  ORDER_VS_SHIPPED: 'Order vs shipped, per colour and size',
  TOTALS_LIST: 'Totals list (TOTAL QTY / CARTONS / NETT WT / GR WT / CBM / DIMENSION)',
};

export const TEXT_PLACEMENT_LABELS = {
  HEADER: 'Under the title',
  BEFORE_TABLE: 'Before the table',
  AFTER_TABLE: 'After the table',
  FOOTER: 'At the foot',
};

/** Fields a packing-list sheet may repeat a block heading and subtotal for. */
export const BLOCK_FIELD_LABELS = {
  buyerPoNo: 'PO / order number',
  styleNo: 'Style',
  colorName: 'Colour',
  packingCode: 'Packing code',
  destination: 'Destination',
};

// ─── Printed document fonts (template formatting) ───────────────────────────────
/**
 * The fonts a template can print in, by kind. A document prints on the computer that
 * opens it, so these are fonts Windows, macOS or Microsoft Office install — buyers'
 * own spreadsheets use the same ones. Each carries a full CSS stack, so a computer
 * without the font prints the nearest one of the same kind (a serif stays a serif)
 * instead of the browser default.
 */
export const DOC_FONT_GROUPS = [
  {
    label: 'Sans-serif',
    fonts: [
      { name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
      { name: 'Arial Narrow', stack: "'Arial Narrow', 'Liberation Sans Narrow', Arial, sans-serif" },
      { name: 'Calibri', stack: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
      { name: 'Aptos', stack: "Aptos, Calibri, 'Segoe UI', Arial, sans-serif" },
      { name: 'Segoe UI', stack: "'Segoe UI', Tahoma, Arial, sans-serif" },
      { name: 'Tahoma', stack: 'Tahoma, Verdana, Arial, sans-serif' },
      { name: 'Verdana', stack: 'Verdana, Tahoma, Arial, sans-serif' },
      { name: 'Trebuchet MS', stack: "'Trebuchet MS', 'Lucida Grande', Arial, sans-serif" },
      { name: 'Century Gothic', stack: "'Century Gothic', 'Avant Garde', Arial, sans-serif" },
      { name: 'Gill Sans MT', stack: "'Gill Sans MT', 'Gill Sans', Calibri, Arial, sans-serif" },
      { name: 'Franklin Gothic Medium', stack: "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif" },
      { name: 'Helvetica', stack: 'Helvetica, Arial, sans-serif' },
    ],
  },
  {
    label: 'Serif',
    fonts: [
      { name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
      { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
      { name: 'Cambria', stack: "Cambria, Caladea, Georgia, serif" },
      { name: 'Garamond', stack: "Garamond, 'EB Garamond', Georgia, serif" },
      { name: 'Book Antiqua', stack: "'Book Antiqua', Palatino, 'Palatino Linotype', serif" },
      { name: 'Palatino Linotype', stack: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
      { name: 'Bookman Old Style', stack: "'Bookman Old Style', Bookman, Georgia, serif" },
    ],
  },
  {
    label: 'Typewriter (fixed width)',
    fonts: [
      { name: 'Courier New', stack: "'Courier New', Courier, monospace" },
      { name: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
      { name: 'Lucida Console', stack: "'Lucida Console', Monaco, monospace" },
    ],
  },
];

const DOC_FONT_STACKS = Object.fromEntries(DOC_FONT_GROUPS.flatMap((g) => g.fonts).map((f) => [f.name, f.stack]));

/** The CSS stack for a font name from the list above, or null for any other name. */
export const docFontStack = (name) => DOC_FONT_STACKS[name] || null;

// ─── Printed text sizes (template formatting) ───────────────────────────────────
/** The main text size — table rows and plain text — when a template sets none, in pt. */
export const MAIN_TEXT_PT = { PACKING_LIST: 8.5, INVOICE: 10 };

/** Nothing prints smaller than this, whatever the template asks for: below it text blurs on paper. */
export const MIN_TEXT_PT = 6.5;

/**
 * The other kinds of text a printed packing list or invoice has. Each prints at the
 * size the template sets for it, or else at its share of the main text — so changing
 * the main size scales the whole page, and any one kind can still be set on its own.
 * `legacy` is the older formatting key an existing template may already carry.
 */
export const TEXT_ROLES = [
  { key: 'title', label: 'Document title', ratio: 1.45, legacy: 'titleFontPt' },
  { key: 'company', label: 'Company name', ratio: 1.25 },
  { key: 'section', label: 'Section titles and totals', ratio: 1.1, docTypes: ['PACKING_LIST'] },
  { key: 'heading', label: 'Table headings', ratio: 0.95 },
  { key: 'value', label: 'Values in the header boxes', ratio: 1.05, legacy: 'headerFontPt' },
  { key: 'label', label: 'Small labels above values', ratio: 0.85 },
  { key: 'note', label: 'Notes, declarations and small print', ratio: 0.9 },
];

const halfPt = (n) => Math.round(n * 2) / 2;

/** The main text size of a template, in pt. */
export const mainTextPt = (formatting, docType) => Number(formatting?.baseFontPt) || MAIN_TEXT_PT[docType] || 9;

/** The size one kind of text prints at, in pt: the template's own, else its share of the main text. */
export const textSizePt = (formatting, role, docType) => {
  const own = Number(formatting?.textSizes?.[role.key]);
  const legacy = role.legacy ? Number(formatting?.[role.legacy]) : 0;
  const set = own > 0 ? own : legacy;
  return Math.max(MIN_TEXT_PT, set > 0 ? set : halfPt(mainTextPt(formatting, docType) * role.ratio));
};

// ─── Template lifecycle (PRD §10) ───────────────────────────────────────────────
export const TEMPLATE_STATUS = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', RETIRED: 'RETIRED' };

export const TEMPLATE_STATUS_LABELS = { DRAFT: 'Draft', ACTIVE: 'Active', RETIRED: 'Retired' };

// ─── Sticker paper / label sheets (PRD §9.3, §18) ───────────────────────────────
// pageMm is the @page size; cols × rows is the label grid printed on it.
export const PAPER = {
  A4_1UP: 'A4_1UP',
  A4_1UP_LANDSCAPE: 'A4_1UP_LANDSCAPE',
  A4_2UP: 'A4_2UP',
  A4_2X2: 'A4_2X2',
  A5: 'A5',
  THERMAL_4X6: 'THERMAL_4X6',
};

export const PAPER_SPECS = {
  A4_1UP: { label: 'A4 — 1 per page', pageMm: [210, 297], cols: 1, rows: 1 },
  A4_1UP_LANDSCAPE: { label: 'A4 landscape — 1 per page', pageMm: [297, 210], cols: 1, rows: 1 },
  A4_2UP: { label: 'A4 — 2 per page', pageMm: [210, 297], cols: 1, rows: 2 },
  A4_2X2: { label: 'A4 — 4 per page (2×2)', pageMm: [210, 297], cols: 2, rows: 2 },
  A5: { label: 'A5 — 1 per page', pageMm: [148, 210], cols: 1, rows: 1 },
  // Thermal stock is one label per page; n-up is forced to 1 for this paper.
  THERMAL_4X6: { label: 'Thermal 4in × 6in', pageMm: [101.6, 152.4], cols: 1, rows: 1 },
};

export const PAPER_LIST = Object.entries(PAPER_SPECS).map(([value, spec]) => ({
  value,
  label: spec.label,
}));

export const labelsPerSheet = (paper) => {
  const spec = PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP;
  return spec.cols * spec.rows;
};

// Sticker face render modes: LINES (plain LABEL: value in the line's own font —
// Dropy), STACK (JOMO AMG, Prénatal), COLON_LIST (an aligned LABEL : value block —
// Van Gennip, JOMO SCA), TABLE (bordered label | value — Vingino), TEXT_BLOCK (LINES
// in monospace).
export const FACE_RENDER = {
  LINES: 'LINES', STACK: 'STACK', COLON_LIST: 'COLON_LIST', TABLE: 'TABLE', TEXT_BLOCK: 'TEXT_BLOCK',
};

// What one line of a sticker face prints: a field, a colour × size grid, or a barcode.
export const STICKER_LINE_KIND = { FIELD: 'FIELD', SIZE_GRID: 'SIZE_GRID', BARCODE: 'BARCODE' };

// Barcodes a sticker line may carry, keyed as a layout stores them. EAN-13, UPC-A and
// Code 128 print; the others are recognised and recorded, and print a visible "not
// printable yet" placeholder until they have encoders.
export const BARCODE_SYMBOLOGY = {
  EAN13: { label: 'EAN-13', printable: true },
  UPCA: { label: 'UPC-A', printable: true },
  CODE128: { label: 'Code 128', printable: true },
  ITF14: { label: 'ITF-14', printable: false },
  GS1_128: { label: 'GS1-128 (SSCC)', printable: false },
  QR: { label: 'QR code', printable: false },
};

// ─── Validation vocabulary (PRD §14) ────────────────────────────────────────────
export const SEVERITY = { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO' };

export const SEVERITY_ORDER = { ERROR: 0, WARN: 1, INFO: 2 };

export const PHASE = {
  EDIT: 'EDIT',
  SAVE: 'SAVE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  DOC_GEN: 'DOC_GEN',
  STICKER: 'STICKER',
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_OPEN: 'INVOICE_OPEN',
  INVOICE_SAVE: 'INVOICE_SAVE',
  INVOICE_APPROVE: 'INVOICE_APPROVE',
};

// The invoice phases in the order the wizard passes through them, so a screen can
// ask "everything up to here" without hard-coding the list.
export const INVOICE_PHASES = [
  PHASE.INVOICE_CREATE, PHASE.INVOICE_OPEN, PHASE.INVOICE_SAVE, PHASE.INVOICE_APPROVE,
];

// ─── Field classification (PRD §11.3) ───────────────────────────────────────────
// The UI must visually distinguish these, not merely model them.
export const FIELD_CLASS = {
  AUTO: 'AUTO', // pulled, read-only
  AUTO_EDITABLE: 'AUTO_EDITABLE', // pulled, override allowed with warning + audit
  MANUAL: 'MANUAL', // genuinely new data
  CALCULATED: 'CALCULATED', // never enterable
  CONFIG: 'CONFIG', // from template / master
};

export const FIELD_CLASS_LABELS = {
  AUTO: 'Auto-filled from source',
  AUTO_EDITABLE: 'Auto-filled, editable',
  MANUAL: 'Manual entry',
  CALCULATED: 'Calculated',
  CONFIG: 'From template',
};

// ─── Order eligibility (PRD §7.1) ───────────────────────────────────────────────
// Only confirmed / in-production orders with unshipped balance may be packed.
export const PACKABLE_ORDER_STATUSES = ['CONFIRMED', 'IN_PRODUCTION'];

// ─── Defaults, overridable per tenant ───────────────────────────────────────────
export const DEFAULT_TENANT_CONFIG = {
  fourEyesEnabled: true,
  cbmDivisor: 1000000,
  cbmDecimals: 3,
  weightDecimals: 3,
  weightPerPieceDecimals: 5, // the DM 5-decimal requirement (PRD §7.4)
  defaultTolerancePercent: 0,
  // V-11: how far an invoice rate may drift from the order's FOB price before the
  // approver is warned. Per PRD §8.5 this is "configurable %", not a fixed rule.
  rateDeviationPercent: 5,
  // §17: default revision style for an approved invoice. 'SUFFIX' keeps the number
  // and appends R1/R2 so the approved series stays gapless (BR-02); the alternative
  // the PRD allows is cancel-and-reissue.
  invoiceRevisionMode: 'SUFFIX',
  /*
   * §16 / BR-11: an OPTIONAL second approval, by Finance, of the invoice's
   * financial block — rate, FX, charges, tax, total. Off by default because the PRD
   * makes it optional; on, an invoice cannot be approved until someone in
   * `financeRoles` has signed the figures off.
   *
   * The ERP has no field-level rights, so this approximates them: rather than
   * restricting who may EDIT the money, it requires a second person to CONFIRM it.
   */
  financeApprovalRequired: false,
  financeRoles: ['Finance', 'Finance Manager', 'Admin', 'Super Admin'],
};
