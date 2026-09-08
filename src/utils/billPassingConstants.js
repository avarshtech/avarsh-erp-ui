/**
 * Bill Passing constants — statuses, masters, tolerances and the exception model.
 *
 * Status values are SCREAMING_SNAKE, matching the two newest inventory modules
 * (Return to Supplier, Opening Stock) rather than the older Pascal_Snake GRN/QC
 * shape, so this module owns its colour/label maps and touches no shared file.
 */

// ── Bill status ────────────────────────────────────────────────────────────
export const BILL_PASSING_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_VERIFICATION: 'UNDER_VERIFICATION',
  /** Sent back to the clerk for correction by the verifier or approver. */
  REFERRED_BACK: 'REFERRED_BACK',
  QUERY_RAISED: 'QUERY_RAISED',
  ON_HOLD: 'ON_HOLD',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT_TO_ACCOUNTS: 'SENT_TO_ACCOUNTS',
};

// PRD FR-BP-106 colour cues.
export const BILL_PASSING_STATUS_COLOR = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  UNDER_VERIFICATION: 'processing',
  REFERRED_BACK: 'volcano',
  QUERY_RAISED: 'orange',
  ON_HOLD: 'gold',
  PENDING_APPROVAL: 'purple',
  APPROVED: 'success',
  REJECTED: 'error',
  SENT_TO_ACCOUNTS: 'cyan',
};

export const BILL_PASSING_STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_VERIFICATION: 'Under Verification',
  REFERRED_BACK: 'Referred Back',
  QUERY_RAISED: 'Query Raised',
  ON_HOLD: 'On Hold',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved / Passed',
  REJECTED: 'Rejected',
  SENT_TO_ACCOUNTS: 'Sent to Accounts',
};

/** Happy-path progression, for the status strip on the workspace header. */
export const BILL_PASSING_STATUS_FLOW = [
  BILL_PASSING_STATUS.DRAFT,
  BILL_PASSING_STATUS.SUBMITTED,
  BILL_PASSING_STATUS.UNDER_VERIFICATION,
  BILL_PASSING_STATUS.PENDING_APPROVAL,
  BILL_PASSING_STATUS.APPROVED,
  BILL_PASSING_STATUS.SENT_TO_ACCOUNTS,
];

/** Quick-filter segmented control on the list page (FR-BP-103). */
export const BILL_QUICK_FILTER = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  ON_HOLD: 'ON_HOLD',
  REJECTED: 'REJECTED',
  ALL: 'ALL',
};

export const QUICK_FILTER_STATUSES = {
  PENDING: [
    BILL_PASSING_STATUS.DRAFT,
    BILL_PASSING_STATUS.SUBMITTED,
    BILL_PASSING_STATUS.UNDER_VERIFICATION,
    BILL_PASSING_STATUS.REFERRED_BACK,
    BILL_PASSING_STATUS.QUERY_RAISED,
    BILL_PASSING_STATUS.PENDING_APPROVAL,
  ],
  PASSED: [BILL_PASSING_STATUS.APPROVED, BILL_PASSING_STATUS.SENT_TO_ACCOUNTS],
  ON_HOLD: [BILL_PASSING_STATUS.ON_HOLD],
  REJECTED: [BILL_PASSING_STATUS.REJECTED],
  ALL: null,
};

// The header, GRN selection, charges and attachments stay open until the bill
// is passed (product review, 2026-09-07): every state before APPROVED. The
// approved snapshot, the accounts hand-off and a rejection are frozen.
const EDITABLE_STATUSES = new Set([
  BILL_PASSING_STATUS.DRAFT,
  BILL_PASSING_STATUS.REFERRED_BACK,
  BILL_PASSING_STATUS.QUERY_RAISED,
  BILL_PASSING_STATUS.SUBMITTED,
  BILL_PASSING_STATUS.UNDER_VERIFICATION,
  BILL_PASSING_STATUS.ON_HOLD,
  BILL_PASSING_STATUS.PENDING_APPROVAL,
]);
export const isBillEditable = (status) => EDITABLE_STATUSES.has(status);

