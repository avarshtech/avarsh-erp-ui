/**
 * TNA (Time & Action) module constants — statuses per BRD §12, workflow states
 * per §13, reason codes per §13.2, groups/source modules per §7.1/§11.
 */
import {
  ClockCircleOutlined, BellOutlined, WarningOutlined, FireOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';

// ── Activity status (§12.2) ─────────────────────────────────────────────────
export const ACTIVITY_STATUS = {
  NOT_STARTED: { color: 'default', label: 'Not Started', icon: ClockCircleOutlined },
  DUE_SOON: { color: 'gold', label: 'Due Soon', icon: BellOutlined },
  OVERDUE: { color: 'orange', label: 'Overdue', icon: WarningOutlined },
  OVERDUE_CRITICAL: { color: 'red', label: 'Overdue — Critical', icon: FireOutlined },
  COMPLETED_ON_TIME: { color: 'green', label: 'On Time', icon: CheckCircleOutlined },
  COMPLETED_LATE: { color: 'volcano', label: 'Completed Late', icon: ExclamationCircleOutlined },
};

// ── Order-level RAG (§12.3) ─────────────────────────────────────────────────
export const RAG = {
  GREEN: { color: 'var(--success-color)', label: 'On Track', tag: 'green' },
  AMBER: { color: 'var(--warning-color)', label: 'At Risk', tag: 'gold' },
  RED: { color: 'var(--error-color)', label: 'Delayed', tag: 'red' },
};

// ── Feasibility (§8.8) ──────────────────────────────────────────────────────
export const FEASIBILITY = {
  FEASIBLE: { color: 'green', label: 'Feasible' },
  FEASIBLE_COMPRESSED: { color: 'gold', label: 'Feasible — Compressed' },
  INFEASIBLE: { color: 'red', label: 'Infeasible' },
};

// ── Plan status (§10.1) ─────────────────────────────────────────────────────
export const PLAN_STATUS = {
  DRAFT: { color: 'default', label: 'Draft' },
  ACTIVE: { color: 'processing', label: 'Active' },
  ON_HOLD: { color: 'orange', label: 'On Hold' },
  COMPLETED: { color: 'green', label: 'Completed' },
  CANCELLED: { color: 'default', label: 'Cancelled' },
};

// ── Re-plan workflow (§13.1) ────────────────────────────────────────────────
export const REPLAN_STATUS = {
  DRAFT: { color: 'default', label: 'Draft' },
  PENDING_APPROVAL: { color: 'processing', label: 'Pending Approval' },
  APPROVED: { color: 'green', label: 'Approved' },
  REJECTED: { color: 'red', label: 'Rejected' },
  RETURNED: { color: 'orange', label: 'Returned' },
};

// ── Re-plan reason codes (§13.2) ────────────────────────────────────────────
export const REPLAN_REASONS = [
  'Buyer approval delay', 'Fabric delay', 'Trim delay', 'Capacity constraint',
  'Quality rejection', 'Buyer amendment', 'Internal delay', 'Force majeure',
];

// ── Activity groups (§7.1) — drives swim-lane + dashboard grouping ─────────
export const ACTIVITY_GROUPS = ['Order', 'Material', 'Sampling', 'Approval', 'Quality', 'Production', 'Shipment'];
export const GROUP_COLORS = {
  Order: '#6366f1', Material: '#0ea5e9', Sampling: '#8b5cf6', Approval: '#f59e0b',
  Quality: '#14b8a6', Production: '#10b981', Shipment: '#64748b',
};

// ── Source modules (§7.1 / §11) ─────────────────────────────────────────────
export const SOURCE_MODULES = ['Order', 'Purchase', 'Sampling', 'Store', 'Production', 'QC', 'Shipment', 'Manual'];

// Deviation beyond this many days requires a remark (VR-12, Q7 assumption)
export const DEVIATION_REMARK_THRESHOLD = 3;

export const statusLabel = (status, config) => config?.[status]?.label ?? status;
