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
  SyncOutlined,
} from '@ant-design/icons';

import { ORDER_STATUS } from './orderConstants';
import { PO_STATUS } from './poStatusConstants';
import { BOM_STATUS } from './bomConstants';

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
};

// ==================== PO STATUS CONFIG ====================
export const PO_STATUS_CONFIG = {
  [PO_STATUS.DRAFT]:              { color: 'default',    icon: FileTextOutlined },
  [PO_STATUS.PENDING_APPROVAL]:   { color: 'processing', icon: ClockCircleOutlined },
  [PO_STATUS.APPROVED]:           { color: 'green',      icon: CheckCircleOutlined },
  [PO_STATUS.REJECTED]:           { color: 'red',        icon: CloseCircleOutlined },
  [PO_STATUS.IN_PROGRESS]:        { color: 'blue',       icon: SyncOutlined },
  [PO_STATUS.CANCELLED]:          { color: 'volcano',    icon: StopOutlined },
  [PO_STATUS.REFERRED_BACK]:      { color: 'orange',     icon: UndoOutlined },
  [PO_STATUS.PARTIALLY_RECEIVED]: { color: 'geekblue',   icon: InboxOutlined },
  [PO_STATUS.SENT_TO_SUPPLIER]:   { color: 'cyan',       icon: SendOutlined },
  [PO_STATUS.COMPLETED]:          { color: 'green',      icon: CheckCircleOutlined },
};

// ==================== BOM STATUS CONFIG ====================
export const BOM_STATUS_CONFIG = {
  [BOM_STATUS.DRAFT]:   { color: 'default', icon: FileTextOutlined },
  [BOM_STATUS.CREATED]: { color: 'green',   icon: CheckCircleOutlined },
};

// ==================== GRN STATUS CONFIG ====================
export const GRN_STATUS_CONFIG = {
  DRAFT:     { color: 'default',    icon: FileTextOutlined },
  POSTED:    { color: 'green',      icon: CheckCircleOutlined },
  CANCELLED: { color: 'volcano',    icon: StopOutlined },
};

// ==================== STATUS FLOW (for StatusSteps) ====================
export const ORDER_STATUS_FLOW = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED'];
export const PO_STATUS_FLOW = ['Draft', 'Pending_Approval', 'Approved', 'Sent_To_Supplier', 'Partially_Received', 'Completed'];
export const COSTING_STATUS_FLOW = ['Draft', 'Final', 'Approved'];
export const BOM_STATUS_FLOW = ['DRAFT', 'CREATED'];

// ==================== HELPER ====================
export const getStatusConfig = (moduleConfig, status) => {
  return moduleConfig[status] || { color: 'default', icon: FileTextOutlined };
};
