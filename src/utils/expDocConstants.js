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
  PACKING: 'export-packing',
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
export const PL_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  EXPORTED: 'EXPORTED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
};

export const PL_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  EXPORTED: 'Exported',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

export const PL_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'DRAFT'], // approve, or send back for edits
  APPROVED: ['EXPORTED', 'CANCELLED', 'SUPERSEDED'],
  EXPORTED: ['CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: [],
};

export const isPlEditable = (status) => status === PL_STATUS.DRAFT;
export const isPlDeletable = (status) => status === PL_STATUS.DRAFT;
export const isPlApproved = (status) =>
  status === PL_STATUS.APPROVED || status === PL_STATUS.EXPORTED;

// ─── Export invoice lifecycle ───────────────────────────────────────────────────
export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  EXPORTED: 'EXPORTED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
};

export const INVOICE_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  EXPORTED: 'Exported',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

export const INVOICE_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'DRAFT'],
  APPROVED: ['EXPORTED', 'CANCELLED', 'SUPERSEDED'],
  EXPORTED: ['CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: [],
};

export const isInvoiceEditable = (status) => status === INVOICE_STATUS.DRAFT;

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

// ─── Template lifecycle (PRD §10) ───────────────────────────────────────────────
export const TEMPLATE_STATUS = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', RETIRED: 'RETIRED' };

export const TEMPLATE_STATUS_LABELS = { DRAFT: 'Draft', ACTIVE: 'Active', RETIRED: 'Retired' };

// ─── Sticker paper / label sheets (PRD §9.3, §18) ───────────────────────────────
// pageMm is the @page size; cols × rows is the label grid printed on it.
export const PAPER = {
  A4_1UP: 'A4_1UP',
  A4_2UP: 'A4_2UP',
  A4_2X2: 'A4_2X2',
  A5: 'A5',
  THERMAL_4X6: 'THERMAL_4X6',
};

export const PAPER_SPECS = {
  A4_1UP: { label: 'A4 — 1 per page', pageMm: [210, 297], cols: 1, rows: 1 },
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

// Sticker face render modes. These three cover every layout in PRD §9.2:
// STACK (JOMO AMG/SCA, Prénatal), TABLE (Vingino), TEXT_BLOCK (Van Gennip).
export const FACE_RENDER = { STACK: 'STACK', TABLE: 'TABLE', TEXT_BLOCK: 'TEXT_BLOCK' };

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
