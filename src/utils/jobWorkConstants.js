/**
 * Job-work vocabulary shared by the Supplier and Process masters and the two job-work
 * purchase orders (Cut Panel PO, Garment Process PO).
 *
 * The UOM codes mirror the API enum masterdata/process/JobWorkUom.java and the CHECK
 * constraint chk_mst_processes_default_uom — keep all three in step.
 */

/** Where each job-work PO type lives (routes in App.jsx). */
export const JOB_WORK_PO_PATH = {
  CPP: '/purchase-orders/cut-panel-po',
  GPO: '/purchase-orders/garment-process-po',
};

/** Process categories job workers do and the job-work POs buy (JobWorkCategory.java). */
export const JOB_WORK_CATEGORIES = ['Cut Panel', 'Garment'];

export const isJobWorkCategory = (category) => JOB_WORK_CATEGORIES.includes(category);

/**
 * Billing units of a job-work PO line. `perUnit` is how many pieces one unit holds, where
 * that is fixed: Dozen bills qty ÷ 12, Piece bills qty. Kg, Metre, Lot and Other have no
 * fixed conversion, so their billing quantity is keyed on the PO.
 */
export const JOB_WORK_UOMS = [
  { value: 'PIECE', label: 'Piece', perUnit: 1 },
  { value: 'DOZEN', label: 'Dozen', perUnit: 12 },
  { value: 'KG', label: 'Kg' },
  { value: 'METRE', label: 'Metre' },
  { value: 'LOT', label: 'Lot' },
  { value: 'OTHER', label: 'Other' },
];

/** Garments are counted or weighed, never billed by the metre or lot (ProcessService checks the same). */
const GARMENT_UOMS = ['PIECE', 'DOZEN', 'KG'];

export const jobWorkUomOptions = (category) => (category === 'Garment'
  ? JOB_WORK_UOMS.filter((u) => GARMENT_UOMS.includes(u.value))
  : JOB_WORK_UOMS);

export const jobWorkUomLabel = (code) => JOB_WORK_UOMS.find((u) => u.value === code)?.label ?? code ?? '—';

/**
 * What a new Cut Panel / Garment process starts with — the values the migration gave the
 * seeded ones: SAC 998821 (textile job work on inputs owned by others), GST 5 %, Piece.
 */
export const JOB_WORK_PROCESS_DEFAULTS = Object.freeze({
  sacCode: '998821',
  gstRatePercent: 5,
  defaultUom: 'PIECE',
  artworkRequired: false,
});

export const SAC_CODE_PATTERN = /^\d{4,8}$/;

/**
 * The values to set when a process moves into the job-work `category`: the defaults for
 * any field still empty, and Piece when the unit it holds is not allowed there (a Garment
 * process bills by Piece, Dozen or Kg only).
 */
export const jobWorkDefaultsFor = (category, current) => {
  const next = {};
  for (const [field, value] of Object.entries(JOB_WORK_PROCESS_DEFAULTS)) {
    if (current[field] === undefined || current[field] === null || current[field] === '') next[field] = value;
  }
  const uom = next.defaultUom ?? current.defaultUom;
  if (!jobWorkUomOptions(category).some((u) => u.value === uom)) next.defaultUom = JOB_WORK_PROCESS_DEFAULTS.defaultUom;
  return next;
};

const opts = (pairs) => pairs.map(([value, label]) => ({ value, label }));
export const optionLabel = (options, value) => options.find((o) => o.value === value)?.label ?? value ?? '—';

/** Where processed panels come back to (CPP FR-21). */
export const CPP_RETURN_TO = opts([
  ['FACTORY', 'Factory'], ['UNIT', 'Unit'], ['CUTTING', 'Cutting Department'], ['SEWING', 'Sewing'], ['OTHER', 'Other'],
]);

/** Where processed garments come back to (GPO PRD §8.3). */
export const GPO_RETURN_TO = opts([
  ['FACTORY', 'Factory'], ['PRODUCTION_UNIT', 'Production Unit'], ['FINISHING', 'Finishing Department'], ['OTHER', 'Other'],
]);

/** What "Amend delivery / instructions" may change on an approved or sent Garment Process PO (§16). */
export const GPO_AMEND_FIELDS = ['requiredDate', 'expectedReturnDate', 'returnTo', 'returnToOther',
  'returnUnitId', 'returnUnitName', 'returnUnitAddress', 'instructions'];

/** Over-allocation override reasons (CPP PRD §14.4); the same list serves a Garment Process PO excess. */
export const OVERRIDE_REASONS = opts([
  ['PROCESS_WASTAGE', 'Process wastage allowance'], ['RECUT_COVER', 'Recut cover'], ['VENDOR_MIN_LOT', 'Vendor minimum lot'],
  ['SAMPLING', 'Sampling / trial'], ['OTHER', 'Other'],
]);

/** A rate of 0.00 needs this reason code (CPP BR-11 / VR-10). */
export const ZERO_RATE_REASON = { value: 'FREE_REWORK', label: 'Free / rework' };

/** Cancel and short close (CPP VR-18): a reason code and a remark, both mandatory. */
export const CLOSE_REASONS = opts([
  ['VENDOR_CANNOT_COMPLETE', 'Vendor cannot complete'], ['ORDER_CANCELLED', 'Order cancelled'],
  ['REQUIREMENT_REDUCED', 'Requirement reduced'], ['DAMAGED_AT_VENDOR', 'Damaged at the vendor'],
  ['RAISED_IN_ERROR', 'Raised in error'], ['OTHER', 'Other'],
]);

/** A rate above the vendor's last rate by more than this warns and needs a reason (CPP BR-12). */
export const RATE_VARIANCE_PCT = 10;

/** The most a Garment Process PO line may exceed its balance: % of its required qty (GPO §11, deviation D23). */
export const GPO_EXCESS_CAP_PCT = 3;
