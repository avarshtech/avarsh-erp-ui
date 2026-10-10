import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UndoOutlined,
  StopOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  WarningOutlined,
  SwapOutlined,
  AuditOutlined,
} from '@ant-design/icons';

import { ORDER_STATUS } from './orderConstants';
import { PO_STATUS } from './poStatusConstants';
import { BOM_STATUS } from './bomConstants';
import { GRN_STATUS, QC_STATUS, STOCK_STATUS } from './inventoryConstants';
import { PROD_PO_STATUS } from './productionConstants';
import { SR_STATUS, SAMPLE_INVOICE_STATUS } from './sampleRequestConstants';
import {
  PACKING_ENTRY_STATUS,
  PL_STATUS,
  INVOICE_STATUS,
  TEMPLATE_STATUS,
  SHIPMENT_STATUS,
} from './expDocConstants';
import { MAPPING_STATUS } from './poOrderMappingConstants';
import { REQUIREMENT_STATUS } from './requirementStatus';
import { JW_PO_STATUS } from './jobWorkPoStatus';
import {
  FLAG, JOB_STATUS, PULLBACK_STATUS, RECEIPT_STATUS, RETURN_STATUS, RISK,
} from './jobWorkTracker/constants';
import {
  INWARD_STATUS, JO_STATUS, RETURN_STATUS as INWARD_RETURN_STATUS, TALLY_STATUS,
} from './jobWorkInward/inwardConstants';

// ==================== ORDER STATUS CONFIG ====================
export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]:                { color: 'default',  icon: FileTextOutlined },
  [ORDER_STATUS.CONFIRMED]:            { color: 'green',    icon: CheckCircleOutlined },
  [ORDER_STATUS.REFER_BACK_REQUESTED]: { color: 'orange',   icon: ExclamationCircleOutlined },
  [ORDER_STATUS.REFERRED_BACK]:        { color: 'orange',   icon: UndoOutlined },
  [ORDER_STATUS.CANCEL_REQUESTED]:     { color: 'red',      icon: ExclamationCircleOutlined },
  [ORDER_STATUS.IN_PRODUCTION]:        { color: 'blue',     icon: ClockCircleOutlined },
  [ORDER_STATUS.COMPLETED]:            { color: 'cyan',     icon: CheckCircleOutlined },
  [ORDER_STATUS.CANCELLED]:            { color: 'volcano',  icon: StopOutlined },
};

// ==================== COSTING STATUS CONFIG ====================
export const COSTING_STATUS_CONFIG = {
  Draft:    { color: 'default', icon: FileTextOutlined },
  Final:    { color: 'blue',    icon: SendOutlined },
  Approved: { color: 'green',   icon: CheckCircleOutlined },
  Rejected: { color: 'red',     icon: CloseCircleOutlined },
};

// ==================== PO STATUS CONFIG ====================
export const PO_STATUS_CONFIG = {
  [PO_STATUS.DRAFT]:              { color: 'default',    icon: FileTextOutlined },
  [PO_STATUS.PENDING_APPROVAL]:   { color: 'processing', icon: ClockCircleOutlined },
  [PO_STATUS.REJECTED]:           { color: 'red',        icon: CloseCircleOutlined },
  [PO_STATUS.CANCELLED]:          { color: 'volcano',    icon: StopOutlined },
  [PO_STATUS.REFERRED_BACK]:      { color: 'orange',     icon: UndoOutlined },
  [PO_STATUS.SENT_TO_SUPPLIER]:   { color: 'cyan',       icon: SendOutlined },
  [PO_STATUS.PARTIALLY_RECEIVED]: { color: 'geekblue',   icon: InboxOutlined },
  [PO_STATUS.COMPLETED]:          { color: 'green',      icon: CheckCircleOutlined },
};

// ==================== PO–ORDER MAPPING STATUS CONFIG ====================
// How much of a General PO has been linked to customer orders (see poOrderMappingConstants).
export const PO_ORDER_MAPPING_STATUS_CONFIG = {
  [MAPPING_STATUS.UNMAPPED]:   { color: 'orange',  icon: ExclamationCircleOutlined },
  [MAPPING_STATUS.PARTIAL]:    { color: 'blue',    icon: SwapOutlined },
  [MAPPING_STATUS.MAPPED]:     { color: 'green',   icon: CheckCircleOutlined },
  [MAPPING_STATUS.STOCK_ONLY]: { color: 'default', icon: InboxOutlined },
};

