/**
 * Time & Action constants (CR-TNA-001). Mirrors of the values the engine and, in Round 2,
 * the /api/v1/tna endpoints return — statuses, health, lanes, attribution, exceptions.
 */
import dayjs from 'dayjs';
import { DATE_FORMAT, DATE_TIME_FORMAT } from './uiConstants';
import { getCurrentUser } from './permissions';

// ── Activity status (§10, FR-7.1) ───────────────────────────────────────────
export const ACTIVITY_STATUS = {
  NOT_STARTED: { color: 'default', label: 'Not started' },
  IN_PROGRESS: { color: 'processing', label: 'In progress' },
  DUE_SOON: { color: 'gold', label: 'Due soon' },
  OVERDUE: { color: 'red', label: 'Overdue' },
  COMPLETED_ON_TIME: { color: 'green', label: 'Completed on time' },
  COMPLETED_LATE: { color: 'orange', label: 'Completed late' },
};

// ── Order health (§11.6) ────────────────────────────────────────────────────
export const HEALTH = {
  GREEN: { color: 'green', label: 'Green', meaning: 'Forecast on or before the commitment; nothing critical overdue' },
  AMBER: { color: 'gold', label: 'Amber', meaning: 'At risk — a critical activity is overdue or float is at the warning threshold' },
  RED: { color: 'red', label: 'Red', meaning: 'The forecast dispatch is past the commitment' },
  INFEASIBLE: { color: 'magenta', label: 'Infeasible', meaning: 'The commitment was never achievable with every dependency respected' },
  BLOCKED: { color: 'default', label: 'Blocked', meaning: 'Not planned — a blocking exception prevents generation' },
};

// ── Feasibility at generation (§9.4) ────────────────────────────────────────
export const FEASIBILITY = {
  FEASIBLE: { color: 'green', label: 'Feasible' },
  FEASIBLE_TIGHT: { color: 'gold', label: 'Feasible — tight' },
  INFEASIBLE: { color: 'red', label: 'Infeasible' },
};

export const PLAN_STATUS = {
  ACTIVE: { color: 'processing', label: 'Active' },
  INFEASIBLE: { color: 'magenta', label: 'Generated — not activated' },
  BLOCKED: { color: 'default', label: 'Blocked — not planned' },
  CLOSED: { color: 'green', label: 'Closed' },
  CANCELLED: { color: 'default', label: 'Cancelled' },
  NOT_PLANNED: { color: 'default', label: 'Not planned' },
};

// ── Swimlanes by owning source module (WF-04, FR-6.5) ───────────────────────
export const LANES = [
  { key: 'ORDER_PURCHASE', label: 'Order Entry / Purchase' },
  { key: 'SAMPLING', label: 'Sampling & buyer approvals' },
  { key: 'STORE_QC', label: 'Store & QC' },
  { key: 'PRE_PRODUCTION', label: 'Pre-production' },
  { key: 'CUTTING', label: 'Cutting & cut panel (order-specific sequence)' },
  { key: 'SEWING', label: 'Sewing & garment process (order-specific sequence)' },
  { key: 'FINISHING_SHIPMENT', label: 'Finishing & shipment' },
];

export const DAY_TYPE = {
  WD: { label: 'Working', color: 'green', hint: 'Factory-controlled execution — counts working days only' },
  CD: { label: 'Calendar', color: 'blue', hint: 'Buyer or supplier elapsed wait — counts every day' },
};

// ── Delay attribution (§11.5) ───────────────────────────────────────────────
export const ATTRIBUTION = {
  BUYER: { label: 'Buyer — approval turnaround', color: 'purple' },
  SUPPLIER: { label: 'Supplier — material availability', color: 'volcano' },
  SUBCONTRACTOR: { label: 'Subcontractor — process turnaround', color: 'orange' },
  INTERNAL_PRE_PRODUCTION: { label: 'Internal — pre-production', color: 'geekblue' },
  INTERNAL_PRODUCTION: { label: 'Internal — production', color: 'blue' },
  QUALITY: { label: 'Quality — inspection or test fail', color: 'red' },
  SCOPE_ADDENDUM: { label: 'Post-baseline addendum', color: 'cyan' },
  REASON_UNAVAILABLE: { label: 'Reason unavailable', color: 'default' },
};

// ── Where each activity's completion event comes from (§6) ──────────────────
export const SOURCE_STATUS = {
  LIVE: { color: 'green', label: 'Live', hint: 'The source record exists in the ERP today' },
  PROPOSED: { color: 'purple', label: 'Proposed', hint: 'Source-screen enhancement approved for Round 2; simulated in the mock' },
  MISSING: { color: 'orange', label: 'Awaiting source', hint: 'No source event yet — never reopened for manual entry (FR-6.7)' },
};

