/**
 * Job-work vocabulary shared by the Supplier and Process masters and the two job-work
 * purchase orders (Cut Panel PO, Garment Process PO).
 *
 * The UOM codes mirror the API enum masterdata/process/JobWorkUom.java and the CHECK
 * constraint chk_mst_processes_default_uom — keep all three in step.
 */

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
