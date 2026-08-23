/**
 * Seed data for the Cutting module mock (design phase). Numbers follow the
 * PRD worked examples (e.g. roll 18.500 kg, 24 lays x 0.700 = -1.700 excess)
 * and reuse existing planning-layer doc shapes (CPO/… Cutting POs).
 */
import dayjs from 'dayjs';

const d = (offsetDays, time = '09:00') => dayjs().add(offsetDays, 'day').format(`YYYY-MM-DD ${time}`);
const day = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');

export const seedCutPos = [
  {
    id: 1, cutPoNo: 'CPO/26-27/1001', orderNo: 'SG/26-27/1001', buyerPoNo: 'HM-PO-88412',
    styleNo: 'HM-TS-2601', buyer: 'H&M Hennes & Mauritz AB', color: 'Navy Blue',
    description: "Men's Crew Neck T-Shirt", sizes: ['S', 'M', 'L', 'XL'],
    sizeQty: { S: 300, M: 600, L: 600, XL: 300 }, orderQty: 1800,
    consumption: 0.32, consumptionUom: 'kg/pc', width: 60, realizePct: 92,
    fabricType: 'Single Jersey', status: 'IN_PROGRESS', sizeSetStatus: 'APPROVED',
  },
  {
    id: 2, cutPoNo: 'CPO/26-27/1002', orderNo: 'SG/26-27/1002', buyerPoNo: 'PRK-PO-55210',
    styleNo: 'PRK-DN-2603', buyer: 'Primark Stores Ltd', color: 'Indigo',
    description: "Men's Slim Fit Denim Jeans", sizes: ['30', '32', '34', '36'],
    sizeQty: { 30: 400, 32: 500, 34: 400, 36: 200 }, orderQty: 1500,
    consumption: 0.55, consumptionUom: 'kg/pc', width: 58, realizePct: 90,
    fabricType: 'Denim', status: 'CONFIRMED', sizeSetStatus: 'PENDING',
  },
];

export const seedFabricReceipts = [
  {
    id: 1, receiptNo: 'FR-20260810-001', cutPoId: 1, fabricIssueNo: 'MIS/26-27/1001',
    date: day(-5), status: 'RECEIVED',
    rolls: [
      { rollNo: 'R-01', fabricType: 'Single Jersey', weight: 18.5, color: 'Navy Blue', shadeLot: 'SL-A', received: true },
      { rollNo: 'R-02', fabricType: 'Single Jersey', weight: 22.4, color: 'Navy Blue', shadeLot: 'SL-A', received: true },
      { rollNo: 'R-03', fabricType: 'Single Jersey', weight: 21.8, color: 'Navy Blue', shadeLot: 'SL-A', received: true },
      { rollNo: 'R-04', fabricType: 'Single Jersey', weight: 19.6, color: 'Navy Blue', shadeLot: 'SL-B', received: true },
      { rollNo: 'R-05', fabricType: 'Single Jersey', weight: 23.2, color: 'Navy Blue', shadeLot: 'SL-B', received: true },
      { rollNo: 'R-06', fabricType: 'Single Jersey', weight: 20.5, color: 'Navy Blue', shadeLot: 'SL-B', received: true },
    ],
  },
  {
    id: 2, receiptNo: 'FR-20260813-002', cutPoId: 1, fabricIssueNo: 'MIS/26-27/1003',
    date: day(-2), status: 'PARTIALLY_RECEIVED',
    rolls: [
      { rollNo: 'R-07', fabricType: 'Single Jersey', weight: 24.0, color: 'Navy Blue', shadeLot: 'SL-B', received: true },
      { rollNo: 'R-08', fabricType: 'Single Jersey', weight: 22.5, color: 'Navy Blue', shadeLot: 'SL-B', received: true },
      { rollNo: 'R-09', fabricType: 'Single Jersey', weight: 21.0, color: 'Navy Blue', shadeLot: 'SL-B', received: false },
    ],
  },
];

export const seedRelaxations = [
  {
    id: 1, relaxNo: 'RLX-20260810-001', receiptId: 1, cutPoId: 1, date: day(-5),
    fabricType: 'Single Jersey', startTime: d(-5, '08:00'), endTime: d(-4, '09:30'),
    shrinkagePrePct: 5.2, shrinkagePostPct: 2.1, status: 'REPORT_GENERATED',
  },
  {
    id: 2, relaxNo: 'RLX-20260813-002', receiptId: 2, cutPoId: 1, date: day(-1),
    fabricType: 'Single Jersey', startTime: dayjs().subtract(6, 'hour').format('YYYY-MM-DD HH:mm'),
    endTime: null, shrinkagePrePct: 4.8, shrinkagePostPct: null, status: 'IN_PROGRESS',
  },
];

/**
 * CR-CUT-2026-001 (rev per CAD marker sheet) — Marker Plan mirrors the cutting
 * room Excel: widths + cut allowance live on the plan header; each marker is
 * ONE row (height + ratio per size). MK-002 over-cuts past the +5% allowance
 * so the Size Jump alert/table has data.
 */
