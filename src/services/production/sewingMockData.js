/**
 * Seed data for the Sewing module mock (design phase). Continues the Session-1
 * cutting story: order SG/26-27/1001 (HM-TS-2601 navy tee), bundles B-1..B-3
 * issued from cutting via BIS-20260812-001 to Line-A.
 */
import dayjs from 'dayjs';

const day = (offset) => dayjs().add(offset, 'day').format('YYYY-MM-DD');

export const seedOrders = [
  {
    id: 1, orderNo: 'SG/26-27/1001', styleNo: 'HM-TS-2601', buyer: 'H&M Hennes & Mauritz AB',
    color: 'Navy Blue', description: "Men's Crew Neck T-Shirt", sizes: ['S', 'M', 'L', 'XL'],
    sizeQty: { S: 300, M: 600, L: 600, XL: 300 }, orderQty: 1800, deliveryDate: day(40), cmRate: 38,
  },
  {
    id: 2, orderNo: 'SG/26-27/1002', styleNo: 'PRK-DN-2603', buyer: 'Primark Stores Ltd',
    color: 'Indigo', description: "Men's Slim Fit Denim Jeans", sizes: ['30', '32', '34', '36'],
    sizeQty: { 30: 400, 32: 500, 34: 400, 36: 200 }, orderQty: 1500, deliveryDate: day(55), cmRate: 62,
  },
];

export const seedOperators = [
  { id: 1, code: 'OP-101', name: 'S. Lakshmi', joining: '2022-04-11', primarySkill: 'Shoulder join', machines: ['Overlock', 'SNLS'], line: 'Line-A', status: 'ACTIVE', grades: { 'Shoulder join': 'A', 'Side seam': 'A', 'Sleeve attach': 'B', 'Bottom hem': 'B' } },
  { id: 2, code: 'OP-102', name: 'R. Meena', joining: '2023-01-05', primarySkill: 'Collar attach', machines: ['SNLS'], line: 'Line-A', status: 'ACTIVE', grades: { 'Collar attach': 'A', 'Neck rib attach': 'A', 'Label attach': 'B' } },
  { id: 3, code: 'OP-103', name: 'K. Devi', joining: '2023-08-19', primarySkill: 'Side seam', machines: ['Overlock'], line: 'Line-A', status: 'ACTIVE', grades: { 'Side seam': 'B', 'Sleeve attach': 'B', 'Shoulder join': 'C' } },
  { id: 4, code: 'OP-104', name: 'M. Banu', joining: '2024-02-02', primarySkill: 'Sleeve hem', machines: ['Flatlock'], line: 'Line-A', status: 'ACTIVE', grades: { 'Sleeve hem': 'B', 'Bottom hem': 'B', 'Side seam': 'C' } },
  { id: 5, code: 'OP-105', name: 'A. Fathima', joining: '2024-06-15', primarySkill: 'Bottom hem', machines: ['Flatlock', 'SNLS'], line: 'Line-A', status: 'ACTIVE', grades: { 'Bottom hem': 'B', 'Sleeve hem': 'C', 'Label attach': 'C' } },
  { id: 6, code: 'OP-106', name: 'P. Kavitha', joining: '2025-01-20', primarySkill: 'Label attach', machines: ['SNLS', 'Bartack'], line: 'Line-A', status: 'ACTIVE', grades: { 'Label attach': 'C', 'Bartack': 'C', 'Neck rib attach': 'D' } },
  { id: 7, code: 'OP-107', name: 'V. Shanthi', joining: '2021-11-30', primarySkill: 'Sleeve attach', machines: ['Overlock', 'SNLS'], line: 'Line-B', status: 'ON_LEAVE', grades: { 'Sleeve attach': 'A', 'Shoulder join': 'A', 'Side seam': 'B' } },
  { id: 8, code: 'OP-108', name: 'J. Amutha', joining: '2025-05-02', primarySkill: 'Bartack', machines: ['Bartack'], line: 'Line-B', status: 'ACTIVE', grades: { Bartack: 'B', 'Label attach': 'C' } },
];

/** SAM values per style/operation (PRD 5.2). Total garment SAM auto = sum. */
export const seedSamValues = [
  {
    styleNo: 'HM-TS-2601', source: 'TIME_STUDY', approvedBy: 'IE - R. Prakash',
    operations: [
      { operation: 'Shoulder join', machine: 'Overlock', sam: 0.9 },
      { operation: 'Neck rib attach', machine: 'Overlock', sam: 1.2 },
      { operation: 'Collar attach', machine: 'SNLS', sam: 1.8 },
      { operation: 'Sleeve attach', machine: 'Overlock', sam: 1.6 },
      { operation: 'Side seam', machine: 'Overlock', sam: 2.0 },
      { operation: 'Sleeve hem', machine: 'Flatlock', sam: 1.4 },
      { operation: 'Bottom hem', machine: 'Flatlock', sam: 1.5 },
      { operation: 'Label attach', machine: 'SNLS', sam: 1.0 },
      { operation: 'Bartack', machine: 'Bartack', sam: 1.0 },
    ],
  },
  {
    styleNo: 'PRK-DN-2603', source: 'ESTIMATED', approvedBy: 'IE - R. Prakash',
    operations: [
      { operation: 'Side seam', machine: 'DNLS', sam: 3.2 },
      { operation: 'Bottom hem', machine: 'DNLS', sam: 2.1 },
      { operation: 'Bartack', machine: 'Bartack', sam: 1.6 },
    ],
  },
];

