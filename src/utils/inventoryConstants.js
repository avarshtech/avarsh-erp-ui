// ─── GRN TYPE ──────────────────────────────────────────────────────────────────
export const GRN_TYPE = {
  FABRIC: 'Fabric',
  ACCESSORIES: 'Accessories',
};

// ─── GRN STATUS ────────────────────────────────────────────────────────────────
export const GRN_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CONFIRMED: 'Confirmed',
  QC_PENDING: 'QC_Pending',
  QC_COMPLETE: 'QC_Complete',
  CLOSED: 'Closed',
  REVERSED: 'Reversed',
};

export const GRN_STATUS_LABELS = {
  [GRN_STATUS.DRAFT]: 'Draft',
  [GRN_STATUS.SUBMITTED]: 'Submitted',
  [GRN_STATUS.CONFIRMED]: 'Confirmed',
  [GRN_STATUS.QC_PENDING]: 'QC Pending',
  [GRN_STATUS.QC_COMPLETE]: 'QC Complete',
  [GRN_STATUS.CLOSED]: 'Closed',
  [GRN_STATUS.REVERSED]: 'Reversed',
};

// ─── QC STATUS ─────────────────────────────────────────────────────────────────
export const QC_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In_Progress',
  PASSED: 'Passed',
  FAILED: 'Failed',
  CONDITIONAL: 'Conditional_Pass',
  PENDING_APPROVAL: 'Pending_Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const QC_STATUS_LABELS = {
  [QC_STATUS.PENDING]: 'Pending',
  [QC_STATUS.IN_PROGRESS]: 'In Progress',
  [QC_STATUS.PASSED]: 'Passed',
  [QC_STATUS.FAILED]: 'Failed',
  [QC_STATUS.CONDITIONAL]: 'Conditional Pass',
  [QC_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [QC_STATUS.APPROVED]: 'Approved',
  [QC_STATUS.REJECTED]: 'Rejected',
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

// ─── ISSUE STATUS ──────────────────────────────────────────────────────────────
export const ISSUE_STATUS = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  ISSUED: 'Issued',
  PARTIAL: 'Partially_Issued',
  RETURNED: 'Returned',
  CLOSED: 'Closed',
};

export const ISSUE_STATUS_LABELS = {
  [ISSUE_STATUS.DRAFT]: 'Draft',
  [ISSUE_STATUS.APPROVED]: 'Approved',
  [ISSUE_STATUS.ISSUED]: 'Issued',
  [ISSUE_STATUS.PARTIAL]: 'Partially Issued',
  [ISSUE_STATUS.RETURNED]: 'Returned',
  [ISSUE_STATUS.CLOSED]: 'Closed',
};

// ─── ADJUSTMENT STATUS ─────────────────────────────────────────────────────────
export const ADJUSTMENT_STATUS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending_Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const ADJUSTMENT_STATUS_LABELS = {
  [ADJUSTMENT_STATUS.DRAFT]: 'Draft',
  [ADJUSTMENT_STATUS.PENDING_APPROVAL]: 'Pending Approval',
  [ADJUSTMENT_STATUS.APPROVED]: 'Approved',
  [ADJUSTMENT_STATUS.REJECTED]: 'Rejected',
};

// ─── LABEL HELPERS ─────────────────────────────────────────────────────────────
const ALL_LABELS = {
  ...GRN_STATUS_LABELS,
  ...QC_STATUS_LABELS,
  ...STOCK_STATUS_LABELS,
  ...ISSUE_STATUS_LABELS,
  ...ADJUSTMENT_STATUS_LABELS,
};

export const getInventoryStatusLabel = (status) => ALL_LABELS[status] || status?.replace(/_/g, ' ') || '';

// ─── FABRIC QC PARAMETERS ──────────────────────────────────────────────────────
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

// ─── 4-POINT DEFECT SIZES ──────────────────────────────────────────────────────
export const DEFECT_SIZES = [
  { value: 'under3', label: 'Under 3 inches', points: 1 },
  { value: '3to6', label: '3 to 6 inches', points: 2 },
  { value: '6to9', label: '6 to 9 inches', points: 3 },
  { value: 'over9', label: 'Over 9 inches', points: 4 },
];

export const DEFECT_TYPES = [
  'Hole', 'Stain', 'Shade Bar', 'Broken End', 'Missing Pick', 'Slub',
  'Oil Spot', 'Crease Mark', 'Bowing', 'Selvage Defect', 'Weaving Defect', 'Other',
];

// ─── AQL LEVELS ────────────────────────────────────────────────────────────────
export const AQL_LEVELS = [
  { value: '0.65', label: 'AQL 0.65' },
  { value: '1.0', label: 'AQL 1.0' },
  { value: '1.5', label: 'AQL 1.5' },
  { value: '2.5', label: 'AQL 2.5' },
  { value: '4.0', label: 'AQL 4.0' },
];

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
