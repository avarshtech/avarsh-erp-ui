/**
 * Inward job work vocabulary — work we do for other companies (principals) on their own material
 * (UI mock round 2). A job order is an Order of type JOB_WORK; the principal's fabric, trims or cut
 * panels are held as party stock, never as ours. These mirror the enums the backend will define.
 */

export { toOptions } from '../jobWorkTracker/constants';

/** Stored status; the screens show the derived one from `jobOrderStatus` (progressRules). */
export const JO_STATUS = {
  AWAITING_MATERIAL: 'AWAITING_MATERIAL',
  IN_PRODUCTION: 'IN_PRODUCTION',
  PARTLY_RETURNED: 'PARTLY_RETURNED',
  RETURNED: 'RETURNED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};
export const JO_STATUS_LABEL = {
  AWAITING_MATERIAL: 'Waiting for material',
  IN_PRODUCTION: 'In production',
  PARTLY_RETURNED: 'Part returned',
  RETURNED: 'All returned',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
export const OPEN_JO_STATUSES = [JO_STATUS.AWAITING_MATERIAL, JO_STATUS.IN_PRODUCTION, JO_STATUS.PARTLY_RETURNED, JO_STATUS.RETURNED];

/** What the principal sends (decision 19): fabric for cut-to-pack, cut panels for stitching onwards. */
export const SCOPE = { CMT: 'CMT', STITCHING: 'STITCHING' };
export const SCOPE_LABEL = { CMT: 'Cut to pack (CMT)', STITCHING: 'Stitching onwards' };

export const MATERIAL_KIND = { FABRIC: 'FABRIC', PANELS: 'PANELS', TRIM: 'TRIM' };
export const MATERIAL_KIND_LABEL = { FABRIC: 'Fabric', PANELS: 'Cut panels', TRIM: 'Trims' };
/** The material a scope cannot start without; a shortage of it holds the order (decision 20). */
export const MAIN_KIND = { CMT: MATERIAL_KIND.FABRIC, STITCHING: MATERIAL_KIND.PANELS };

export const SUPPLIED_BY = { PRINCIPAL: 'PRINCIPAL', OWN: 'OWN' };
export const SUPPLIED_BY_LABEL = { PRINCIPAL: 'Principal', OWN: 'We buy (in our rate)' };

/** Cutting waste from a principal's fabric, set per principal (decision 22). */
export const WASTE_RULE = { RETURN: 'RETURN', SELL: 'SELL' };
export const WASTE_RULE_LABEL = { RETURN: 'Returned to them', SELL: 'Sold by us with their consent' };

export const INWARD_STATUS = { POSTED: 'POSTED', CANCELLED: 'CANCELLED' };
export const INWARD_STATUS_LABEL = { POSTED: 'Posted', CANCELLED: 'Cancelled' };

export const RETURN_STATUS = { DISPATCHED: 'DISPATCHED', CANCELLED: 'CANCELLED' };
export const RETURN_STATUS_LABEL = { DISPATCHED: 'Dispatched', CANCELLED: 'Cancelled' };

export const TALLY_STATUS = { PENDING: 'PENDING', RECORDED: 'RECORDED' };
export const TALLY_STATUS_LABEL = { PENDING: 'Not in Tally yet', RECORDED: 'In Tally' };

/** Where party material is issued: our cutting, our sewing, or a process vendor (decision 21). */
export const TARGET_TYPE = {
  CUTTING_PO: 'CUTTING_PO', WORK_ORDER: 'WORK_ORDER', FINISHING_PO: 'FINISHING_PO', PROCESS_PO: 'PROCESS_PO',
};
export const TARGET_TYPE_LABEL = {
  CUTTING_PO: 'Cutting PO (in-house)', WORK_ORDER: 'Work Order (in-house)', FINISHING_PO: 'Finishing PO (in-house)', PROCESS_PO: 'Process vendor PO',
};

export const PP_SAMPLE = { NOT_REQUIRED: 'NOT_REQUIRED', PENDING: 'PENDING', APPROVED: 'APPROVED' };
export const PP_SAMPLE_LABEL = { NOT_REQUIRED: 'Not required', PENDING: 'Pending', APPROVED: 'Approved' };

/** Progress stages of a job order, in order; CMT cuts, stitching-onwards starts from panels in. */
export const INWARD_STAGE = {
  MATERIAL_IN: 'MATERIAL_IN', CUT: 'CUT', PANELS_IN: 'PANELS_IN', STITCHED: 'STITCHED', PACKED: 'PACKED', RETURNED: 'RETURNED',
};
export const INWARD_STAGE_LABEL = {
  MATERIAL_IN: 'Fabric in', CUT: 'Cut', PANELS_IN: 'Panels in', STITCHED: 'Stitched', PACKED: 'Packed', RETURNED: 'Returned',
};
export const STAGES_BY_SCOPE = {
  CMT: [INWARD_STAGE.MATERIAL_IN, INWARD_STAGE.CUT, INWARD_STAGE.STITCHED, INWARD_STAGE.PACKED, INWARD_STAGE.RETURNED],
  STITCHING: [INWARD_STAGE.PANELS_IN, INWARD_STAGE.STITCHED, INWARD_STAGE.PACKED, INWARD_STAGE.RETURNED],
};

export const RISK = { OVERDUE: 'OVERDUE', AT_RISK: 'AT_RISK', ON_TRACK: 'ON_TRACK' };

/** Job-charge defaults (your CA confirms): wearing-apparel manufacturing services, textile job-work rate. */
export const DEFAULT_SAC = '998822';
export const DEFAULT_GST_PCT = 5;

/** Days since the principal's challan: warn ahead of their one-year limit for inputs. */
export const AGE_WARN_DAYS = [300, 330, 365];