// ==================== BOM STATUS CONFIG ====================
export const BOM_STATUS_CONFIG = {
  [BOM_STATUS.DRAFT]:   { color: 'default', icon: FileTextOutlined },
  [BOM_STATUS.CREATED]: { color: 'green',   icon: CheckCircleOutlined },
};

// ==================== PROCESS REQUIREMENT STATUS CONFIG ====================
// Cut Panel Requirement + Garment Process Requirement share one lifecycle
// (utils/requirementStatus.js). No approval: Submitted is the PO-visible state.
export const REQUIREMENT_STATUS_CONFIG = {
  [REQUIREMENT_STATUS.DRAFT]:          { color: 'default',    icon: FileTextOutlined },
  [REQUIREMENT_STATUS.SUBMITTED]:      { color: 'processing', icon: SendOutlined },
  [REQUIREMENT_STATUS.PARTIALLY_USED]: { color: 'warning',    icon: ClockCircleOutlined },
  [REQUIREMENT_STATUS.FULLY_USED]:     { color: 'success',    icon: CheckCircleOutlined },
  [REQUIREMENT_STATUS.CLOSED]:         { color: 'default',    icon: StopOutlined },
};

// ==================== JOB-WORK PO STATUS CONFIG ====================
// Cut Panel PO + Garment Process PO (utils/jobWorkPoStatus.js).
export const JOB_WORK_PO_STATUS_CONFIG = {
  [JW_PO_STATUS.DRAFT]:               { color: 'default',    icon: FileTextOutlined },
  [JW_PO_STATUS.SUBMITTED]:           { color: 'processing', icon: ClockCircleOutlined },
  [JW_PO_STATUS.APPROVED]:            { color: 'blue',       icon: SafetyCertificateOutlined },
  [JW_PO_STATUS.SENT_TO_VENDOR]:      { color: 'cyan',       icon: SendOutlined },
  [JW_PO_STATUS.PARTIALLY_COMPLETED]: { color: 'geekblue',   icon: InboxOutlined },
  [JW_PO_STATUS.COMPLETED]:           { color: 'green',      icon: CheckCircleOutlined },
  [JW_PO_STATUS.CLOSED]:              { color: 'default',    icon: StopOutlined },
  [JW_PO_STATUS.REJECTED]:            { color: 'red',        icon: CloseCircleOutlined },
  [JW_PO_STATUS.CANCELLED]:           { color: 'volcano',    icon: StopOutlined },
};

// ==================== JOB WORK TRACKER (outsourced jobs, UI mock round 1) ====================
export const JOB_WORK_JOB_STATUS_CONFIG = {
  [JOB_STATUS.OPEN]:        { color: 'default',    icon: FileTextOutlined },
  [JOB_STATUS.IN_PROGRESS]: { color: 'processing', icon: ClockCircleOutlined },
  [JOB_STATUS.COMPLETED]:   { color: 'green',      icon: CheckCircleOutlined },
  [JOB_STATUS.CLOSED]:      { color: 'default',    icon: StopOutlined },
  [JOB_STATUS.CANCELLED]:   { color: 'volcano',    icon: StopOutlined },
};

export const JOB_WORK_RISK_CONFIG = {
  [RISK.OVERDUE]:  { color: 'red',    icon: ExclamationCircleOutlined },
  [RISK.AT_RISK]:  { color: 'orange', icon: WarningOutlined },
  [RISK.ON_TRACK]: { color: 'green',  icon: CheckCircleOutlined },
};

export const JOB_WORK_FLAG_CONFIG = {
  [FLAG.ON_TRACK]: { color: 'green' },
  [FLAG.AT_RISK]:  { color: 'orange' },
  [FLAG.DELAYED]:  { color: 'red' },
  [FLAG.ON_HOLD]:  { color: 'default' },
};

export const JOB_WORK_RECEIPT_STATUS_CONFIG = {
  [RECEIPT_STATUS.POSTED]:    { color: 'green',   icon: InboxOutlined },
  [RECEIPT_STATUS.CANCELLED]: { color: 'volcano', icon: StopOutlined },
};

