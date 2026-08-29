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
    otherChargesPct: 8, loadingDate: day(-4), settingHours: 4, status: 'IN_PROGRESS',
    operations: [
      { seq: 1, operation: 'Shoulder join', machine: 'Overlock', sam: 0.9, operatorId: 1, rate: 2.5 },
      { seq: 2, operation: 'Neck rib attach', machine: 'Overlock', sam: 1.2, operatorId: 2, rate: 3.4 },
      { seq: 3, operation: 'Collar attach', machine: 'SNLS', sam: 1.8, operatorId: 2, rate: 5.1 },
      { seq: 4, operation: 'Sleeve attach', machine: 'Overlock', sam: 1.6, operatorId: 3, rate: 4.5 },
      { seq: 5, operation: 'Side seam', machine: 'Overlock', sam: 2.0, operatorId: 3, rate: 5.6 },
      { seq: 6, operation: 'Sleeve hem', machine: 'Flatlock', sam: 1.4, operatorId: 4, rate: 3.9 },
      { seq: 7, operation: 'Bottom hem', machine: 'Flatlock', sam: 1.5, operatorId: 5, rate: 4.2 },
      { seq: 8, operation: 'Label attach', machine: 'SNLS', sam: 1.0, operatorId: 6, rate: 2.8 },
      { seq: 9, operation: 'Bartack', machine: 'Bartack', sam: 1.0, operatorId: 6, rate: 2.8 },
    ],
  },
  {
    id: 2, planNo: 'SPL-2026-0002', orderId: 2, line: 'Line-B', planDate: day(-1),
    startDate: day(6), endDate: day(35), totalQty: 1500, sam: 6.9,
    operators: 8, helpers: 3, workingHours: 8, targetEfficiencyPct: 55, pricePerPiece: 62,
    otherChargesPct: 10, loadingDate: day(6), settingHours: 6, status: 'DRAFT',
    operations: [
      { seq: 1, operation: 'Side seam', machine: 'DNLS', sam: 3.2, operatorId: 7, rate: 9.0 },
      { seq: 2, operation: 'Bottom hem', machine: 'DNLS', sam: 2.1, operatorId: 8, rate: 5.9 },
      { seq: 3, operation: 'Bartack', machine: 'Bartack', sam: 1.6, operatorId: 8, rate: 4.5 },
    ],
  },
];

/** CR-SEW-005 — BOM items per order (mirrors GET /api/v1/bom/{orderId}/items). */
export const seedBomItems = {
  1: [
    { id: 101, category: 'Fabric & Materials', name: 'Single Jersey 180 GSM — Navy', spec: '100% cotton, Pantone 19-3933', qty: '576 kg', supplier: 'Sharadha Terry' },
    { id: 102, category: 'Fabric & Materials', name: 'Neck rib 1x1 — Navy', spec: 'Self shade, 40 GSM allowance', qty: '38 kg', supplier: 'Sharadha Terry' },
    { id: 103, category: 'Trims & Accessories', name: 'Main label — H&M woven', spec: 'Art HM-ML-104', qty: '1,850 pcs', supplier: 'Trimco India' },
    { id: 104, category: 'Trims & Accessories', name: 'Size + care label set', spec: 'Printed satin, EN 14682', qty: '1,850 sets', supplier: 'Trimco India' },
    { id: 105, category: 'Trims & Accessories', name: 'Sewing thread — Navy 402', spec: 'Coats Epic 120', qty: '96 cones', supplier: 'Coats India' },
    { id: 106, category: 'Trims & Accessories', name: 'Chest print — logo', spec: 'Plastisol, 2-colour', qty: '1,820 pcs', supplier: 'PrintWorks' },
    { id: 107, category: 'Approvals & Tests', name: 'PP sample approval', spec: 'Buyer comment sheet #PP-1104', qty: '1', supplier: '—' },
    { id: 108, category: 'Approvals & Tests', name: 'GPT report', spec: 'SGS — pending upload', qty: '1', supplier: 'SGS' },
    { id: 109, category: 'Approvals & Tests', name: 'Shade band approval', spec: 'Band A/B approved', qty: '1', supplier: '—' },
  ],
  2: [
    { id: 201, category: 'Fabric & Materials', name: 'Denim 12 oz — Indigo', spec: '98/2 cotton-spandex', qty: '825 kg', supplier: 'Arvind Mills' },
    { id: 202, category: 'Trims & Accessories', name: 'YKK zipper #4.5', spec: 'YG brass, 18 cm', qty: '1,520 pcs', supplier: 'YKK India' },
    { id: 203, category: 'Trims & Accessories', name: 'Shank button 17 mm', spec: 'Antique brass', qty: '1,540 pcs', supplier: 'Trimco India' },
    { id: 204, category: 'Approvals & Tests', name: 'Wash standard approval', spec: 'Mid-stone wash ref MSW-3', qty: '1', supplier: '—' },
  ],
};

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

/** CR-SEW-005 — items reference BOM (bomItemId), binary CORRECT/INCORRECT. */
export const seedTrimCards = [
  {
    id: 1, cardNo: 'TVC-20260811-001', orderId: 1, date: day(-4), checkType: 'PILOT_RUN',
    verifiedBy: 'QC - S. Devi', approvedBy: 'PM - N. Kumar', status: 'VERIFIED',
    physicallyVerified: true, verifiedAt: `${day(-4)} 10:42`,
    items: [
      { bomItemId: 101, status: 'CORRECT', remarks: '' },
      { bomItemId: 102, status: 'CORRECT', remarks: '' },
      { bomItemId: 103, status: 'CORRECT', remarks: '' },
      { bomItemId: 104, status: 'CORRECT', remarks: '' },
      { bomItemId: 105, status: 'INCORRECT', remarks: 'Cone shade off vs approved — replaced by store before loading' },
      { bomItemId: 106, status: 'CORRECT', remarks: '' },
      { bomItemId: 107, status: 'CORRECT', remarks: '' },
      { bomItemId: 108, status: 'INCORRECT', remarks: 'GPT report not yet uploaded — chase SGS' },
      { bomItemId: 109, status: 'CORRECT', remarks: '' },
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

/** CR-SEW-006 — hour-wise rows with per-row rework (capped at count). */
export const seedTopse = [
  {
    id: 1, reportNo: 'TOPSE-20260814-001', orderId: 1, line: 'Line-A', date: day(-1),
    totalInspected: 260,
    defects: [
      { hour: 'Hr 1', category: 'Stitching Defects', type: 'Skip stitch', count: 2, rework: 2 },
      { hour: 'Hr 2', category: 'Stitching Defects', type: 'Broken stitch', count: 2, rework: 2 },
      { hour: 'Hr 4', category: 'Construction Defects', type: 'Puckering', count: 2, rework: 1 },
      { hour: 'Hr 5', category: 'Stitching Defects', type: 'Skip stitch', count: 2, rework: 2 },
      { hour: 'Hr 5', category: 'Appearance Defects', type: 'Oil stain', count: 2, rework: 1 },
      { hour: 'Hr 7', category: 'Trim/Accessory Defects', type: 'Label misplacement', count: 1, rework: 1 },
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
