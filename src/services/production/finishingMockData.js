/**
 * Seed data for the Finishing module mock (design phase). Continues the story:
 * order SG/26-27/1001 (HM-TS-2601 navy tee) sewn on Line-A; finished goods now
 * flow receiving → trimming → checking → ironing → detection → segregation.
 */
import dayjs from 'dayjs';

const day = (offset) => dayjs().add(offset, 'day').format('YYYY-MM-DD');
const today = day(0);

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

/**
 * Buyer spec points per style and size. Finishing still runs on its own mock,
 * so it carries its own chart rather than borrowing the sewing module's - the
 * real chart lives in mst_measurement_specs and lands here when Finishing is
 * cut over to the backend.
 */
export const specPoints = (styleNo, size) => {
  const base = styleNo === 'HM-TS-2601'
    ? [['Chest round', 104, 1], ['Center back length', 72, 1], ['Sleeve length', 23.5, 0.5], ['Neck width', 18.5, 0.5], ['Bottom hem width', 100, 1]]
    : [['Waist', 82, 1], ['Inseam', 78, 1], ['Front rise', 26, 0.5], ['Thigh round', 58, 1]];
  const sizeShift = { S: -4, M: 0, L: 4, XL: 8, 30: -4, 32: 0, 34: 4, 36: 8 }[size] ?? 0;
  return base.map(([point, spec, tol]) => ({
    point,
    spec: spec + (point.includes('length') || point.includes('rise') ? sizeShift / 2 : sizeShift),
    tol,
    actual: null,
    remarks: '',
  }));
};

/** Every point on the buyer sheet, as an Excel import would bring them in. */
export const fullMeasurementChart = (styleNo, size) => {
  const extra = styleNo === 'HM-TS-2601'
    ? [['Shoulder width', 44, 0.5], ['Armhole straight', 24, 0.5], ['Sleeve opening', 17, 0.5], ['Neck drop front', 9.5, 0.3], ['Neck drop back', 2.5, 0.3]]
    : [['Back rise', 36, 0.5], ['Knee round', 44, 1], ['Leg opening', 36, 1], ['Belt loop length', 5.5, 0.3]];
  const sizeShift = { S: -2, M: 0, L: 2, XL: 4, 30: -2, 32: 0, 34: 2, 36: 4 }[size] ?? 0;
  return [
    ...specPoints(styleNo, size),
    ...extra.map(([point, spec, tol]) => ({ point, spec: spec + sizeShift / 2, tol, actual: null, remarks: '' })),
  ];
};

export const seedEmployees = [
  { id: 1, code: 'FN-201', name: 'G. Selvi', station: 'THREAD_TRIM', status: 'ACTIVE' },
  { id: 2, code: 'FN-202', name: 'T. Malar', station: 'THREAD_TRIM', status: 'ACTIVE' },
  { id: 3, code: 'FN-203', name: 'D. Revathi', station: 'THREAD_TRIM', status: 'ACTIVE' },
  { id: 4, code: 'FN-204', name: 'S. Kumari', station: 'KAJA_BUTTON', status: 'ACTIVE' },
  { id: 5, code: 'FN-205', name: 'B. Vasanthi', station: 'KAJA_BUTTON', status: 'ACTIVE' },
  { id: 6, code: 'FN-206', name: 'N. Pechiamma', station: 'IRONING', status: 'ACTIVE' },
  { id: 7, code: 'FN-207', name: 'R. Chitra', station: 'IRONING', status: 'ACTIVE' },
  { id: 8, code: 'FN-208', name: 'K. Uma', station: 'FIRST_CHECK', status: 'ACTIVE' },
  { id: 9, code: 'FN-209', name: 'L. Jaya', station: 'FINAL_CHECK', status: 'ACTIVE' },
  { id: 10, code: 'FN-210', name: 'P. Eswari', station: 'SPOT_WASH', status: 'ACTIVE' },
  { id: 11, code: 'FN-211', name: 'M. Rani', station: 'SHADE', status: 'ACTIVE' },
];

/** Module 1 (rev) — receiving against a sewing Garment Issue (size-wise). */
export const seedReceivings = [
  {
    id: 1, receivingNo: 'FRN-20260813-001', orderId: 1, color: 'Navy Blue', date: day(-2),
    issueNo: 'GIS-20260813-001', trimmingPoNo: 'TPO/26-27/0041', checkingPoNo: 'KPO/26-27/0018',
    lines: [
      { size: 'S', issuedQty: 82, receivedQty: 78 },
      { size: 'M', issuedQty: 50, receivedQty: 52 },
    ],
    status: 'SHORTAGE',
  },
];