export const JOB_WORK_PULLBACK_STATUS_CONFIG = {
  [PULLBACK_STATUS.DRAFT]:            { color: 'default',    icon: FileTextOutlined },
  [PULLBACK_STATUS.PENDING_APPROVAL]: { color: 'processing', icon: ClockCircleOutlined },
  [PULLBACK_STATUS.APPROVED]:         { color: 'blue',       icon: SwapOutlined },
  [PULLBACK_STATUS.SETTLED]:          { color: 'green',      icon: CheckCircleOutlined },
  [PULLBACK_STATUS.REJECTED]:         { color: 'red',        icon: CloseCircleOutlined },
  [PULLBACK_STATUS.REFERRED_BACK]:    { color: 'orange',     icon: UndoOutlined },
  [PULLBACK_STATUS.CANCELLED]:        { color: 'volcano',    icon: StopOutlined },
};

export const JOB_WORK_RETURN_STATUS_CONFIG = {
  [RETURN_STATUS.DRAFT]:     { color: 'default', icon: FileTextOutlined },
  [RETURN_STATUS.POSTED]:    { color: 'green',   icon: InboxOutlined },
  [RETURN_STATUS.CANCELLED]: { color: 'volcano', icon: StopOutlined },
};

// ── Inward job work (we work for principals; UI mock round 2) ──
export const JOB_WORK_IN_ORDER_STATUS_CONFIG = {
  [JO_STATUS.AWAITING_MATERIAL]: { color: 'gold',       icon: ClockCircleOutlined },
  [JO_STATUS.IN_PRODUCTION]:     { color: 'processing', icon: ExperimentOutlined },
  [JO_STATUS.PARTLY_RETURNED]:   { color: 'cyan',       icon: SendOutlined },
  [JO_STATUS.RETURNED]:          { color: 'green',      icon: CheckCircleOutlined },
  [JO_STATUS.CLOSED]:            { color: 'default',    icon: StopOutlined },
  [JO_STATUS.CANCELLED]:         { color: 'volcano',    icon: CloseCircleOutlined },
};

/** Material In and Return to Principal documents (both cancel to CANCELLED). */
export const JOB_WORK_IN_DOC_STATUS_CONFIG = {
  [INWARD_STATUS.POSTED]:            { color: 'green',   icon: InboxOutlined },
  [INWARD_RETURN_STATUS.DISPATCHED]: { color: 'green',   icon: SendOutlined },
  [INWARD_STATUS.CANCELLED]:         { color: 'volcano', icon: StopOutlined },
};

export const JOB_WORK_IN_TALLY_STATUS_CONFIG = {
  [TALLY_STATUS.PENDING]:  { color: 'orange', icon: ClockCircleOutlined },
  [TALLY_STATUS.RECORDED]: { color: 'green',  icon: AuditOutlined },
};

// ==================== GRN STATUS CONFIG ====================
// 5-state GRN lifecycle — every state is visually distinct.
export const GRN_STATUS_CONFIG = {
  [GRN_STATUS.DRAFT]:            { color: 'default',  icon: FileTextOutlined },
  [GRN_STATUS.QC_PENDING]:       { color: 'geekblue', icon: ExperimentOutlined },
  [GRN_STATUS.PENDING_REVERSAL]: { color: 'gold',     icon: ExclamationCircleOutlined },
  [GRN_STATUS.REVERSED]:         { color: 'purple',   icon: UndoOutlined },
  [GRN_STATUS.CLOSED]:           { color: 'green',    icon: CheckCircleOutlined },
  [GRN_STATUS.CANCELLED]:        { color: 'default',  icon: StopOutlined },
};

// ==================== QC STATUS CONFIG ====================
// 9-state QC lifecycle. Every state is visually distinct.
// Conditional_Pass uses `cyan` to sit between Approved (green) and any warning
// tone — a clear "approved with qualifications" accent. Rejected_With_Backup
// uses `volcano` to differentiate from pure `red` Rejected while still reading
// as a reject-family state.
export const QC_STATUS_CONFIG = {
  [QC_STATUS.DRAFT]:                  { color: 'default',    icon: FileTextOutlined },
  [QC_STATUS.SUBMITTED]:              { color: 'processing', icon: SendOutlined },
  [QC_STATUS.PENDING_APPROVAL]:       { color: 'geekblue',   icon: AuditOutlined },
  [QC_STATUS.APPROVED]:               { color: 'green',      icon: SafetyCertificateOutlined },
  [QC_STATUS.CONDITIONAL_PASS]:       { color: 'cyan',       icon: WarningOutlined },
  [QC_STATUS.REJECTED]:               { color: 'red',        icon: CloseCircleOutlined },
  [QC_STATUS.REJECTED_WITH_BACKUP]:   { color: 'volcano',    icon: CloseCircleOutlined },
  [QC_STATUS.REFERRED_BACK_PENDING]:  { color: 'gold',       icon: ExclamationCircleOutlined },
  [QC_STATUS.REFERRED_BACK]:          { color: 'purple',     icon: UndoOutlined },
};

