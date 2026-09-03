/**
 * Finishing module (production execution) constants — Finishing PRD v2.0
 * (modules 1-10, AQL 2.5 framework) + Indian SME garment export practice.
 * Mirrors sewingConstants.js conventions.
 */

export const FINISHING_STATUS_COLORS = {
  DRAFT: 'default',
  RECEIVED: 'success',
  VERIFIED: 'success',
  SHORTAGE: 'error',
  EXCESS: 'warning',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  PASS: 'success',
  FAIL: 'error',
  HOLD: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'error',
  RE_ALTER: 'warning',
  PENDING_RECHECK: 'processing',
  CLOSED: 'default',
  CALIBRATED: 'success',
  CALIBRATION_DUE: 'error',
  SEGREGATED: 'success',
  PENDING: 'default',
  ACTIVE: 'success',
};

export const finishingStatusLabel = (s) => String(s || '').replaceAll('_', ' ')
  .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const HOURS = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'];

/** Hourly stations combined in one tab (PRD §19 pattern; rev: checking stations
 * added after trimming and after ironing; every station carries a piece rate
 * so cost per operator is always visible). */
export const HOURLY_STATIONS = [
  { key: 'THREAD_TRIM', label: 'Thread Trimming', prdRef: 'Module 2', hasCost: true },
  { key: 'FIRST_CHECK', label: 'First Checking', prdRef: 'after Trimming', hasCost: true },
  { key: 'KAJA_BUTTON', label: 'Kaja / Button', prdRef: 'Module 3', hasCost: true },
  { key: 'IRONING', label: 'Ironing / Pressing', prdRef: 'Module 6', hasCost: true },
  { key: 'FINAL_CHECK', label: 'Final Checking', prdRef: 'after Ironing', hasCost: true },
];

export const STAIN_TYPES = ['Oil', 'Dirt', 'Pen', 'Grease', 'Rust', 'Other'];

export const DEFECT_SOURCES = ['SEWING', 'FABRIC', 'FINISHING', 'TRIM'];

export const RECHECK_RESULTS = ['PASS', 'FAIL', 'RE_ALTER'];

export const CHECK_STAGES = [
  { key: 'PRE_FINAL', label: 'Pre-Final (100%)' },
  { key: 'FINAL', label: 'Final (AQL 2.5)' },
];

/** Label verification points, mandatory at pre-final (PRD 8.3). */
export const LABEL_CHECKS = ['Brand label', 'Size label', 'Care label', 'Country of origin'];

export const SHADE_BANDS = [
  { band: 'A', label: 'Lightest', color: '#bae0ff' },
  { band: 'B', label: 'Standard', color: '#69b1ff' },
  { band: 'C', label: 'Medium', color: '#1677ff' },
  { band: 'D', label: 'Darkest', color: '#003eb3' },
];

export const IRON_METHODS = ['Steam', 'Dry', 'Press'];

/** Defect library per PRD §18 — Critical zero tolerance, Major AQL 2.5, Minor AQL 4.0. */
export const DEFECT_SEVERITIES = {
  CRITICAL: { label: 'Critical', color: 'error', rule: 'Zero tolerance — any one rejects the lot' },
  MAJOR: { label: 'Major', color: 'warning', rule: 'AQL 2.5 accept/reject' },
  MINOR: { label: 'Minor', color: 'default', rule: 'AQL 4.0 accept/reject' },
};

export const DEFECT_LIBRARY = [
  { code: 'C-01', name: 'Needle / metal contamination', severity: 'CRITICAL' },
  { code: 'C-02', name: 'Wrong main label (brand / size)', severity: 'CRITICAL' },
  { code: 'C-03', name: 'Wrong or missing care label', severity: 'CRITICAL' },
  { code: 'C-04', name: 'Sharp object (needle tip, pin, staple)', severity: 'CRITICAL' },
  { code: 'C-05', name: 'Child safety violation (loose small parts)', severity: 'CRITICAL' },
  { code: 'C-06', name: 'Completely wrong product packed', severity: 'CRITICAL' },
  { code: 'M-01', name: 'Broken / skipped stitch (visible)', severity: 'MAJOR' },
  { code: 'M-02', name: 'Open seam or unraveling', severity: 'MAJOR' },
  { code: 'M-03', name: 'Visible stain or spot', severity: 'MAJOR' },
  { code: 'M-04', name: 'Measurement out of tolerance', severity: 'MAJOR' },
  { code: 'M-05', name: 'Shade variation beyond band', severity: 'MAJOR' },
  { code: 'M-06', name: 'Misaligned pattern / print / embroidery', severity: 'MAJOR' },
  { code: 'M-07', name: 'Puckering, twisting or distortion', severity: 'MAJOR' },
  { code: 'M-08', name: 'Missing / damaged button, snap, zipper', severity: 'MAJOR' },
  { code: 'M-09', name: 'Fabric hole or tear', severity: 'MAJOR' },
  { code: 'M-10', name: 'Incorrect color vs approved sample', severity: 'MAJOR' },
  { code: 'N-01', name: 'Loose threads not trimmed (hidden)', severity: 'MINOR' },
  { code: 'N-02', name: 'Minor pressing marks / wrinkles', severity: 'MINOR' },
  { code: 'N-03', name: 'Slight shade variation within band', severity: 'MINOR' },
  { code: 'N-04', name: 'Small fabric flaw in hidden area', severity: 'MINOR' },
  { code: 'N-05', name: 'Minor label placement offset', severity: 'MINOR' },
  { code: 'N-06', name: 'Slight uneven hemline (within tolerance)', severity: 'MINOR' },
  { code: 'N-07', name: 'Minor pilling in non-visible area', severity: 'MINOR' },
];

/** AQL 2.5 sampling table per PRD §17.2: [lotMin, lotMax, sample, accept, reject]. */
export const AQL_25_TABLE = [
  [2, 8, 2, 0, 1],
  [9, 15, 3, 0, 1],
  [16, 25, 5, 0, 1],
  [26, 50, 8, 0, 1],
  [51, 90, 13, 1, 2],
  [91, 150, 20, 1, 2],
  [151, 280, 32, 2, 3],
  [281, 500, 50, 3, 4],
  [501, 1200, 80, 5, 6],
  [1201, 3200, 125, 7, 8],
  [3201, 10000, 200, 10, 11],
  [10001, 35000, 315, 14, 15],
];

/** Thresholds per PRD objectives / business rules. */
export const DHU_TARGET_PCT = 3; // floor objective: keep DHU under 3%
export const DHU_ALERT_PCT = 5; // red warning above 5% (BR 8.3)
export const RFT_TARGET_PCT = 85; // Right First Time report target
export const ALTERATION_ALERT_PCT = 15; // daily alteration-rate alert (BR 11.3)
export const RECEIVING_SHORTAGE_PCT = 95; // cumulative-received warning (BR 4.3)
export const WIP_AGING_DAYS = 2; // flag batches sitting longer (WIP Aging report)
export const REALTER_CYCLE_ALERT = 3; // 3+ re-alter cycles → supervisor alert
