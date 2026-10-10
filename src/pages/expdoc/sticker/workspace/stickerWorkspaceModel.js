/**
 * The sticker workspace's decisions that need no React: where a run's answers are
 * prefilled from, whether barcodes start on, why Generate is blocked, how many layouts a
 * buyer really has, whether the layout was revised since the last run, and how the
 * preview pages. Pure, so the unit spec can pin them.
 */
import { PAPER_SPECS, STICKER_LINE_KIND } from '../../../../utils/expDocConstants';
import { intersectRanges } from '../../../../utils/expDocCalc';

export const SCOPE = { ALL: 'All cartons', RANGE: 'Range' };

/*
 * Carton counts follow the buyer's order quantity, so a shipment has no ceiling.
 * Assembling the HTML is not the constraint — 20,000 cartons × 2 faces builds in
 * well under a second — but the browser's own print pipeline is, and it fails by
 * hanging rather than by erroring. Past this many labels the user is offered a
 * range instead of a job the printer may never come back from.
 */
export const MAX_LABELS_PER_JOB = 2000;

export const num = (v) => (Number(v) || 0).toLocaleString('en-IN');

/** A paper's sheet spec; an unknown paper prints as A4, as the renderer does. */
export const paperSpecOf = (paper) => (Object.hasOwn(PAPER_SPECS, paper || '') ? PAPER_SPECS[paper] : PAPER_SPECS.A4_1UP);

/** This packing list's runs of the layout's template family, latest first. */
const familyRuns = (runs, layout) => (layout
  ? (runs || []).filter((r) => r.templateCode === layout.templateCode).sort((a, b) => b.id - a.id)
  : []);

/**
 * The run whose answers prefill this one (plan §2): the latest run of the same template
 * family that printed any of the selected cartons — a reprint keeps its values — else the
 * family's latest run; null when the family never printed here.
 */
export const askPrefillRun = (runs, layout, selectedRanges) => {
  const family = familyRuns(runs, layout);
  return family.find((r) => intersectRanges(selectedRanges || [], r.prints || []).length > 0) || family[0] || null;
};

/** A run's answer to each question, '' where it gave none. Own keys only: "constructor" is a valid key. */
export const askDefaults = (questions, run) => Object.fromEntries((questions || []).map(({ key }) => [
  key, run?.askValues && Object.hasOwn(run.askValues, key) ? String(run.askValues[key] ?? '') : '',
]));

/** Whether any line of any face is a barcode — what the barcode switch is for. */
export const hasBarcodeLine = (stickerLayout) => (stickerLayout?.faces || [])
  .some((face) => (face?.lines || []).some((line) => line?.kind === STICKER_LINE_KIND.BARCODE));

/**
 * Barcodes print when the layout has a barcode line and the user switched them on — or,
 * until the user chooses, when no selected carton lacks an EAN.
 */
export const printBarcodesFor = (stickerLayout, choice, eanMissing) =>
  hasBarcodeLine(stickerLayout) && (choice ?? !eanMissing?.count);

/** The buyer's layouts: the standard carton marking is always offered, so it is not counted. */
export const layoutCount = (layoutOptions) => (layoutOptions || []).filter((o) => !o.isSystem).length;

/**
 * The note for a layout revised since this packing list last printed with its family:
 * which run printed with which revision, and the revision this run prints with.
 */
export const revisedSinceLastRun = (runs, layout) => {
  const last = familyRuns(runs, layout)[0];
  return last && Number(last.templateVersion) < Number(layout.version)
    ? { runNo: last.runNo, from: last.templateVersion, to: layout.version }
    : null;
};

/** Why Generate is disabled, in the order the user can fix it; null when it is not. */
export const generateBlockReason = ({
  layout, mustPick, blockedByPermission, reprintBlocked, unanswered, noFaces, checking, check,
}) => {
  if (!layout) return mustPick ? 'Pick the sticker layout to print with.' : 'No sticker layout could be loaded for this buyer.';
  if (blockedByPermission) return 'You do not hold the right to print these labels.';
  if (reprintBlocked) return 'These cartons were printed already and you do not hold the reprint right.';
  if (unanswered) return `Answer “${unanswered.label}” before printing.`;
  // No face ticked prints no label, yet would record the cartons as printed.
  if (noFaces) return 'Tick at least one face to print.';
  if (checking || !check) return 'Checking the selected cartons…';
  return check.canGenerate ? null : (check.blockedReason || 'These cartons cannot be printed yet.');
};

/**
 * A preview page is a whole number of SHEETS holding a whole number of CARTONS — which is
 * not the same thing. Two faces on 1-up paper puts one carton across two sheets; one face
 * on 2×2 paper puts four cartons on one sheet. The smallest block that divides cleanly both
 * ways is lcm(labelsPerSheet, faces) labels, so the preview never shows half a carton or
 * half a sheet.
 */
export const pageGeometry = (paper, faces, cartonCount) => {
  const spec = paperSpecOf(paper);
  const perSheet = spec.cols * spec.rows;
  const perCarton = Math.max(1, faces || 1);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const blockLabels = (perSheet * perCarton) / gcd(perSheet, perCarton);
  const cartonsPerPage = blockLabels / perCarton;
  return {
    cartonsPerPage,
    sheetsPerPage: blockLabels / perSheet,
    pageCount: Math.max(1, Math.ceil((cartonCount || 0) / cartonsPerPage)),
  };
};

/**
 * The context a face's bindings resolve against. It must carry every namespace the field
 * catalogue offers — a face binding `buyer.name` (JOMO's 22pt headline) printed an em dash
 * while this held only the exporter and the shipment — and the run's answers (`ask`).
 */
export const renderContext = (ctx, exporter, ask) => ({
  exporter: exporter || {},
  shipment: ctx?.shipment || {},
  buyer: { name: ctx?.pl?.buyerName },
  pl: ctx?.pl || {},
  styleByEntry: ctx?.styleByEntry,
  ask,
});

/** "BATCH #: 261505-SR · SEASON: AW26": a run's answers, by the labels it was asked with. */
export const runValuesText = (run) => Object.entries(run?.askValues || {})
  .filter(([, value]) => value != null && value !== '')
  .map(([key, value]) => `${(run.askLabels && Object.hasOwn(run.askLabels, key) && run.askLabels[key]) || key}: ${value}`)
  .join(' · ');
