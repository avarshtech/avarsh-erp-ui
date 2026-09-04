// Sample Request (SR) module constants — PRD v3.0 + process-flow revision R2.

/**
 * FIXED sample-type list (R2): exactly these eight, fixed ids — no user-created
 * types ("Others" covers ad-hoc cases). The mock master seeds verbatim from
 * this constant; substitution default: Proto/Fit allowed, everything else not.
 */
export const SAMPLE_TYPE_LIST = [
  { id: 1, name: 'Proto', colourSubstitutionDefault: true },
  { id: 2, name: 'Fit', colourSubstitutionDefault: true },
  { id: 3, name: 'Size Set', colourSubstitutionDefault: false },
  { id: 4, name: 'Photoshoot Sample', colourSubstitutionDefault: false },
  { id: 5, name: 'PP Sample', colourSubstitutionDefault: false },
  { id: 6, name: 'Shipment Sample', colourSubstitutionDefault: false },
  { id: 7, name: 'SMS', colourSubstitutionDefault: false },
  { id: 8, name: 'Others', colourSubstitutionDefault: false },
];

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

/** "Rev 2" for a revision; nothing for a first request, which is not "Rev 0" to anyone. */
export const srRevisionLabel = (sr) => (sr?.revisionNo > 0 ? `Rev ${sr.revisionNo}` : '');

/**
 * Which sample types a BOM already carries, keyed by sample type id, each holding
 * the LATEST request for that type. An order has one sample of each type at a
 * time, so the latest row is what decides: open → taken, approved → closed,
 * canRaiseRevision → re-made through a revision rather than a new request.
 * `excludeId` is the request being edited, which must not count against itself.
 * Rows arrive oldest first, so the last write per type is the latest.
 */
export const sampleTypeAvailability = (existingRequests = [], excludeId = null) => {
  const latest = new Map();
  existingRequests.forEach((r) => {
    if (r.id !== excludeId && r.sampleTypeId != null) latest.set(r.sampleTypeId, r);
  });
  return latest;
};

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

// ── Deadline revision ──
// A draft is simply edited; once submitted the originals are frozen and a later agreement is
// held beside them as a revision (revisedDispatchDeadline / revisedBuyerApprovalDeadline), which
// the order the sample was raised for picks up on its own dispatch date. Past dispatch the
// deadline is history, not something to agree.
export const SR_DEADLINE_REVISABLE_STATUSES = [SR_STATUS.SUBMITTED, SR_STATUS.IN_PRODUCTION];
export const canReviseSrDeadline = (s) => SR_DEADLINE_REVISABLE_STATUSES.includes(s);

/** The deadline the team is tracking to: the revised one once agreed, else the original. */
export const getEffectiveDispatchDeadline = (sr) => sr?.revisedDispatchDeadline || sr?.dispatchDeadline || null;
export const getEffectiveBuyerApprovalDeadline = (sr) => sr?.revisedBuyerApprovalDeadline || sr?.buyerApprovalDeadline || null;
export const isSrDeadlineRevised = (sr) => Boolean(sr?.revisedDispatchDeadline || sr?.revisedBuyerApprovalDeadline);

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

// ── Dispatch entity (R2: one dispatch groups many SRs to one customer) ──
export const DISPATCH_STATUS = { DRAFT: 'DRAFT', DISPATCHED: 'DISPATCHED' };

export const DISPATCH_STATUS_LABELS = {
  [DISPATCH_STATUS.DRAFT]: 'Draft',
  [DISPATCH_STATUS.DISPATCHED]: 'Dispatched',
};

export const getDispatchStatusLabel = (s) => DISPATCH_STATUS_LABELS[s] || (s || '').replace(/_/g, ' ');

// ── Invoice types (R2): COMMERCIAL = customs doc BEFORE dispatch;
// SAMPLE = chargeable recovery invoice AFTER dispatch (non-converted samples) ──
export const INVOICE_TYPES = { COMMERCIAL: 'COMMERCIAL', SAMPLE: 'SAMPLE' };

export const INVOICE_TYPE_LABELS = {
  [INVOICE_TYPES.COMMERCIAL]: 'Commercial Invoice',
  [INVOICE_TYPES.SAMPLE]: 'Sample Invoice',
};

export const INVOICE_TYPE_SERIES = { [INVOICE_TYPES.COMMERCIAL]: 'EXSG', [INVOICE_TYPES.SAMPLE]: 'SA' };

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