export const DURATION_SOURCE = {
  GLOBAL: 'Global activity master',
  PRODUCT_TYPE: 'Product-type master',
  BUYER_PRODUCT_TYPE: 'Buyer + product-type master',
};

// ── Exceptions and data quality (§11.7, FR-10.5) ────────────────────────────
export const SEVERITY = {
  BLOCK: { color: 'red', label: 'Block' },
  WARN: { color: 'gold', label: 'Warn' },
};

export const EXCEPTION_TYPE = {
  IDENTITY_UNRESOLVED: 'Identity unresolved',
  MISSING_MANDATORY_INPUT: 'Missing mandatory input',
  INFEASIBLE_COMMITMENT: 'Infeasible commitment',
  PROVISIONAL_ACTIVITIES: 'Provisional activities',
  POST_BASELINE_ADDENDUM: 'Late-added requirement',
  AWAITING_SOURCE: 'Awaiting source enhancement',
  QUALITY_REJECTION: 'Quality rejection',
  RECONCILIATION_MISMATCH: 'Reconciliation mismatch',
  DATA_ISSUE_REPORTED: 'Data issue reported',
  EVENT_RETRY_EXHAUSTED: 'Event retry exhausted',
};

export const EXCEPTION_STATUS = {
  OPEN: { color: 'processing', label: 'Open' },
  ACKNOWLEDGED: { color: 'purple', label: 'Acknowledged' },
  RESOLVED: { color: 'green', label: 'Resolved' },
};

export const SYNC_STATE = {
  HEALTHY: { color: 'green', label: 'Healthy' },
  STALE: { color: 'gold', label: 'Stale' },
  IDLE: { color: 'default', label: 'No events yet' },
  FAILING: { color: 'red', label: 'Failing' },
};

export const CHANGE_TYPE = {
  GENERATION: { color: 'blue', label: 'Plan generated' },
  SYSTEM_DERIVED: { color: 'default', label: 'System-derived' },
  SOURCE_AMENDED: { color: 'orange', label: 'Source amended' },
  COMMITMENT_REVISION: { color: 'purple', label: 'Commitment revision' },
  PARTIAL_PROGRESS: { color: 'cyan', label: 'Partial progress' },
  ACKNOWLEDGEMENT: { color: 'magenta', label: 'Acknowledgement' },
};

export const DELAY_BASIS = [
  { value: 'latest', label: 'Latest commitment' },
  { value: 'original', label: 'Original commitment' },
];

/** Owning source modules — My Activities filter and the Masters "source screen" column. */
export const SOURCE_MODULES = [
  'Order Entry', 'BOM', 'Purchase', 'Sampling', 'Stores', 'QC', 'Cutting', 'Cut Panel', 'Sewing',
  'Garment Process', 'Finishing', 'Packing', 'Production', 'Orders',
];

/** Source-module screens a T&A row deep-links to (FR-8.6). */
export const SOURCE_ROUTES = {
  'Order Entry': '/orders/list', Orders: '/orders/list', BOM: '/bom/list', Purchase: '/purchase-orders/list',
  Sampling: '/sample-requests/list', Stores: '/inventory/grn/list', QC: '/inventory/qc', Cutting: '/production/cutting',
  'Cut Panel': '/bom/cut-panel/list', Sewing: '/production/sewing', 'Garment Process': '/bom/garment-process/list',
  Packing: '/production/packing/list', Production: '/production/cutting',
};

/** Width of the activity-name column on the timeline (WF-03). */
export const GANTT_LABEL_W = 230;

// ── Formatting ──────────────────────────────────────────────────────────────
export const fmtDate = (iso) => (iso ? dayjs(iso).format(DATE_FORMAT) : '—');
export const fmtDateTime = (at) => (at ? dayjs(at.replace(' ', 'T')).format(DATE_TIME_FORMAT) : '—');

/** Source texts (reasons, exception details) carry ISO dates; show them as dd-MMM-yyyy. */
export const fmtText = (text) => (text ? String(text).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => fmtDate(d)) : text);

/** "+20 CD" / "−14 CD" / "0 CD"; null renders as an em dash, never as zero (§11.1). */
export const signedDays = (n, unit = 'CD') => {
  if (n == null) return '—';
  if (n === 0) return `0 ${unit}`;
  return `${n > 0 ? '+' : '−'}${Math.abs(n)} ${unit}`;
};

export const currentUserName = () => {
  const u = getCurrentUser();
  return u?.fullName || u?.name || u?.username || 'Current user';
};