/** Modules 2/3/6 — hourly sheets keyed by station (PRD §19 pattern). */
export const seedHourlySheets = [
  {
    id: 1, station: 'THREAD_TRIM', orderId: 1, color: 'Navy Blue', date: today, target: 220, ratePerPiece: 0.6,
    rows: [
      { employeeId: 1, hr1: 30, hr2: 32, hr3: 31, hr4: 30, hr5: 33, hr6: 31, hr7: 32, hr8: null, ot: null },
      { employeeId: 2, hr1: 27, hr2: 28, hr3: 30, hr4: 29, hr5: 28, hr6: 30, hr7: 29, hr8: null, ot: null },
      { employeeId: 3, hr1: 34, hr2: 35, hr3: 36, hr4: 34, hr5: 35, hr6: 36, hr7: 35, hr8: null, ot: null },
    ],
  },
  {
    id: 2, station: 'KAJA_BUTTON', orderId: 1, color: 'Navy Blue', date: today, target: 200, ratePerPiece: 0.9,
    rows: [
      { employeeId: 4, hr1: 26, hr2: 27, hr3: 28, hr4: 27, hr5: 26, hr6: 28, hr7: 27, hr8: null, ot: null },
      { employeeId: 5, hr1: 24, hr2: 24, hr3: 25, hr4: 23, hr5: 24, hr6: 25, hr7: 24, hr8: null, ot: null },
    ],
  },
  {
    id: 3, station: 'IRONING', orderId: 1, color: 'Navy Blue', date: today, target: 180,
    ratePerPiece: 1.5, ironTemp: '150°C', ironMethod: 'Steam',
    rows: [
      { employeeId: 6, hr1: 25, hr2: 26, hr3: 27, hr4: 26, hr5: 27, hr6: 26, hr7: 27, hr8: null, ot: null },
      { employeeId: 7, hr1: 22, hr2: 23, hr3: 22, hr4: 24, hr5: 23, hr6: 22, hr7: 23, hr8: null, ot: null },
    ],
  },
  {
    id: 4, station: 'FIRST_CHECK', orderId: 1, color: 'Navy Blue', date: today, target: 200, ratePerPiece: 0.7,
    rows: [
      { employeeId: 8, hr1: 24, hr2: 25, hr3: 26, hr4: 25, hr5: 24, hr6: 26, hr7: 25, hr8: null, ot: null },
    ],
  },
  {
    id: 5, station: 'FINAL_CHECK', orderId: 1, color: 'Navy Blue', date: today, target: 190, ratePerPiece: 0.8,
    rows: [
      { employeeId: 9, hr1: 22, hr2: 23, hr3: 22, hr4: 23, hr5: 24, hr6: 23, hr7: 22, hr8: null, ot: null },
    ],
  },
];

/** Module 4 — spot wash batch rows (in = pass + reject at day end). */
export const seedSpotWash = [
  { id: 1, date: today, orderId: 1, stainType: 'Oil', employeeId: 10, pcsIn: 14, pcsPass: 12, pcsReject: 2 },
  { id: 2, date: today, orderId: 1, stainType: 'Pen', employeeId: 10, pcsIn: 6, pcsPass: 6, pcsReject: 0 },
  { id: 3, date: day(-1), orderId: 1, stainType: 'Dirt', employeeId: 10, pcsIn: 9, pcsPass: 9, pcsReject: 0 },
];

/** Module 5 — checking sheets: pre-final 100% + final AQL lot. */
export const seedCheckings = [
  {
    id: 1, checkNo: 'FCK-20260815-001', stage: 'PRE_FINAL', orderId: 1, color: 'Navy Blue',
    date: today, target: 190,
    rows: [
      { employeeId: 8, hr1: 24, hr2: 25, hr3: 26, hr4: 25, hr5: 24, hr6: 26, hr7: 25, hr8: null, ot: null },
      { employeeId: 9, hr1: 22, hr2: 23, hr3: 22, hr4: 23, hr5: 24, hr6: 23, hr7: 22, hr8: null, ot: null },
    ],
    passQty: 320, alterQty: 12, rejectQty: 2,
    defects: [
      { code: 'M-03', count: 4 }, { code: 'M-01', count: 3 }, { code: 'N-01', count: 2 },
      { code: 'M-07', count: 2 }, { code: 'N-02', count: 1 },
    ],
    labelChecks: { 'Brand label': true, 'Size label': true, 'Care label': true, 'Country of origin': true },
    status: 'COMPLETED',
  },
  {
    id: 2, checkNo: 'FCK-20260814-001', stage: 'FINAL', orderId: 1, color: 'Navy Blue',
    date: day(-1), lotSize: 380, sampleSize: 50, acceptNo: 3, rejectNo: 4,
    rows: [{ employeeId: 8, hr1: 12, hr2: 13, hr3: 13, hr4: 12, hr5: null, hr6: null, hr7: null, hr8: null, ot: null }],
    passQty: 48, alterQty: 2, rejectQty: 0,
    defects: [{ code: 'M-03', count: 1 }, { code: 'M-08', count: 1 }],
    verdict: 'ACCEPTED', status: 'COMPLETED',
  },
];