// ==================== STOCK STATUS CONFIG ====================
export const STOCK_STATUS_CONFIG = {
  [STOCK_STATUS.IN_STOCK]:  { color: 'green',   icon: CheckCircleOutlined },
  [STOCK_STATUS.RESERVED]:  { color: 'blue',    icon: ClockCircleOutlined },
  [STOCK_STATUS.IN_QC]:     { color: 'orange',  icon: ExperimentOutlined },
  [STOCK_STATUS.ON_HOLD]:   { color: 'gold',    icon: ExclamationCircleOutlined },
  [STOCK_STATUS.ISSUED]:    { color: 'cyan',    icon: SendOutlined },
  [STOCK_STATUS.DAMAGED]:   { color: 'red',     icon: WarningOutlined },
};

// ==================== PRODUCTION PO STATUS CONFIG ====================
// Shared by Cutting PO, Work Order (Sewing PO) and Finishing PO (PRD §7.1).
export const PRODUCTION_PO_STATUS_CONFIG = {
  [PROD_PO_STATUS.DRAFT]:            { color: 'default',    icon: FileTextOutlined },
  [PROD_PO_STATUS.PENDING_APPROVAL]: { color: 'processing', icon: ClockCircleOutlined },
  [PROD_PO_STATUS.APPROVED]:         { color: 'green',      icon: CheckCircleOutlined },
  [PROD_PO_STATUS.REJECTED]:         { color: 'red',        icon: CloseCircleOutlined },
  [PROD_PO_STATUS.CANCELLED]:        { color: 'volcano',    icon: StopOutlined },
  [PROD_PO_STATUS.REFERRED_BACK]:    { color: 'orange',     icon: UndoOutlined },
};


// ==================== SAMPLE REQUEST STATUS CONFIG ====================
export const SR_STATUS_CONFIG = {
  [SR_STATUS.DRAFT]:             { color: 'default',    icon: FileTextOutlined },
  [SR_STATUS.SUBMITTED]:         { color: 'processing', icon: SendOutlined },
  [SR_STATUS.IN_PRODUCTION]:     { color: 'blue',       icon: ClockCircleOutlined },
  [SR_STATUS.DISPATCHED]:        { color: 'cyan',       icon: SendOutlined },
  [SR_STATUS.FEEDBACK_RECEIVED]: { color: 'geekblue',   icon: AuditOutlined },
  [SR_STATUS.APPROVED]:          { color: 'green',      icon: CheckCircleOutlined },
  [SR_STATUS.REJECTED]:          { color: 'red',        icon: CloseCircleOutlined },
  [SR_STATUS.REVISION_REQUIRED]: { color: 'orange',     icon: UndoOutlined },
};

// ==================== SAMPLE DISPATCH STATUS CONFIG ====================
export const SR_DISPATCH_STATUS_CONFIG = {
  DRAFT:      { color: 'default', icon: FileTextOutlined },
  DISPATCHED: { color: 'cyan',    icon: SendOutlined },
};

// ==================== SAMPLE INVOICE STATUS CONFIG ====================
export const SAMPLE_INVOICE_STATUS_CONFIG = {
  [SAMPLE_INVOICE_STATUS.DRAFT]:      { color: 'default', icon: FileTextOutlined },
  [SAMPLE_INVOICE_STATUS.ISSUED]:     { color: 'blue',    icon: SafetyCertificateOutlined },
  [SAMPLE_INVOICE_STATUS.DISPATCHED]: { color: 'green',   icon: SendOutlined },
  [SAMPLE_INVOICE_STATUS.CANCELLED]:  { color: 'volcano', icon: StopOutlined },
};

// ==================== EXPORT DOCUMENTATION STATUS CONFIG ====================
export const PACKING_ENTRY_STATUS_CONFIG = {
  [PACKING_ENTRY_STATUS.OPEN]:      { color: 'processing', icon: InboxOutlined },
  [PACKING_ENTRY_STATUS.COMPLETED]: { color: 'green',      icon: CheckCircleOutlined },
};

