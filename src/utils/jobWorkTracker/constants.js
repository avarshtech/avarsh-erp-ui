/**
 * Job Work Tracker vocabulary — outsourced jobs, daily progress, receipts and pull-backs.
 * UI mock round 1: these mirror the enums the backend will define (JobWorkStatus, JobWorkStage,
 * ProgressFlag, IssueCategory, ReceiptStatus, PullBackStatus …), so the screens keep them at
 * integration. A job is one order at one vendor at one branch.
 */

export const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export const JOB_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};
export const JOB_STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Short-closed',
  CANCELLED: 'Cancelled',
};
export const OPEN_JOB_STATUSES = [JOB_STATUS.OPEN, JOB_STATUS.IN_PROGRESS];

// Stage chain with spaced sequence numbers; "received" is never a stage — it comes from receipts.
export const STAGE = {
  CUT: 'CUT',
  PANEL_PROCESSED: 'PANEL_PROCESSED',
  LOADED: 'LOADED',
  STITCHED: 'STITCHED',
  GARMENT_PROCESSED: 'GARMENT_PROCESSED',
  TRIMMED: 'TRIMMED',
  CHECKED: 'CHECKED',
  IRONED: 'IRONED',
  PACKED: 'PACKED',
};
export const STAGE_SEQ = {
  CUT: 10, PANEL_PROCESSED: 20, LOADED: 30, STITCHED: 40, GARMENT_PROCESSED: 50,
  TRIMMED: 60, CHECKED: 70, IRONED: 80, PACKED: 90,
};
export const STAGE_LABEL = {
  CUT: 'Cut',
  PANEL_PROCESSED: 'Panel process',
  LOADED: 'Loaded',
  STITCHED: 'Stitched',
  GARMENT_PROCESSED: 'Garment process',
  TRIMMED: 'Trimmed',
  CHECKED: 'Checked',
  IRONED: 'Ironed',
  PACKED: 'Packed',
};
export const FINISHING_STAGES = [STAGE.TRIMMED, STAGE.CHECKED, STAGE.IRONED, STAGE.PACKED];
/** Pull-back lines may name pieces the vendor has not started on (fabric still uncut). */
export const NOT_STARTED = 'NOT_STARTED';
export const NOT_STARTED_LABEL = 'Not started';
export const stageSeq = (stage) => (stage === NOT_STARTED ? 0 : STAGE_SEQ[stage]);
export const stageLabel = (stage) => (stage === NOT_STARTED ? NOT_STARTED_LABEL : STAGE_LABEL[stage] || stage);
export const sortStages = (stages) => [...new Set(stages)].sort((a, b) => STAGE_SEQ[a] - STAGE_SEQ[b]);

// Finishing PO process → stage.
export const FINISHING_PROCESS_STAGE = {
  TRIMMING: STAGE.TRIMMED,
  CHECKING: STAGE.CHECKED,
  IRONING: STAGE.IRONED,
  PACKING: STAGE.PACKED,
};

export const DOC_TYPE = {
  CUTTING_PO: 'CUTTING_PO',
  WORK_ORDER: 'WORK_ORDER',
  FINISHING_PO: 'FINISHING_PO',
  CUT_PANEL_PO: 'CUT_PANEL_PO',
  GARMENT_PROCESS_PO: 'GARMENT_PROCESS_PO',
};
export const DOC_TYPE_LABEL = {
  CUTTING_PO: 'Cutting PO',
  WORK_ORDER: 'Work Order',
  FINISHING_PO: 'Finishing PO',
  CUT_PANEL_PO: 'Cut Panel PO',
  GARMENT_PROCESS_PO: 'Garment Process PO',
};

export const RISK = { OVERDUE: 'OVERDUE', AT_RISK: 'AT_RISK', ON_TRACK: 'ON_TRACK' };
export const RISK_LABEL = { OVERDUE: 'Overdue', AT_RISK: 'At risk', ON_TRACK: 'On track' };
export const RISK_REASON = {
  PROJECTED_LATE: 'PROJECTED_LATE',
  STALLED: 'STALLED',
  REVISED: 'REVISED',
  FLAGGED: 'FLAGGED',
};
export const RISK_REASON_LABEL = {
  PROJECTED_LATE: 'Projected past due at the current pace',
  STALLED: 'No stage moved over the last updates',
  REVISED: 'Vendor revised the completion date later',
  FLAGGED: 'Coordinator flagged at risk / delayed',
};

export const FLAG = { ON_TRACK: 'ON_TRACK', AT_RISK: 'AT_RISK', DELAYED: 'DELAYED', ON_HOLD: 'ON_HOLD' };
export const FLAG_LABEL = { ON_TRACK: 'On track', AT_RISK: 'At risk', DELAYED: 'Delayed', ON_HOLD: 'On hold' };