/** Module 7 — post-iron measurement audits (one FAIL → lot HOLD). */
export const seedMeasurements = [
  {
    id: 1, reportNo: 'FMR-20260815-001', orderId: 1, color: 'Navy Blue', size: 'M',
    date: today, sampleSize: 5, ironOperatorId: 6, overallResult: 'FAIL', lotStatus: 'HOLD',
    points: [
      { point: 'Chest round', spec: 104, tol: 1, actual: 103.6 },
      { point: 'Center back length', spec: 72, tol: 1, actual: 70.7 },
      { point: 'Sleeve length', spec: 23.5, tol: 0.5, actual: 23.4 },
      { point: 'Neck width', spec: 18.5, tol: 0.5, actual: 18.6 },
    ],
    remarks: 'Length shrinkage after steam press — re-measure after relax, suspect over-pressing',
  },
  {
    id: 2, reportNo: 'FMR-20260814-001', orderId: 1, color: 'Navy Blue', size: 'L',
    date: day(-1), sampleSize: 5, ironOperatorId: 7, overallResult: 'PASS', lotStatus: 'RELEASED',
    points: [
      { point: 'Chest round', spec: 108, tol: 1, actual: 108.2 },
      { point: 'Center back length', spec: 74, tol: 1, actual: 73.8 },
      { point: 'Sleeve length', spec: 24, tol: 0.5, actual: 24.1 },
    ],
    remarks: '',
  },
];

/** Module 8 — alteration register (defect code + source + re-check loop). */
export const seedAlterations = [
  { id: 1, alterNo: 'ALT-20260815-001', orderId: 1, color: 'Navy Blue', size: 'M', date: today, qtyChecked: 160, alterPcs: 6, defectCode: 'M-03', source: 'FINISHING', productionUnit: 'Unit-1 Tirupur', doneById: 10, recheckResult: 'PASS', cycles: 1, remarks: 'Oil spots removed at spot wash', status: 'CLOSED' },
  { id: 2, alterNo: 'ALT-20260815-002', orderId: 1, color: 'Navy Blue', size: 'M', date: today, qtyChecked: 174, alterPcs: 4, defectCode: 'M-01', source: 'SEWING', productionUnit: 'Unit-1 Tirupur', doneById: 9, recheckResult: 'PENDING', cycles: 1, remarks: 'Sent back for re-stitch at Line-A', status: 'IN_PROGRESS' },
  { id: 3, alterNo: 'ALT-20260815-003', orderId: 1, color: 'Navy Blue', size: 'L', date: today, qtyChecked: 168, alterPcs: 2, defectCode: 'M-07', source: 'SEWING', productionUnit: 'Unit-2 Avinashi', doneById: 9, recheckResult: 'RE_ALTER', cycles: 3, remarks: 'Armhole puckering persists after two repairs', status: 'IN_PROGRESS' },
  { id: 4, alterNo: 'ALT-20260814-001', orderId: 1, color: 'Navy Blue', size: 'M', date: day(-1), qtyChecked: 150, alterPcs: 3, defectCode: 'M-08', source: 'TRIM', productionUnit: 'Unit-1 Tirupur', doneById: 4, recheckResult: 'PASS', cycles: 1, remarks: 'Buttons re-attached', status: 'CLOSED' },
];

/** Module 9 — metal detection day logs + needle log (buyer compliance). */
export const seedMetalDetection = [
  {
    id: 1, date: today, machineNo: 'MD-01', orderId: 1, calibrationOk: true,
    calibratedAt: '08:05', testCards: ['Ferrous', 'Non-ferrous', 'Stainless'],
    totalScanned: 320, pass: 319, fail: 1, rescan: 1, finalReject: 0,
    remarks: 'One false positive — snap hardware, cleared on re-scan',
  },
  {
    id: 2, date: today, machineNo: 'MD-02', orderId: 1, calibrationOk: false,
    calibratedAt: null, testCards: [],
    totalScanned: 0, pass: 0, fail: 0, rescan: 0, finalReject: 0,
    remarks: 'Shift calibration overdue — scanning blocked',
  },
];

export const seedNeedleLog = [
  { id: 1, date: today, shift: 'DAY', operator: 'Line-A / M-12', issued: 4, returned: 4, broken: 0, allPiecesFound: true },
  { id: 2, date: day(-1), shift: 'DAY', operator: 'Line-A / M-07', issued: 4, returned: 4, broken: 1, allPiecesFound: true },
];

/** Module 10 — shade segregation by fabric lot (D65 light box). */
export const seedShadeGroups = [
  { id: 1, date: day(-1), orderId: 1, color: 'Navy Blue', fabricLot: 'FL-2601-A', shadeBand: 'B', qty: 356, lightBox: true, inspectorId: 11, status: 'SEGREGATED' },
  { id: 2, date: today, orderId: 1, color: 'Navy Blue', fabricLot: 'FL-2601-B', shadeBand: 'A', qty: 168, lightBox: true, inspectorId: 11, status: 'SEGREGATED' },
];