// States where the bill sits with the clerk and Submit (re)enters the queue.
const SUBMITTABLE_STATUSES = new Set([
  BILL_PASSING_STATUS.DRAFT,
  BILL_PASSING_STATUS.REFERRED_BACK,
  BILL_PASSING_STATUS.QUERY_RAISED,
]);
export const isBillSubmittable = (status) => SUBMITTABLE_STATUSES.has(status);

// States a verifier or approver can hand back to the clerk for correction.
const REFER_BACK_STATUSES = new Set([
  BILL_PASSING_STATUS.SUBMITTED,
  BILL_PASSING_STATUS.UNDER_VERIFICATION,
  BILL_PASSING_STATUS.ON_HOLD,
  BILL_PASSING_STATUS.PENDING_APPROVAL,
]);
export const canReferBackBill = (status) => REFER_BACK_STATUSES.has(status);

// Only an unsubmitted draft can be removed; everything else is audit history.
export const isBillDeletable = (status) => status === BILL_PASSING_STATUS.DRAFT;

// Debits are confirmed or dropped by the verifier while the bill is being checked.
const DEBIT_EDITABLE_STATUSES = new Set([
  BILL_PASSING_STATUS.DRAFT,
  BILL_PASSING_STATUS.REFERRED_BACK,
  BILL_PASSING_STATUS.QUERY_RAISED,
  BILL_PASSING_STATUS.SUBMITTED,
  BILL_PASSING_STATUS.UNDER_VERIFICATION,
]);
export const areDebitsEditable = (status) => DEBIT_EDITABLE_STATUSES.has(status);

/**
 * The reason banner a bill carries in its current state, for the workspace and
 * the view dialog. Returns null when nothing needs explaining. Rejection wins
 * because it is terminal; the rest are keyed by the current status.
 */
export const getBillReason = (bill) => {
  if (!bill) return null;
  if (bill.rejectReason) return { type: 'error', label: 'Rejected', text: bill.rejectReason };
  if (bill.status === BILL_PASSING_STATUS.REFERRED_BACK && bill.referBackReason) {
    return { type: 'warning', label: 'Referred back for correction', text: bill.referBackReason };
  }
  if (bill.status === BILL_PASSING_STATUS.ON_HOLD && bill.holdReason) {
    return { type: 'warning', label: 'On hold', text: bill.holdReason };
  }
  if (bill.status === BILL_PASSING_STATUS.QUERY_RAISED && bill.queryReason) {
    return { type: 'warning', label: 'Query raised', text: bill.queryReason };
  }
  // A passed bill that was reopened lands in QUERY_RAISED with its own reason field.
  if (bill.status === BILL_PASSING_STATUS.QUERY_RAISED && bill.reopenReason) {
    return { type: 'warning', label: 'Reopened for correction', text: bill.reopenReason };
  }
  return null;
};

// ── Debit lines ────────────────────────────────────────────────────────────
export const DEBIT_ORIGIN = {
  SYSTEM_PROPOSED: 'SYSTEM_PROPOSED',
  MANUAL: 'MANUAL',
  /** Already recovered by a Return-to-Supplier debit note — read-only here. */
  LINKED_DEBIT_NOTE: 'LINKED_DEBIT_NOTE',
};

export const DEBIT_ORIGIN_LABEL = {
  SYSTEM_PROPOSED: 'System proposed',
  MANUAL: 'Manual',
  LINKED_DEBIT_NOTE: 'Linked debit note',
};

export const DEBIT_STATUS = {
  PROPOSED: 'PROPOSED',
  CONFIRMED: 'CONFIRMED',
  DROPPED: 'DROPPED',
};

export const DEBIT_STATUS_COLOR = {
  PROPOSED: 'gold',
  CONFIRMED: 'green',
  DROPPED: 'default',
};

/** Only CONFIRMED debits reduce Net Payable (BR-11). */
export const isDebitCounted = (d) => d?.status === DEBIT_STATUS.CONFIRMED;

