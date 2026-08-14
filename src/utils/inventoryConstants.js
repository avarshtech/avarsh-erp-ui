// ─── GRN TYPE ──────────────────────────────────────────────────────────────────
export const GRN_TYPE = {
  FABRIC: 'Fabric',
  ACCESSORIES: 'Accessories',
};

// ─── GRN STATUS ────────────────────────────────────────────────────────────────
// 5-state lifecycle with an approval step on the reverse action:
//   DRAFT             — creator is still editing the GRN for the first time.
//   QC_PENDING        — submitted; awaiting QC inspection.
//   PENDING_REVERSAL  — creator requested to reverse the GRN; waits for manager.
//   REVERSED          — reversal approved; GRN is editable again (distinct from
//                       Draft so the audit trail shows it was submitted before).
//   CLOSED            — QC approved; terminal, read-only.
//
// Transitions:
//   DRAFT             → QC_PENDING         (Submit)
//   QC_PENDING        → PENDING_REVERSAL   (Request Reversal — creator)
//   QC_PENDING        → CLOSED             (QC approval — server-side interlock)
//   PENDING_REVERSAL  → REVERSED           (Approve Reversal — manager)
//   PENDING_REVERSAL  → QC_PENDING         (Reject Reversal — manager)
//   REVERSED          → QC_PENDING         (Submit again)
export const GRN_STATUS = {
  DRAFT: 'Draft',
  QC_PENDING: 'QC_Pending',
  PENDING_REVERSAL: 'Pending_Reversal',
  REVERSED: 'Reversed',
  CLOSED: 'Closed',
};

export const GRN_STATUS_LABELS = {
  [GRN_STATUS.DRAFT]: 'Draft',
  [GRN_STATUS.QC_PENDING]: 'QC Pending',
  [GRN_STATUS.PENDING_REVERSAL]: 'Pending Reversal',
  [GRN_STATUS.REVERSED]: 'Reversed',
  [GRN_STATUS.CLOSED]: 'Closed',
};

// ─── QC STATUS ─────────────────────────────────────────────────────────────────
// 9-state lifecycle. Approved and Conditional_Pass are peer final states —
// both close the linked GRN and both enter the refer-back flow.
// Rejected_With_Backup is a secondary reject terminal where physical stock is
// retained in the warehouse (not returned to supplier) and may be re-opened
// via the refer-back flow if marked in error.
export const QC_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending_Approval',
  APPROVED: 'Approved',
  CONDITIONAL_PASS: 'Conditional_Pass',            // approved with qualifications
  REJECTED: 'Rejected',
  REJECTED_WITH_BACKUP: 'Rejected_With_Backup',    // rejected but kept in stock as back-up
  REFERRED_BACK_PENDING: 'Referred_Back_Pending',  // request to reopen approved QC
  REFERRED_BACK: 'Referred_Back',                  // editable, only Submit
};