export const seedPlans = [
  {
    id: 1, planNo: 'SPL-2026-0001', orderId: 1, line: 'Line-A', planDate: day(-6),
    startDate: day(-4), endDate: day(18), totalQty: 1800, sam: 12.4,
    operators: 6, helpers: 2, workingHours: 8, targetEfficiencyPct: 65, pricePerPiece: 38,
    loadingDate: day(-4), settingHours: 4, status: 'IN_PROGRESS',
    operations: [
      { seq: 1, operation: 'Shoulder join', machine: 'Overlock', sam: 0.9, operatorId: 1 },
      { seq: 2, operation: 'Neck rib attach', machine: 'Overlock', sam: 1.2, operatorId: 2 },
      { seq: 3, operation: 'Collar attach', machine: 'SNLS', sam: 1.8, operatorId: 2 },
      { seq: 4, operation: 'Sleeve attach', machine: 'Overlock', sam: 1.6, operatorId: 3 },
      { seq: 5, operation: 'Side seam', machine: 'Overlock', sam: 2.0, operatorId: 3 },
      { seq: 6, operation: 'Sleeve hem', machine: 'Flatlock', sam: 1.4, operatorId: 4 },
      { seq: 7, operation: 'Bottom hem', machine: 'Flatlock', sam: 1.5, operatorId: 5 },
      { seq: 8, operation: 'Label attach', machine: 'SNLS', sam: 1.0, operatorId: 6 },
      { seq: 9, operation: 'Bartack', machine: 'Bartack', sam: 1.0, operatorId: 6 },
    ],
  },
  {
    id: 2, planNo: 'SPL-2026-0002', orderId: 2, line: 'Line-B', planDate: day(-1),
    startDate: day(6), endDate: day(35), totalQty: 1500, sam: 6.9,
    operators: 8, helpers: 3, workingHours: 8, targetEfficiencyPct: 55, pricePerPiece: 62,
    loadingDate: day(6), settingHours: 6, status: 'DRAFT',
    operations: [
      { seq: 1, operation: 'Side seam', machine: 'DNLS', sam: 3.2, operatorId: 7 },
      { seq: 2, operation: 'Bottom hem', machine: 'DNLS', sam: 2.1, operatorId: 8 },
      { seq: 3, operation: 'Bartack', machine: 'Bartack', sam: 1.6, operatorId: 8 },
    ],
  },
];

/** Cut parts receipts — from cutting Bundle Issue BIS-20260812-001 (B-1..B-3). */
export const seedCutReceipts = [
  {
    id: 1, receiptNo: 'SCR-20260812-001', orderId: 1, line: 'Line-A', bundleIssueNo: 'BIS-20260812-001',
    date: day(-3), receivedBy: 'Line Supervisor - G. Ravi', status: 'DISCREPANCY',
    bundles: [
      { size: 'S', bundleNo: 'B-1', serialRange: '1-50', qty: 50, quality: 'OK', remarks: '' },
      { size: 'S', bundleNo: 'B-2', serialRange: '51-84', qty: 32, quality: 'SHORTAGE', remarks: '2 pcs short vs ticket (34)' },
      { size: 'M', bundleNo: 'B-3', serialRange: '1-50', qty: 50, quality: 'OK', remarks: '' },
    ],
  },
];

export const seedGarmentIssues = [
  {
    id: 1, issueNo: 'GIS-20260813-001', orderId: 1, date: day(-2), issuedBy: 'Store - K. Mohan',
    receivedBy: 'G. Ravi', status: 'ACKNOWLEDGED',
    lines: [
      { size: 'S', orderQty: 300, prevIssued: 0, currentQty: 82 },
      { size: 'M', orderQty: 600, prevIssued: 0, currentQty: 50 },
    ],
  },
];