// ── Master data (seeded; admin-editable on the master screens) ──────────────
export const DEBIT_TYPES = [
  { code: 'MATERIAL_REJECTION', name: 'Fabric / Material Rejection', quantityBased: true,  requiresQc: true  },
  { code: 'SHORT_QUANTITY',     name: 'Short Quantity',              quantityBased: true,  requiresQc: false },
  { code: 'QUALITY_ISSUE',      name: 'Quality Issue',               quantityBased: true,  requiresQc: true  },
  { code: 'SHADE_VARIATION',    name: 'Shade Variation',             quantityBased: true,  requiresQc: true  },
  { code: 'WIDTH_VARIATION',    name: 'Width Variation',             quantityBased: true,  requiresQc: true  },
  { code: 'GSM_VARIATION',      name: 'GSM Variation',               quantityBased: true,  requiresQc: true  },
  { code: 'FABRIC_DEFECTS',     name: 'Fabric Defects',              quantityBased: true,  requiresQc: true  },
  { code: 'EXCESS_MOISTURE',    name: 'Excess Moisture',             quantityBased: true,  requiresQc: true  },
  { code: 'RATE_DIFFERENCE',    name: 'Rate Difference',             quantityBased: true,  requiresQc: false },
  { code: 'PACKING_ISSUE',      name: 'Packing Issue',               quantityBased: false, requiresQc: false },
  { code: 'LATE_DELIVERY',      name: 'Late Delivery / Penalty',     quantityBased: false, requiresQc: false },
  { code: 'OTHER_DEDUCTION',    name: 'Other Supplier Deduction',    quantityBased: false, requiresQc: false },
];

export const CHARGE_TYPES = [
  { code: 'FREIGHT',   name: 'Freight',   defaultTaxable: true  },
  { code: 'INSURANCE', name: 'Insurance', defaultTaxable: true  },
  { code: 'PACKING',   name: 'Packing',   defaultTaxable: true  },
  { code: 'LOADING',   name: 'Loading',   defaultTaxable: true  },
  { code: 'OTHER',     name: 'Other',     defaultTaxable: false },
];

/** `blocking` types stop a bill reaching approval while OPEN (FR-BP-803). */
export const ISSUE_TYPES = [
  { code: 'QUANTITY_SHORTAGE',      name: 'Quantity Shortage',               blocking: false },
  { code: 'QUALITY_REJECTION',      name: 'Quality Rejection',               blocking: false },
  { code: 'RATE_MISMATCH',          name: 'Rate Mismatch',                   blocking: false },
  { code: 'INVOICE_MISMATCH',       name: 'Invoice Mismatch',                blocking: true  },
  { code: 'GRN_PENDING',            name: 'GRN Pending',                     blocking: true  },
  { code: 'QC_PENDING',             name: 'QC Pending',                      blocking: true  },
  { code: 'SUPPLIER_CLARIFICATION', name: 'Supplier Clarification Required', blocking: false },
  { code: 'DEBIT_NOTE_REQUIRED',    name: 'Debit Note Required',             blocking: false },
  { code: 'OTHER',                  name: 'Other',                           blocking: false },
];

export const ISSUE_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  WITHDRAWN: 'WITHDRAWN',
};

export const ISSUE_STATUS_COLOR = {
  OPEN: 'error',
  IN_PROGRESS: 'processing',
  RESOLVED: 'success',
  WITHDRAWN: 'default',
};

export const TAX_TYPES = ['CGST', 'SGST', 'IGST', 'CESS'];

export const GST_TREATMENT = { WITH_GST: 'WITH_GST', WITHOUT_GST: 'WITHOUT_GST' };

// ── Tolerances and the reconciliation flag ─────────────────────────────────
/**
 * PRD FR-BP-602 defaults. Deliberately NOT reusing getVarianceStatus() from
 * productionConstants: that helper hard-codes the consumption PRD 2%/5% bands,
 * an order of magnitude looser than a supplier bill can accept. The return
 * shape is kept identical so both read the same way at the call site.
 */
