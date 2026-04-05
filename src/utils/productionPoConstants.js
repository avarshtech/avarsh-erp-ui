/**
 * Production PO Constants
 */

export const PPO_STATUS = {
  OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED', CANCELLED: 'CANCELLED',
};

const PPO_STATUS_LABELS = {
  [PPO_STATUS.OPEN]: 'Open', [PPO_STATUS.IN_PROGRESS]: 'In Progress',
  [PPO_STATUS.COMPLETED]: 'Completed', [PPO_STATUS.CLOSED]: 'Closed',
  [PPO_STATUS.CANCELLED]: 'Cancelled',
};

const PPO_STATUS_COLORS = {
  [PPO_STATUS.OPEN]: 'default', [PPO_STATUS.IN_PROGRESS]: 'processing',
  [PPO_STATUS.COMPLETED]: 'success', [PPO_STATUS.CLOSED]: 'cyan',
  [PPO_STATUS.CANCELLED]: 'default',
};

export const getPPOStatusLabel = (s) => PPO_STATUS_LABELS[s] || s;
export const getPPOStatusColor = (s) => PPO_STATUS_COLORS[s] || 'default';
export const PPO_STATUS_OPTIONS = Object.entries(PPO_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const STAGE_TYPE = {
  CUTTING: 'CUTTING', PANEL_PRINTING: 'PANEL_PRINTING', PANEL_EMBROIDERY: 'PANEL_EMBROIDERY',
  PANEL_WASHING: 'PANEL_WASHING', SEWING: 'SEWING', GARMENT_WASHING: 'GARMENT_WASHING',
  GARMENT_DYEING: 'GARMENT_DYEING', TRIMMING: 'TRIMMING', CHECKING: 'CHECKING',
  IRONING: 'IRONING', PACKING: 'PACKING',
};

export const STAGE_TYPE_LABELS = {
  CUTTING: 'Cutting', PANEL_PRINTING: 'Panel Printing', PANEL_EMBROIDERY: 'Panel Embroidery',
  PANEL_WASHING: 'Panel Washing', SEWING: 'Sewing (WO)', GARMENT_WASHING: 'Garment Washing',
  GARMENT_DYEING: 'Garment Dyeing', TRIMMING: 'Trimming', CHECKING: 'Checking',
  IRONING: 'Ironing / Pressing', PACKING: 'Packing',
};

export const STAGE_STATUS = {
  NOT_STARTED: 'NOT_STARTED', IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED', SKIPPED: 'SKIPPED',
};

export const STAGE_STATUS_COLORS = {
  NOT_STARTED: 'default', IN_PROGRESS: 'processing', COMPLETED: 'success', SKIPPED: 'warning',
};

export const getStageLabel = (s) => STAGE_TYPE_LABELS[s] || s;
export const getStageStatusColor = (s) => STAGE_STATUS_COLORS[s] || 'default';

export const OPTIONAL_STAGES = new Set([
  'PANEL_PRINTING', 'PANEL_EMBROIDERY', 'PANEL_WASHING', 'GARMENT_WASHING', 'GARMENT_DYEING',
]);