/** One production day on Line-A (today) — 6 operators, hourly counts. */
export const seedHourly = [
  {
    id: 1, planId: 1, orderId: 1, line: 'Line-A', date: day(0), shift: 'DAY',
    plannedOperators: 6, presentOperators: 5, status: 'IN_PROGRESS',
    rows: [
      { operatorId: 1, part: 'Shoulder join', hr1: 28, hr2: 30, hr3: 31, hr4: 29, hr5: 30, hr6: 32, hr7: 30, hr8: null, ot: null },
      { operatorId: 2, part: 'Neck rib + Collar', hr1: 24, hr2: 26, hr3: 25, hr4: 27, hr5: 26, hr6: 25, hr7: 27, hr8: null, ot: null },
      { operatorId: 3, part: 'Sleeve + Side seam', hr1: 20, hr2: 22, hr3: 21, hr4: 23, hr5: 22, hr6: 24, hr7: 22, hr8: null, ot: null },
      { operatorId: 4, part: 'Sleeve hem', hr1: 26, hr2: 27, hr3: 28, hr4: 26, hr5: 28, hr6: 27, hr7: 28, hr8: null, ot: null },
      { operatorId: 5, part: 'Bottom hem', hr1: 25, hr2: 26, hr3: 27, hr4: 25, hr5: 27, hr6: 26, hr7: 26, hr8: null, ot: null },
    ],
  },
];

export const seedTrimCards = [
  {
    id: 1, cardNo: 'TVC-20260811-001', orderId: 1, date: day(-4), checkType: 'PILOT_RUN',
    verifiedBy: 'QC - S. Devi', approvedBy: 'PM - N. Kumar', status: 'ISSUES_FOUND',
    materials: {
      Fabric: 'ACTUAL', 'Main Label': 'ACTUAL', 'Size Label': 'ACTUAL', 'C/C Label': 'ALTERNATE',
      Thread: 'ACTUAL', Buttons: 'NOT_APPLICABLE', Zipper: 'NOT_APPLICABLE', Interlining: 'NOT_APPLICABLE',
      Embroidery: 'NOT_APPLICABLE', Printing: 'ACTUAL', 'Bead Works': 'NOT_APPLICABLE', Pocketing: 'NOT_APPLICABLE',
    },
    approvals: {
      Washing: 'ACTUAL', Sample: 'ACTUAL', 'PP Comment': 'ACTUAL', GPT: 'MISSING',
      FPT: 'ACTUAL', Shrinkage: 'ACTUAL', 'Shade Band': 'ACTUAL',
    },
    issues: [
      { description: 'Found flap, pcs center off', severity: 'MAJOR', rootCause: 'Pattern alignment', action: 'Re-set folder guide before bulk', status: 'RESOLVED', resolvedOn: day(-3) },
      { description: 'Armhole joint up and down', severity: 'MAJOR', rootCause: 'Operator handling', action: 'Retrain OP-103; add notch check', status: 'OPEN', resolvedOn: null },
    ],
  },
];

export const seedMeasurements = [
  {
    id: 1, reportNo: 'SMR-20260814-001', orderId: 1, stage: 'IN_LINE', size: 'M',
    date: day(-1), inspector: 'QC - S. Devi', result: 'CONDITIONAL',
    points: [
      { point: 'Chest round', spec: 104.0, tol: 1.0, actual: 104.5, remarks: '' },
      { point: 'Center back length', spec: 72.0, tol: 1.0, actual: 73.4, remarks: 'Stretch during handling' },
      { point: 'Sleeve length', spec: 23.5, tol: 0.5, actual: 23.4, remarks: '' },
      { point: 'Neck width', spec: 18.5, tol: 0.5, actual: 18.6, remarks: '' },
      { point: 'Bottom hem width', spec: 100.0, tol: 1.0, actual: 100.4, remarks: '' },
    ],
  },
];

export const seedTopse = [
  {
    id: 1, reportNo: 'TOPSE-20260814-001', orderId: 1, line: 'Line-A', date: day(-1),
    totalInspected: 260, totalRework: 9,
    defects: [
      { category: 'Stitching Defects', type: 'Skip stitch', count: 4 },
      { category: 'Stitching Defects', type: 'Broken stitch', count: 2 },
      { category: 'Construction Defects', type: 'Puckering', count: 2 },
      { category: 'Appearance Defects', type: 'Oil stain', count: 2 },
      { category: 'Trim/Accessory Defects', type: 'Label misplacement', count: 1 },
    ],
  },
];

export const seedReplacements = [
  {
    id: 1, requestNo: 'CPR-20260813-001', orderId: 1, date: day(-2), requestedBy: 'G. Ravi (Line-A)',
    status: 'REPLACEMENT_CUT',
    parts: [
      { size: 'M', serialNo: 'B-3/S-21', part: 'Front panel', reason: 'FABRIC_DEFECT', pieces: 2, replStatus: 'CUT', replDate: day(-1) },
      { size: 'S', serialNo: 'B-1/S-08', part: 'Sleeve', reason: 'CUTTING_ERROR', pieces: 3, replStatus: 'PENDING', replDate: null },
    ],
  },
];