export const DEFAULT_TOLERANCE = {
  qtyPercent: 0.5,
  ratePercent: 0,
  valueAmount: 100,
  taxVarianceAmount: 1,
  invoiceAgeDays: 180,
  debitPercentThreshold: 5,
  holdEscalationDays: 3,
};

const OK    = { level: 'green',  tagColor: 'green', textColor: 'var(--success-color)', label: 'Within tolerance' };
const WATCH = { level: 'yellow', tagColor: 'gold',  textColor: 'var(--warning-color)', label: 'Review needed' };
const BAD   = { level: 'red',    tagColor: 'red',   textColor: 'var(--error-color)',   label: 'Exceeds tolerance' };

/**
 * How a reconciliation cell is painted.
 *
 * The server sends a level and a label and never a colour — a Java DTO has no
 * business knowing this application's theme tokens — so the screen maps one to
 * the other here.
 */
const RECON_LEVEL_STYLE = { GREEN: OK, AMBER: WATCH, RED: BAD };

export const reconCellStyle = (status) => {
  const style = RECON_LEVEL_STYLE[status?.level] || OK;
  // The server may override the label, e.g. "Covered by debits".
  return { ...style, label: status?.label || style.label };
};

/** Percentage comparison (quantity, rate). An exact match is green. */
export const getPercentToleranceStatus = (variancePercent, limitPercent) => {
  const abs = Math.abs(Number(variancePercent) || 0);
  if (abs === 0) return OK;
  if (abs <= (Number(limitPercent) || 0)) return WATCH;
  return BAD;
};

/** Absolute comparison (money). Rounding inside the band shows amber. */
export const getValueToleranceStatus = (varianceAmount, limitAmount) => {
  const abs = Math.abs(Number(varianceAmount) || 0);
  if (abs === 0) return OK;
  if (abs <= (Number(limitAmount) || 0)) return WATCH;
  return BAD;
};

// ── Exceptions (PRD section 8) ─────────────────────────────────────────────
export const EXCEPTION_SEVERITY = {
  /** Acknowledge and carry on. */
  WARN: 'WARN',
  /** Cannot reach approval until resolved. */
  BLOCK: 'BLOCK',
  /** Cannot proceed without an authorised override and a reason. */
  BLOCK_WITH_OVERRIDE: 'BLOCK_WITH_OVERRIDE',
};

export const EXCEPTION_SEVERITY_COLOR = {
  WARN: 'warning',
  BLOCK: 'error',
  BLOCK_WITH_OVERRIDE: 'error',
};

// ── Billing status per GRN line (BR-23/24) ─────────────────────────────────
export const LINE_BILLING_STATUS = {
  UNBILLED: 'UNBILLED',
  PARTIALLY_BILLED: 'PARTIALLY_BILLED',
  FULLY_BILLED: 'FULLY_BILLED',
};

export const LINE_BILLING_STATUS_COLOR = {
  UNBILLED: 'default',
  PARTIALLY_BILLED: 'gold',
  FULLY_BILLED: 'green',
};

export const LINE_BILLING_STATUS_LABEL = {
  UNBILLED: 'Unbilled',
  PARTIALLY_BILLED: 'Partially Billed',
  FULLY_BILLED: 'Fully Billed',
};

/** Document prefix — matches the backend DocumentNumberService series. */
export const BP_DOC_PREFIX = 'BP';

/**
 * Indian financial year code, e.g. 2026-08 → "26-27" (the FY starts April 1).
 *
 * The server owns the real value: it derives a bill's financial year from the
 * invoice date, which is what the duplicate-invoice rule keys on. This is only
 * for showing the user what number series a new bill will land in.
 */
export const currentFinancialYear = (date = new Date()) => {
  const y = date.getFullYear() % 100;
  const from = date.getMonth() + 1 >= 4 ? y : y - 1;
  return `${String(from).padStart(2, '0')}-${String(from + 1).padStart(2, '0')}`;
};

/** Permission module id; one module with extra ops, like inventory-qc. */
export const BP_MODULE_ID = 'inventory-bill-passing';