export const ISSUE_CATEGORY = {
  NONE: 'NONE',
  AWAITING_FABRIC: 'AWAITING_FABRIC',
  AWAITING_TRIMS: 'AWAITING_TRIMS',
  AWAITING_PACKING: 'AWAITING_PACKING',
  AWAITING_REPLACEMENT_PANELS: 'AWAITING_REPLACEMENT_PANELS',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  LABOUR_SHORTAGE: 'LABOUR_SHORTAGE',
  MACHINE_BREAKDOWN: 'MACHINE_BREAKDOWN',
  POWER_OUTAGE: 'POWER_OUTAGE',
  QUALITY_REWORK: 'QUALITY_REWORK',
  VENDOR_CAPACITY: 'VENDOR_CAPACITY',
  OTHER: 'OTHER',
};
export const ISSUE_CATEGORY_LABEL = {
  NONE: 'No issue',
  AWAITING_FABRIC: 'Awaiting fabric (not sent by us)',
  AWAITING_TRIMS: 'Awaiting trims (not sent by us)',
  AWAITING_PACKING: 'Awaiting packing material',
  AWAITING_REPLACEMENT_PANELS: 'Awaiting replacement panels',
  AWAITING_APPROVAL: 'Awaiting approval (sample / PP)',
  LABOUR_SHORTAGE: 'Labour shortage',
  MACHINE_BREAKDOWN: 'Machine breakdown',
  POWER_OUTAGE: 'Power outage',
  QUALITY_REWORK: 'Quality rework',
  VENDOR_CAPACITY: 'Vendor capacity',
  OTHER: 'Other',
};

export const SOURCE = { CALL: 'CALL', VISIT: 'VISIT', VENDOR_MESSAGE: 'VENDOR_MESSAGE' };
export const SOURCE_LABEL = { CALL: 'Phone call', VISIT: 'Visit', VENDOR_MESSAGE: 'Vendor message' };

export const RECEIPT_STATUS = { POSTED: 'POSTED', CANCELLED: 'CANCELLED' };
export const RECEIPT_STATUS_LABEL = { POSTED: 'Posted', CANCELLED: 'Cancelled' };
export const REJECT_SOURCE = {
  VENDOR_WORKMANSHIP: 'VENDOR_WORKMANSHIP',
  FABRIC: 'FABRIC',
  CUTTING: 'CUTTING',
  TRIM: 'TRIM',
  OTHER: 'OTHER',
};
export const REJECT_SOURCE_LABEL = {
  VENDOR_WORKMANSHIP: 'Vendor workmanship',
  FABRIC: 'Fabric defect',
  CUTTING: 'Cutting defect',
  TRIM: 'Trim defect',
  OTHER: 'Other',
};

export const PULLBACK_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SETTLED: 'SETTLED',
  REJECTED: 'REJECTED',
  REFERRED_BACK: 'REFERRED_BACK',
  CANCELLED: 'CANCELLED',
};
export const PULLBACK_STATUS_LABEL = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved — goods coming back',
  SETTLED: 'Settled',
  REJECTED: 'Rejected',
  REFERRED_BACK: 'Referred back',
  CANCELLED: 'Cancelled',
};
export const OPEN_PULLBACK_STATUSES = [
  PULLBACK_STATUS.DRAFT, PULLBACK_STATUS.PENDING_APPROVAL, PULLBACK_STATUS.APPROVED, PULLBACK_STATUS.REFERRED_BACK,
];
export const PULLBACK_REASON = {
  SLOW_PROGRESS: 'SLOW_PROGRESS',
  SHIP_DATE_RISK: 'SHIP_DATE_RISK',
  QUALITY: 'QUALITY',
  VENDOR_CAPACITY: 'VENDOR_CAPACITY',
  OTHER: 'OTHER',
};
export const PULLBACK_REASON_LABEL = {
  SLOW_PROGRESS: 'Vendor is slow',
  SHIP_DATE_RISK: 'Ship date at risk',
  QUALITY: 'Quality problems',
  VENDOR_CAPACITY: 'Vendor capacity',
  OTHER: 'Other',
};
export const RETURN_STATUS = { DRAFT: 'DRAFT', POSTED: 'POSTED', CANCELLED: 'CANCELLED' };
export const RETURN_STATUS_LABEL = { DRAFT: 'Draft', POSTED: 'Posted', CANCELLED: 'Cancelled' };
export const DAMAGE_SOURCE = { VENDOR: 'VENDOR', TRANSIT: 'TRANSIT', FABRIC: 'FABRIC', OTHER: 'OTHER' };
export const DAMAGE_SOURCE_LABEL = { VENDOR: 'Vendor', TRANSIT: 'Transit', FABRIC: 'Fabric', OTHER: 'Other' };
export const SETTLE_ACTION = { BACK_TO_VENDOR: 'BACK_TO_VENDOR', WRITE_OFF: 'WRITE_OFF' };
export const SETTLE_ACTION_LABEL = { BACK_TO_VENDOR: 'Back to vendor', WRITE_OFF: 'Write off' };

/**
 * Which part of a vendor PO a pulled-back piece comes off: CUT on a Cutting PO, SEW / FIN on a Work
 * Order or a vendor Finishing PO, PROCESS on a Cut Panel / Garment Process PO.
 */
export const WITHDRAWAL_KIND = { CUT: 'CUT', SEW: 'SEW', FIN: 'FIN', PROCESS: 'PROCESS' };

export const MATERIAL_KIND = { FABRIC: 'FABRIC', TRIM: 'TRIM', PACKING: 'PACKING' };
export const MATERIAL_KIND_LABEL = { FABRIC: 'Fabric', TRIM: 'Trims', PACKING: 'Packing' };
export const MATERIAL_CONDITION = { GOOD: 'GOOD', DAMAGED: 'DAMAGED' };
export const MATERIAL_CONDITION_LABEL = { GOOD: 'Good — back to stock', DAMAGED: 'Damaged — recorded only' };

/** Company default split of a CMT rate (decision 12); a vendor that did not cut gets 0 / rescaled. */
export const DEFAULT_STAGE_SHARES = { cut: 15, sew: 60, fin: 25 };
/** Working days kept clear before the ship date when suggesting a pull-back. */
export const PULLBACK_SHIP_BUFFER_DAYS = 3;
