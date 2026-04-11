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
import { GRN_STATUS, QC_STATUS, STOCK_STATUS, ISSUE_STATUS, ADJUSTMENT_STATUS } from './inventoryConstants';

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
};

// ==================== QC STATUS CONFIG ====================
// 7-state QC lifecycle. Every state is visually distinct.
export const QC_STATUS_CONFIG = {
  [QC_STATUS.DRAFT]:                  { color: 'default',    icon: FileTextOutlined },
  [QC_STATUS.SUBMITTED]:              { color: 'processing', icon: SendOutlined },
  [QC_STATUS.PENDING_APPROVAL]:       { color: 'geekblue',   icon: AuditOutlined },
  [QC_STATUS.APPROVED]:               { color: 'green',      icon: SafetyCertificateOutlined },
  [QC_STATUS.REJECTED]:               { color: 'red',        icon: CloseCircleOutlined },
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

// ==================== ISSUE STATUS CONFIG ====================
export const ISSUE_STATUS_CONFIG = {
  [ISSUE_STATUS.DRAFT]:    { color: 'default',    icon: FileTextOutlined },
  [ISSUE_STATUS.APPROVED]: { color: 'blue',       icon: CheckCircleOutlined },
  [ISSUE_STATUS.ISSUED]:   { color: 'green',      icon: SendOutlined },
  [ISSUE_STATUS.PARTIAL]:  { color: 'orange',     icon: SwapOutlined },
  [ISSUE_STATUS.RETURNED]: { color: 'cyan',       icon: UndoOutlined },
  [ISSUE_STATUS.CLOSED]:   { color: 'green',      icon: CheckCircleOutlined },
};

// ==================== ADJUSTMENT STATUS CONFIG ====================
export const ADJUSTMENT_STATUS_CONFIG = {
  [ADJUSTMENT_STATUS.DRAFT]:            { color: 'default',    icon: FileTextOutlined },
  [ADJUSTMENT_STATUS.PENDING_APPROVAL]: { color: 'processing', icon: ClockCircleOutlined },
  [ADJUSTMENT_STATUS.APPROVED]:         { color: 'green',      icon: CheckCircleOutlined },
  [ADJUSTMENT_STATUS.REJECTED]:         { color: 'red',        icon: CloseCircleOutlined },
};

// ==================== STATUS FLOW (for StatusSteps) ====================
export const ORDER_STATUS_FLOW = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'];
export const PO_STATUS_FLOW = ['Draft', 'Pending_Approval', 'Sent_To_Supplier', 'Partially_Received', 'Completed'];
export const COSTING_STATUS_FLOW = ['Draft', 'Final', 'Approved', 'Rejected'];
export const BOM_STATUS_FLOW = ['DRAFT', 'CREATED'];
export const GRN_STATUS_FLOW = ['Draft', 'Submitted', 'QC_Pending', 'QC_Complete', 'Closed'];
export const QC_STATUS_FLOW = ['Draft', 'Submitted', 'Pending_Approval', 'Approved'];
export const ISSUE_STATUS_FLOW = ['Draft', 'Approved', 'Issued', 'Closed'];

// ==================== HELPER ====================
export const getStatusConfig = (moduleConfig, status) => {
  return moduleConfig[status] || { color: 'default', icon: FileTextOutlined };
};
