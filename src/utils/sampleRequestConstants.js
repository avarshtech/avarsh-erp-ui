// Sample Request (SR) module constants — PRD v3.0.
// Sample TYPES are user-defined master data (see srService.listSampleTypes), not an enum.

export const SR_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  DISPATCHED: 'DISPATCHED',
  FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
};

export const SR_STATUS_LABELS = {
  [SR_STATUS.DRAFT]: 'Draft',
  [SR_STATUS.SUBMITTED]: 'Submitted',
  [SR_STATUS.IN_PRODUCTION]: 'In Production',
  [SR_STATUS.DISPATCHED]: 'Dispatched',
  [SR_STATUS.FEEDBACK_RECEIVED]: 'Feedback Received',
  [SR_STATUS.APPROVED]: 'Approved',
  [SR_STATUS.REJECTED]: 'Rejected',
  [SR_STATUS.REVISION_REQUIRED]: 'Revision Required',
};

export const getSrStatusLabel = (s) => SR_STATUS_LABELS[s] || (s || '').replace(/_/g, ' ');

// PRD v3 §14 — the only backward transition is Submitted → Draft.
export const SR_TRANSITIONS = {
  [SR_STATUS.DRAFT]: [SR_STATUS.SUBMITTED],
  [SR_STATUS.SUBMITTED]: [SR_STATUS.IN_PRODUCTION, SR_STATUS.DRAFT],
  [SR_STATUS.IN_PRODUCTION]: [SR_STATUS.DISPATCHED],
  [SR_STATUS.DISPATCHED]: [SR_STATUS.FEEDBACK_RECEIVED],
  [SR_STATUS.FEEDBACK_RECEIVED]: [SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED],
  [SR_STATUS.APPROVED]: [],
  [SR_STATUS.REJECTED]: [],
  [SR_STATUS.REVISION_REQUIRED]: [],
};

export const SR_ACTIVE_STATUSES = [
  SR_STATUS.DRAFT, SR_STATUS.SUBMITTED, SR_STATUS.IN_PRODUCTION, SR_STATUS.DISPATCHED,
];

export const isSrEditable = (s) => s === SR_STATUS.DRAFT;
export const isSrDeletable = (s) => s === SR_STATUS.DRAFT;

// ── Buyer comment decisions (PRD §8.5) ──
export const FEEDBACK_DECISIONS = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  APPROVED_WITH_COMMENTS: 'APPROVED_WITH_COMMENTS',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
};

export const FEEDBACK_DECISION_LABELS = {
  [FEEDBACK_DECISIONS.APPROVED]: 'Approved',
  [FEEDBACK_DECISIONS.REJECTED]: 'Rejected',
  [FEEDBACK_DECISIONS.APPROVED_WITH_COMMENTS]: 'Approved with Comments',
  [FEEDBACK_DECISIONS.REVISION_REQUIRED]: 'Revision Required',
};

export const FEEDBACK_DECISION_OPTIONS = Object.entries(FEEDBACK_DECISION_LABELS)
  .map(([value, label]) => ({ value, label }));

// Decision → resulting SR status (Feedback Received routes immediately, PRD §14)
export const DECISION_TO_STATUS = {
  [FEEDBACK_DECISIONS.APPROVED]: SR_STATUS.APPROVED,
  [FEEDBACK_DECISIONS.REJECTED]: SR_STATUS.REJECTED,
  [FEEDBACK_DECISIONS.APPROVED_WITH_COMMENTS]: SR_STATUS.APPROVED,
  [FEEDBACK_DECISIONS.REVISION_REQUIRED]: SR_STATUS.REVISION_REQUIRED,
};

// ── Dispatch (PRD §8.4) ──
export const DELIVERY_METHODS = { COURIER: 'COURIER', LOCAL_HAND: 'LOCAL_HAND' };

export const DELIVERY_METHOD_LABELS = {
  [DELIVERY_METHODS.COURIER]: 'Courier',
  [DELIVERY_METHODS.LOCAL_HAND]: 'Local / Hand Delivery',
};

export const DISPATCH_MODES = ['AIR', 'SEA', 'ROAD', 'HAND_CARRY'];

export const DISPATCH_MODE_LABELS = {
  AIR: 'Air', SEA: 'Sea', ROAD: 'Road', HAND_CARRY: 'Hand Carry',
};

export const DISPATCH_MODE_OPTIONS = DISPATCH_MODES.map((m) => ({ value: m, label: DISPATCH_MODE_LABELS[m] }));

export const SR_PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
];

// ── Commercial invoice (PRD §10) ──
export const SAMPLE_INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  DISPATCHED: 'DISPATCHED',
  CANCELLED: 'CANCELLED',
};

export const SAMPLE_INVOICE_STATUS_LABELS = {
  [SAMPLE_INVOICE_STATUS.DRAFT]: 'Draft',
  [SAMPLE_INVOICE_STATUS.ISSUED]: 'Issued',
  [SAMPLE_INVOICE_STATUS.DISPATCHED]: 'Dispatched',
  [SAMPLE_INVOICE_STATUS.CANCELLED]: 'Cancelled',
};

export const getInvoiceStatusLabel = (s) => SAMPLE_INVOICE_STATUS_LABELS[s] || (s || '').replace(/_/g, ' ');

// Fixed print text (PRD §10.6) — the declaration paragraph itself lives in the
// Company Profile so the CHA can revert it without a code change.
export const SAMPLE_DECLARATION_BAND = 'SAMPLES ONLY — NOT FOR SALE — NO COMMERCIAL VALUE';
