/**
 * Job-work bill passing (Cut Panel PO / Garment Process PO vendor bills) — the constants the screens and the
 * calculator share. Statuses, the workflow and the exception severities are the supplier bill's
 * (billPassingConstants.js): both kinds of bill live on one screen and move the same way.
 */

export const BILL_SOURCE = {
  SUPPLIER_PO: 'SUPPLIER_PO',
  CUT_PANEL_PO: 'CUT_PANEL_PO',
  GARMENT_PROCESS_PO: 'GARMENT_PROCESS_PO',
};

/** The list's source filter and New Bill's bill-type choice, in screen order. */
export const BILL_SOURCES = [
  { value: BILL_SOURCE.SUPPLIER_PO, label: 'Supplier PO', party: 'Supplier', partyType: 'SUPPLIER' },
  { value: BILL_SOURCE.CUT_PANEL_PO, label: 'Cut Panel PO', party: 'Vendor', partyType: 'VENDOR', check: 'Panel check' },
  { value: BILL_SOURCE.GARMENT_PROCESS_PO, label: 'Garment Process PO', party: 'Vendor', partyType: 'VENDOR', check: 'Garment check' },
];

export const billSourceOf = (value) => BILL_SOURCES.find((s) => s.value === value) || BILL_SOURCES[0];
export const isJobWorkSource = (value) => value === BILL_SOURCE.CUT_PANEL_PO || value === BILL_SOURCE.GARMENT_PROCESS_PO;

export const JW_DOC_PREFIX = 'JWB';
export const VDN_DOC_PREFIX = 'VDN';

/** A job-work bill is raised only once the PO is final (owner, 2026-10-07): every line back, or short-closed. */
export const BILLABLE_PO_STATUSES = ['COMPLETED', 'CLOSED'];

/**
 * What the debit note can carry. `basis` is what `qty` counts: UNIT = the PO's billing unit (the vendor's own
 * figures), PCS = pieces (material recovery). `proposed` types are offered by "Propose deductions"; the rest are
 * added by hand. GST: a deduction that takes back part of his invoice reverses his GST on it; a recovery or a
 * penalty is not a supply and carries none by default.
 */
export const JW_DEDUCTION_TYPES = {
  REJECTION_CHARGE: { label: 'Rejected / short qty billed', basis: 'UNIT', gst: 'WITH_GST', proposed: true },
  RATE_DIFFERENCE: { label: 'Rate above PO', basis: 'UNIT', gst: 'WITH_GST', proposed: true },
  MATERIAL_DAMAGE: { label: 'Material damage recovery', basis: 'PCS', gst: 'WITHOUT_GST', proposed: true, keyedRate: true },
  SHORTAGE: { label: 'Shortage recovery', basis: 'PCS', gst: 'WITHOUT_GST', proposed: true, keyedRate: true },
  EXCESS_CHARGES: { label: 'Charges above the PO', basis: null, gst: 'WITH_GST', proposed: true },
  LATE_DELIVERY: { label: 'Late delivery penalty', basis: null, gst: 'WITHOUT_GST', proposed: false },
  OTHER: { label: 'Other deduction', basis: null, gst: 'WITHOUT_GST', proposed: false },
};

export const JW_DEDUCTION_TYPE_OPTIONS = Object.entries(JW_DEDUCTION_TYPES)
  .map(([value, t]) => ({ value, label: t.label }));

/** A DC's check verdict, as the panel and garment checks report it. */
export const CHECK_STATUS_COLOR = { PASSED: 'success', PARTIAL: 'warning', FAILED: 'error', PENDING: 'default' };
