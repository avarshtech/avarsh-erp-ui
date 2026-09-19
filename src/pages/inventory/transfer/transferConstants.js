import { FileTextOutlined, SendOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';

export const TRANSFER_STATUS = {
  DRAFT: 'DRAFT',
  DISPATCHED: 'DISPATCHED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
};

export const TRANSFER_STATUS_LABELS = {
  [TRANSFER_STATUS.DRAFT]: 'Draft',
  [TRANSFER_STATUS.DISPATCHED]: 'In Transit',
  [TRANSFER_STATUS.RECEIVED]: 'Received',
  [TRANSFER_STATUS.CANCELLED]: 'Cancelled',
};

export const TRANSFER_STATUS_CONFIG = {
  [TRANSFER_STATUS.DRAFT]:      { color: 'default',    icon: FileTextOutlined },
  [TRANSFER_STATUS.DISPATCHED]: { color: 'processing', icon: SendOutlined },
  [TRANSFER_STATUS.RECEIVED]:   { color: 'green',      icon: CheckCircleOutlined },
  [TRANSFER_STATUS.CANCELLED]:  { color: 'volcano',    icon: StopOutlined },
};

export const getTransferStatusLabel = (s) => TRANSFER_STATUS_LABELS[s] || s || '—';

export const TRANSFER_STATUS_OPTIONS = Object.values(TRANSFER_STATUS).map((s) => ({ value: s, label: TRANSFER_STATUS_LABELS[s] }));