export const seedMarkerPlans = [
  {
    id: 1, planNo: 'MP-2026-0001', factory: 'Unit-1 Tirupur', cutPoId: 1, date: day(-7),
    planStartDate: day(-4), planEndDate: day(6), status: 'IN_PROGRESS',
    fabricWidthRaw: 59.5, cuttableWidth: 57, allowancePct: 5,
    markers: [
      {
        id: 1, markerNo: 'MK-001', markerLength: 6.2, markerHeight: 250, efficiencyPct: 86,
        layPlanDate: day(-4), cutPlanDate: day(-3), layTableNo: 1, cadFile: 'HM-TS-2601-M1.cut',
        ratio: { S: 1, M: 2, L: 2, XL: 1 },
      },
      {
        id: 2, markerNo: 'MK-002', markerLength: 6.4, markerHeight: 70, efficiencyPct: 83,
        layPlanDate: day(2), cutPlanDate: day(3), layTableNo: 2, cadFile: null,
        ratio: { S: 1, M: 2, L: 2, XL: 1 },
      },
    ],
  },
];

export const seedLayAudits = [
  {
    id: 1, cutPoId: 1, markerId: 1, layNo: 1, date: day(-4), layLength: 6.2, layHeight: 0.35, width: 1.5,
    startTime: d(-4, '09:15'), endTime: d(-4, '11:40'), status: 'APPROVED',
    rolls: [
      { rollNo: 'R-01', weight: 18.5, weightPerLay: 0.7, numLays: 24, remarks: 'PRD example roll' },
      { rollNo: 'R-02', weight: 22.4, weightPerLay: 0.72, numLays: 30, remarks: '' },
    ],
  },
  {
    id: 2, cutPoId: 1, markerId: 1, layNo: 2, date: day(0), layLength: 6.2, layHeight: 0.22, width: 1.5,
    startTime: d(0, '08:30'), endTime: d(0, '10:05'), status: 'AUDITED',
    rolls: [
      { rollNo: 'R-03', weight: 21.8, weightPerLay: 0.71, numLays: 30, remarks: '' },
    ],
  },
];

export const seedTmbChecks = [
  {
    id: 1, layAuditId: 1, cutPoId: 1, layNo: 1, date: day(-4), qcSign: 'K. Raman',
    cuttingMc: 'Eastman EC-3', grain: 'Straight', approvedPattern: 'HM-TS-2601-Rev2', status: 'PASSED',
    rows: [
      { part: 'Front', size: 'M', top: [52.1, 52.0, 52.2], middle: [52.0, 52.1, 52.0], bottom: [52.2, 52.3, 52.1], pcs: 54, comment: 'OK', action: 'Accept' },
      { part: 'Back', size: 'L', top: [54.0, 54.1, 54.0], middle: [54.1, 54.0, 54.2], bottom: [54.0, 54.2, 54.1], pcs: 54, comment: 'OK', action: 'Accept' },
      { part: 'Sleeve', size: 'M', top: [23.5, 23.4, 23.5], middle: [23.5, 23.5, 23.6], bottom: [23.6, 23.5, 23.5], pcs: 108, comment: 'OK', action: 'Accept' },
    ],
  },
  {
    id: 2, layAuditId: 2, cutPoId: 1, layNo: 2, date: day(0), qcSign: '',
    cuttingMc: 'Eastman EC-3', grain: 'Straight', approvedPattern: 'HM-TS-2601-Rev2', status: 'PENDING',
    rows: [
      { part: 'Front', size: 'M', top: [52.1, 52.2, 52.0], middle: [52.4, 52.5, 52.4], bottom: [52.8, 52.9, 52.8], pcs: 30, comment: 'Pattern Drift', action: 'Re-spread' },
      { part: 'Back', size: 'L', top: [54.0, 54.0, 54.1], middle: [54.1, 54.0, 54.0], bottom: [54.2, 54.1, 54.2], pcs: 30, comment: 'OK', action: 'Accept' },
    ],
  },
];

/** Cutting report lays — ratio-based (marker ratio S:1 M:2 L:2 XL:1). */
export const seedReportLays = [
  { id: 1, cutPoId: 1, layNo: 1, date: day(-4), plies: 54, cutBy: 'In-house', pieceRate: null, sizeQty: { S: 54, M: 108, L: 108, XL: 54 } },
  { id: 2, cutPoId: 1, layNo: 2, date: day(0), plies: 30, cutBy: 'Contractor', pieceRate: 2.5, sizeQty: { S: 30, M: 60, L: 60, XL: 30 } },
];