export const PL_STATUS_CONFIG = {
  [PL_STATUS.DRAFT]:      { color: 'default',    icon: FileTextOutlined },
  [PL_STATUS.FINAL]:      { color: 'green',      icon: CheckCircleOutlined },
  [PL_STATUS.EXPORTED]:   { color: 'cyan',       icon: SafetyCertificateOutlined },
  [PL_STATUS.CANCELLED]:  { color: 'volcano',    icon: StopOutlined },
  [PL_STATUS.SUPERSEDED]: { color: 'default',    icon: SwapOutlined },
};

export const EXPORT_INVOICE_STATUS_CONFIG = {
  [INVOICE_STATUS.DRAFT]:      { color: 'default',    icon: FileTextOutlined },
  [INVOICE_STATUS.FINAL]:      { color: 'green',      icon: CheckCircleOutlined },
  [INVOICE_STATUS.EXPORTED]:   { color: 'cyan',       icon: SafetyCertificateOutlined },
  [INVOICE_STATUS.CANCELLED]:  { color: 'volcano',    icon: StopOutlined },
  [INVOICE_STATUS.SUPERSEDED]: { color: 'default',    icon: SwapOutlined },
};

export const TEMPLATE_STATUS_CONFIG = {
  [TEMPLATE_STATUS.DRAFT]:   { color: 'default', icon: FileTextOutlined },
  [TEMPLATE_STATUS.ACTIVE]:  { color: 'green',   icon: CheckCircleOutlined },
  [TEMPLATE_STATUS.RETIRED]: { color: 'default', icon: StopOutlined },
};

export const SHIPMENT_STATUS_CONFIG = {
  [SHIPMENT_STATUS.OPEN]:   { color: 'processing', icon: InboxOutlined },
  [SHIPMENT_STATUS.CLOSED]: { color: 'cyan',       icon: SafetyCertificateOutlined },
};

// ==================== STATUS FLOW (for StatusSteps) ====================
export const ORDER_STATUS_FLOW = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'];
export const PO_STATUS_FLOW = ['Draft', 'Pending_Approval', 'Sent_To_Supplier', 'Partially_Received', 'Completed'];
export const COSTING_STATUS_FLOW = ['Draft', 'Final', 'Approved', 'Rejected'];
export const BOM_STATUS_FLOW = ['DRAFT', 'CREATED'];
export const GRN_STATUS_FLOW = ['Draft', 'Submitted', 'QC_Pending', 'QC_Complete', 'Closed'];
export const QC_STATUS_FLOW = ['Draft', 'Submitted', 'Pending_Approval', 'Approved', 'Conditional_Pass'];
export const PRODUCTION_PO_STATUS_FLOW = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];
// SR flow base — the terminal step (APPROVED / REJECTED / REVISION_REQUIRED) is
// appended dynamically in SampleRequestView based on the record's outcome.
export const SR_STATUS_FLOW_BASE = ['DRAFT', 'SUBMITTED', 'IN_PRODUCTION', 'DISPATCHED', 'FEEDBACK_RECEIVED'];
// Export documents share one happy path. CANCELLED and SUPERSEDED are outcomes, not
// steps, so they stay off the flow and show as a status tag instead.
export const PL_STATUS_FLOW = ['DRAFT', 'FINAL', 'EXPORTED'];
export const EXPORT_INVOICE_STATUS_FLOW = ['DRAFT', 'FINAL', 'EXPORTED'];
export const REQUIREMENT_STATUS_FLOW = ['DRAFT', 'SUBMITTED', 'PARTIALLY_USED', 'FULLY_USED'];
// Rejected and Cancelled are outcomes, shown as the status tag rather than a step.
export const JOB_WORK_PO_STATUS_FLOW = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_VENDOR', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CLOSED'];
// CLOSED is an outcome, appended like the SR terminal step: a closed requirement's flow
// ends where it was closed from (Submitted, or Partially Used once the PO module used some).
export const requirementStatusFlow = (status, consumedQty) => (status === REQUIREMENT_STATUS.CLOSED
  ? ['DRAFT', 'SUBMITTED', ...(consumedQty > 0 ? ['PARTIALLY_USED'] : []), 'CLOSED']
  : REQUIREMENT_STATUS_FLOW);

// ==================== HELPER ====================
export const getStatusConfig = (moduleConfig, status) => {
  return moduleConfig[status] || { color: 'default', icon: FileTextOutlined };
};