export const QC_STATUS_LABELS = {
  [QC_STATUS.DRAFT]: 'Draft',
  [QC_STATUS.SUBMITTED]: 'Submitted',
  [QC_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [QC_STATUS.APPROVED]: 'Approved',
  [QC_STATUS.CONDITIONAL_PASS]: 'Conditional Pass',
  [QC_STATUS.REJECTED]: 'Rejected',
  [QC_STATUS.REJECTED_WITH_BACKUP]: 'Rejected (Back-up)',
  [QC_STATUS.REFERRED_BACK_PENDING]: 'Refer Back Pending',
  [QC_STATUS.REFERRED_BACK]: 'Referred Back',
};

// ─── STOCK STATUS ──────────────────────────────────────────────────────────────
export const STOCK_STATUS = {
  IN_STOCK: 'In_Stock',
  RESERVED: 'Reserved',
  IN_QC: 'In_QC',
  ON_HOLD: 'On_Hold',
  ISSUED: 'Issued',
  DAMAGED: 'Damaged',
};

export const STOCK_STATUS_LABELS = {
  [STOCK_STATUS.IN_STOCK]: 'In Stock',
  [STOCK_STATUS.RESERVED]: 'Reserved',
  [STOCK_STATUS.IN_QC]: 'In QC',
  [STOCK_STATUS.ON_HOLD]: 'On Hold',
  [STOCK_STATUS.ISSUED]: 'Issued',
  [STOCK_STATUS.DAMAGED]: 'Damaged',
};

// ─── LABEL HELPERS ─────────────────────────────────────────────────────────────
const ALL_LABELS = {
  ...GRN_STATUS_LABELS,
  ...QC_STATUS_LABELS,
  ...STOCK_STATUS_LABELS,
};

export const getInventoryStatusLabel = (status) => ALL_LABELS[status] || status?.replace(/_/g, ' ') || '';

// ─── FABRIC QC PARAMETERS (kept; star-rating colour adapted for theme) ─────────
export const FABRIC_QC_PARAMETERS = [
  { key: 'gsm', label: 'GSM (Weight)', unit: 'g/m²', type: 'number' },
  { key: 'width', label: 'Width', unit: 'inches', type: 'number' },
  { key: 'shadeMatch', label: 'Shade Variation', unit: 'Grade 1-5', type: 'rating' },
  { key: 'shrinkageLength', label: 'Shrinkage (Length)', unit: '%', type: 'number' },
  { key: 'shrinkageWidth', label: 'Shrinkage (Width)', unit: '%', type: 'number' },
  { key: 'colorFastnessWash', label: 'Color Fastness (Wash)', unit: 'Grade 1-5', type: 'rating' },
  { key: 'colorFastnessRub', label: 'Color Fastness (Rubbing)', unit: 'Grade 1-5', type: 'rating' },
  { key: 'pillingResistance', label: 'Pilling Resistance', unit: 'Grade 1-5', type: 'rating' },
  { key: 'tensileStrength', label: 'Tensile Strength', unit: 'N', type: 'number' },
];

// ─── FABRIC QC — per-roll defect-count threshold (default; per item later) ─────
export const FABRIC_QC_DEFECT_FAIL_THRESHOLD = 3;

// ─── FABRIC QC — width / GSM tolerance (±5%) ───────────────────────────────────
export const FABRIC_QC_TOLERANCE_PCT = 5;

// ─── FABRIC QC FAILED ROLL DISPOSITIONS (kept for legacy mock data) ────────────
export const FABRIC_QC_DISPOSITIONS = [
  { value: 'RETURN', label: 'Return to Supplier', color: 'red', requiresRemarks: false },
  { value: 'QUARANTINE', label: 'Quarantine', color: 'orange', requiresRemarks: false },
  { value: 'CONDITIONAL', label: 'Conditional Use Approval', color: 'gold', requiresRemarks: true },
];

export const FABRIC_QC_OVERALL_RESULT = {
  PASS: 'Pass',
  CONDITIONAL: 'Conditional',
  FAIL: 'Fail',
  PENDING: 'Pending',
};

// ─── AQL LEVELS ────────────────────────────────────────────────────────────────
export const AQL_LEVELS = [
  { value: '0.65', label: 'AQL 0.65' },
  { value: '1.0', label: 'AQL 1.0' },
  { value: '1.5', label: 'AQL 1.5' },
  { value: '2.5', label: 'AQL 2.5' },
  { value: '4.0', label: 'AQL 4.0' },
];

// ─── TRIMS QC STOCK STATUS (legacy compatibility) ──────────────────────────────
export const TRIMS_QC_STOCK_STATUS = {
  EXACT: 'Exact',
  SHORT: 'Short',
  EXCESS: 'Excess',
};

export const TRIMS_QC_STATUS_COLORS = {
  Exact: { color: 'green', alertType: 'success' },
  Short: { color: 'red', alertType: 'error' },
  Excess: { color: 'orange', alertType: 'warning' },
};

// ─── UOM OPTIONS ───────────────────────────────────────────────────────────────
export const INVENTORY_UOMS = [
  { value: 'meters', label: 'Meters' },
  { value: 'yards', label: 'Yards' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'pcs', label: 'Pieces' },
  { value: 'gross', label: 'Gross' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'cones', label: 'Cones' },
];

// ─── DOC NUMBER PREFIXES ───────────────────────────────────────────────────────
export const GRN_DOC_PREFIX = 'GRN';
export const QC_DOC_PREFIX = 'QC';

// ─── GRN CATEGORY CLASSIFICATION ───────────────────────────────────────────────
// A GRN is raised in one of two shapes: fabric is received as ROLLS, everything else
// (trims, packing materials) is received as CARTONS. Which shape applies is decided by
// the PO line's category.
//
// This used to be an exact match against a single category named "Trims", which meant a
// line in "Local Trims", "Imported Trims" or "Packing Materials" matched neither form and
// was unreceivable. Categories are user-defined master data, so the only safe rule is:
// fabric is fabric, and anything that is not fabric is an accessory.
export const GRN_CATEGORY = { FABRIC: 'Fabric', ACCESSORIES: 'Accessories' };

/** True when a PO line's category is a fabric category. */
export const isFabricCategory = (categoryName) =>
  String(categoryName || '').trim().toLowerCase().includes('fabric');

/** True when a PO line belongs in a GRN of the given kind (GRN_CATEGORY.*). */
export const matchesGrnCategory = (categoryName, grnCategory) =>
  grnCategory === GRN_CATEGORY.FABRIC
    ? isFabricCategory(categoryName)
    : Boolean(categoryName) && !isFabricCategory(categoryName);
