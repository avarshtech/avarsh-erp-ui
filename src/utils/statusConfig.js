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

// ==================== BOM STATUS CONFIG ====================
export const BOM_STATUS_CONFIG = {
  [BOM_STATUS.DRAFT]:   { color: 'default', icon: FileTextOutlined },
  [BOM_STATUS.CREATED]: { color: 'green',   icon: CheckCircleOutlined },
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
};


// ==================== STATUS FLOW (for StatusSteps) ====================
export const ORDER_STATUS_FLOW = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'];
export const PO_STATUS_FLOW = ['Draft', 'Pending_Approval', 'Sent_To_Supplier', 'Partially_Received', 'Completed'];
export const COSTING_STATUS_FLOW = ['Draft', 'Final', 'Approved', 'Rejected'];
export const BOM_STATUS_FLOW = ['DRAFT', 'CREATED'];
export const GRN_STATUS_FLOW = ['Draft', 'Submitted', 'QC_Pending', 'QC_Complete', 'Closed'];
export const QC_STATUS_FLOW = ['Draft', 'Submitted', 'Pending_Approval', 'Approved', 'Conditional_Pass'];
export const PRODUCTION_PO_STATUS_FLOW = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

// ==================== HELPER ====================
export const getStatusConfig = (moduleConfig, status) => {
  return moduleConfig[status] || { color: 'default', icon: FileTextOutlined };
};
