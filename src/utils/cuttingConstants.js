/**
 * Cutting module (production execution) constants — statuses, tolerances and
 * master option lists per the Cutting PRD v1.0 + Indian SME garment practice.
 */

export const CUTTING_STATUS_COLORS = {
  DRAFT: 'default',
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  RECEIVED: 'success',
  PARTIALLY_RECEIVED: 'warning',
  COMPLETED: 'success',
  REPORT_GENERATED: 'success',
  APPROVED: 'success',
  AUDITED: 'processing',
  PASSED: 'success',
  FAILED: 'error',
  PARTIAL: 'warning',
  BUNDLED: 'processing',
  ISSUED_SEWING: 'success',
  ISSUED_PROCESS: 'warning',
  ISSUED: 'warning',
  PARTIALLY_RETURNED: 'warning',
  FULLY_RETURNED: 'success',
  RETURNED: 'success',
  RECONCILED: 'success',
  CANCELLED: 'default',
};

export const statusLabel = (s) => String(s || '').replaceAll('_', ' ')
  .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Minimum relaxation duration (hours) by fabric category — BR-FR-02-02. */
export const FABRIC_TYPES = [
  { value: 'Single Jersey', category: 'Knit', minRelaxHrs: 24, shrinkagePct: 5 },
  { value: 'Interlock', category: 'Knit', minRelaxHrs: 24, shrinkagePct: 5 },
  { value: 'Rib 1x1', category: 'Knit', minRelaxHrs: 24, shrinkagePct: 6 },
  { value: 'Fleece', category: 'Knit', minRelaxHrs: 24, shrinkagePct: 8 },
  { value: 'Poplin', category: 'Woven', minRelaxHrs: 12, shrinkagePct: 3 },
  { value: 'Twill', category: 'Woven', minRelaxHrs: 12, shrinkagePct: 3 },
  { value: 'Denim', category: 'Denim', minRelaxHrs: 48, shrinkagePct: 4 },
];

/** TMB measurements at Top/Middle/Bottom must agree within this (cm) — BR-FR-04-03. */
export const TMB_TOLERANCE_CM = 0.5;

export const BUNDLE_SIZES = [20, 30, 50];

export const EXTERNAL_PROCESSES = ['Embroidery', 'Printing', 'Washing', 'Dyeing', 'Pleating'];

export const PANEL_NAMES = ['Front', 'Back', 'Sleeve', 'Collar', 'Cuff', 'Pocket', 'Placket', 'Hood'];

export const TMB_COMMENTS = ['OK', 'Shortage', 'Shrinkage', 'Missing', 'Miscut', 'Pattern Drift'];

export const TMB_ACTIONS = ['Accept', 'Return to Cutting', 'Re-spread', 'Re-cut', 'Connected'];

export const PANEL_QUALITY_OPTIONS = ['OK', 'Color Mismatch', 'Misaligned', 'Damaged', 'Print Defect'];

export const PANEL_CHECK_ACTIONS = ['Accepted', 'Return to process', 'Re-fire', 'Identified and segregated'];

export const RETURN_SHORTFALL_REASONS = ['Lost', 'Damaged', 'Retained by Vendor', 'Pending'];

export const RECUT_REASONS = ['Fabric defect', 'Cutting defect', 'Pattern error', 'Sewing damage', 'Shade mismatch'];

export const SEWING_LINES = ['Line-A', 'Line-B', 'B-1', 'B-2'];

export const CUTTING_TABLES = ['Table-1', 'Table-2', 'Table-3'];

/** Cutting labour mode — Indian SME practice: cutting is often piece-rated to a contractor. */
export const CUTTING_BY_OPTIONS = ['In-house', 'Contractor'];

/** Alert thresholds from PRD business rules. */
export const THRESHOLDS = {
  markerEfficiencyWarn: 75,   // BR-ENH-01-01
  utilizationWarn: 85,        // BR-ENH-03-02
  panelDefectLotPct: 5,       // BR-FR-09-04
  reCutAlertPct: 2,           // BR-FR-11-07
  reconcileTolerancePct: 0.5, // BR-ENH-03-04
};