/** Bundles — numbering continues across sizes (BR-FR-06-04). B1-B3 already issued. */
export const seedBundles = [
  { id: 1, cutPoId: 1, bundleNo: 1, size: 'S', qty: 50, range: '1-50', status: 'ISSUED_SEWING' },
  { id: 2, cutPoId: 1, bundleNo: 2, size: 'S', qty: 34, range: '51-84', status: 'ISSUED_SEWING' },
  { id: 3, cutPoId: 1, bundleNo: 3, size: 'M', qty: 50, range: '1-50', status: 'ISSUED_SEWING' },
  { id: 4, cutPoId: 1, bundleNo: 4, size: 'M', qty: 50, range: '51-100', status: 'BUNDLED' },
  { id: 5, cutPoId: 1, bundleNo: 5, size: 'M', qty: 50, range: '101-150', status: 'BUNDLED' },
  { id: 6, cutPoId: 1, bundleNo: 6, size: 'M', qty: 18, range: '151-168', status: 'BUNDLED' },
  { id: 7, cutPoId: 1, bundleNo: 7, size: 'L', qty: 50, range: '1-50', status: 'BUNDLED' },
  { id: 8, cutPoId: 1, bundleNo: 8, size: 'L', qty: 50, range: '51-100', status: 'BUNDLED' },
  { id: 9, cutPoId: 1, bundleNo: 9, size: 'L', qty: 50, range: '101-150', status: 'BUNDLED' },
  { id: 10, cutPoId: 1, bundleNo: 10, size: 'L', qty: 18, range: '151-168', status: 'BUNDLED' },
  { id: 11, cutPoId: 1, bundleNo: 11, size: 'XL', qty: 50, range: '1-50', status: 'BUNDLED' },
  { id: 12, cutPoId: 1, bundleNo: 12, size: 'XL', qty: 34, range: '51-84', status: 'BUNDLED' },
];

export const seedBundlings = [
  { id: 1, cutPoId: 1, bundleSize: 50, date: day(-3), status: 'BUNDLED', bundleIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

export const seedBundleIssues = [
  { id: 1, issueNo: 'BIS-20260812-001', workOrderNo: 'WO/26-27/1001', cutPoId: 1, date: day(-3), bundleIds: [1, 2, 3], totalPcs: 134, issuedBy: 'Cutting Master' },
];

export const seedPanelIssues = [
  {
    id: 1, panelPoNo: 'PPO/26-27/1001', cutPoId: 1, process: 'Printing', date: day(-3), status: 'PARTIALLY_RETURNED',
    lines: [
      { panel: 'Front', size: 'M', ordQty: 600, issueQty: 100 },
      { panel: 'Front', size: 'L', ordQty: 600, issueQty: 100 },
    ],
  },
];

export const seedPanelChecks = [
  {
    id: 1, panelIssueId: 1, cutPoId: 1, process: 'Printing', date: day(-1), status: 'PARTIAL', correspondence: 'Chest print — approved strike-off SO-114',
    rows: [
      { size: 'M', orderRange: '1-100', bundleRange: 'B-3 / B-4', verified: true, quality: 'OK', comments: '', action: 'Accepted', qcSign: 'S. Devi' },
      { size: 'L', orderRange: '1-100', bundleRange: 'B-7 / B-8', verified: false, quality: 'Misaligned', comments: 'Print 4mm high on 12 pcs', action: 'Identified and segregated', qcSign: '' },
    ],
  },
];

export const seedProcessReturns = [
  {
    id: 1, returnDcNo: 'RDC-20260814-001', panelIssueId: 1, cutPoId: 1, date: day(-1), status: 'RETURNED',
    lines: [
      { process: 'Printing', panel: 'Front', size: 'M', issuedQty: 100, returnQty: 80, reason: 'Pending', remarks: 'Balance in second lot' },
      { process: 'Printing', panel: 'Front', size: 'L', issuedQty: 100, returnQty: 80, reason: 'Pending', remarks: 'Balance in second lot' },
    ],
  },
];

export const seedReCutEntries = [
  { id: 1, cutPoId: 1, date: day(-2), line: 'B-1', part: 'Sleeve', stNo: 'B-12/S-08', rollNo: 'R-04', qty: 3, monitor: 'V. Kumar', remark: 'Fabric defect', qcSign: 'K. Raman' },
  { id: 2, cutPoId: 1, date: day(-2), line: 'B-1', part: 'Front', stNo: 'B-03/S-21', rollNo: 'R-04', qty: 2, monitor: 'V. Kumar', remark: 'Sewing damage', qcSign: 'K. Raman' },
  { id: 3, cutPoId: 1, date: day(-1), line: 'Line-A', part: 'Back', stNo: 'B-07/S-02', rollNo: 'R-04', qty: 4, monitor: 'R. Selvi', remark: 'Cutting defect', qcSign: 'S. Devi' },
  { id: 4, cutPoId: 1, date: day(0), line: 'B-2', part: 'Sleeve', stNo: 'B-11/S-15', rollNo: 'R-04', qty: 2, monitor: 'V. Kumar', remark: 'Fabric defect', qcSign: '' },
];

/** End-bit register (kg per roll) — editable in Reconciliation. */
export const seedEndBits = {
  1: { 'R-01': { weight: 1.55, reusable: true }, 'R-02': { weight: 0.6, reusable: false }, 'R-03': { weight: 0.35, reusable: false } },
};

/** Approx kg consumed by re-cutting per Cut PO (roll usage outside lays). */
export const seedReCutFabricKg = { 1: 1.2 };
