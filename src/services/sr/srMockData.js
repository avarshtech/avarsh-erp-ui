/**
 * Seed data for the Sample Request mock layer (R2 flow). All dates are
 * computed relative to "today" so the demo always shows a live spread:
 * submitted SRs across the type tabs (material-issue demo), a combined draft
 * dispatch (gate demo), dispatched/closed SRs with dispatch records, and
 * invoices in every status across both types.
 */
import dayjs from 'dayjs';
import { SAMPLE_TYPE_LIST } from '../../utils/sampleRequestConstants';
import { computeSampleQtyRequired } from '../../utils/sampleBomMapper';
import { docNo, fiscalYearLabel, SR_DOC_PREFIX } from './srDocNumbers';

export const SEED_VERSION = 9;

const d = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
const ts = (offsetDays, time = '10:00') =>
  `${dayjs().add(offsetDays, 'day').format('YYYY-MM-DD')} ${time}`;

// ── Master seeds ───────────────────────────────────────────────────────────

// FIXED list of eight (R2) — seeded verbatim from the constant, no user-created types
export const SEED_SAMPLE_TYPES = SAMPLE_TYPE_LIST.map((t) => ({ ...t, active: true, custom: false }));

export const SEED_COURIERS = [
  { id: 1, name: 'DHL Express', isLocal: false },
  { id: 2, name: 'FedEx', isLocal: false },
  { id: 3, name: 'UPS', isLocal: false },
  { id: 4, name: 'Aramex', isLocal: false },
  { id: 5, name: 'DTDC', isLocal: false },
  { id: 6, name: 'Hand Delivered — Buying Office', isLocal: true },
];

export const SEED_BUYING_OFFICES = [
  { id: 1, name: 'Vingino Buying Office — Tiruppur' },
  { id: 2, name: 'Koalabay Buying House — Chennai' },
  { id: 3, name: 'Raizzed Liaison Office — Bengaluru' },
];

export const SEED_REJECTION_REASONS = [
  { code: 'FIT_ISSUE', label: 'Fit Issue' },
  { code: 'SHADE_VARIATION', label: 'Shade Variation' },
  { code: 'STITCHING_DEFECT', label: 'Stitching Defect' },
  { code: 'MEASUREMENT_VARIATION', label: 'Measurement Variation' },
  { code: 'FABRIC_HANDFEEL', label: 'Fabric Hand-feel' },
  { code: 'PRINT_QUALITY', label: 'Print Quality' },
  { code: 'BUYER_CHANGE', label: 'Buyer Change' },
  { code: 'OTHER', label: 'Other' },
];

export const SEED_FEEDBACK_CATEGORIES = [
  {
    buyerName: null,
    labels: { fit: 'Fit', fabricShade: 'Fabric / Shade', measurement: 'Measurement', workmanship: 'Workmanship' },
  },
];

export const SEED_HSN_CODES = [
  { category: 'Woven', code: '6206' },
  { category: 'Knit', code: '6109' },
  { category: 'Denim', code: '6203' },
  { category: 'Swatch', code: '48211010' },
  { category: 'Default', code: '6217' },
];

export const SEED_COMPANY_PROFILE_EXTRA = {
  iecNumber: '0405008481',
  swiftCode: 'UCBAINBB302',
  declarationText:
    'We declare that the goods described are samples supplied free of charge and are not for sale. '
    + 'The value shown is declared for customs purposes only and all particulars are true and correct.',
  // Chargeable SAMPLE invoice uses the actual-price wording (ref SA/FY/1001)
  declarationTextSample:
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  signatory: 'Authorised Signatory',
  exporterCountryFallback: 'India',
  invoiceSeries: [
    { code: 'EXSG', label: 'Commercial (export/customs)' },
    { code: 'SA', label: 'Sample (chargeable)' },
  ],
  defaultSeries: 'EXSG',
};

// ── SR seed factory ────────────────────────────────────────────────────────

const FABRIC = (lineNo, over = {}) => ({
  lineNo,
  bomLineId: null,
  section: 'FABRIC',
  fabricType: 'Woven',
  classification: 'Shell Fabric',
  description: 'Cotton Poplin 120 GSM',
  width: '58"',
  consumption: 1.42,
  uom: 'MTR',
  colourDesign: 'Classic Blue 19-4052',
  originalColourDesign: 'Classic Blue 19-4052',
  mandatory: false,
  poRef: null,
  ...over,
});

const TRIM = (lineNo, over = {}) => ({
  lineNo,
  bomLineId: null,
  section: 'TRIM',
  fabricType: 'Trim',
  classification: 'Button',
  description: '4-Hole Resin 18L',
  width: null,
  consumption: 11,
  uom: 'PCS',
  colourDesign: 'Tortoise TB-12',
  originalColourDesign: 'Tortoise TB-12',
  mandatory: false,
  poRef: null,
  ...over,
});

const baseMaterials = () => [
  FABRIC(1),
  FABRIC(2, { classification: 'Contrast / Placket', description: 'Yarn Dyed Check 110 GSM', width: '57"', consumption: 0.18, colourDesign: 'Red Check RC-08', originalColourDesign: 'Red Check RC-08' }),
  FABRIC(3, { fabricType: 'Knit', classification: 'Interlining', description: 'Fusible Woven 45 GSM', width: '44"', consumption: 0.22, colourDesign: 'White', originalColourDesign: 'White' }),
  TRIM(4),
  TRIM(5, { classification: 'Sewing Thread', description: 'Spun Poly 40/2', consumption: 180, uom: 'MTR', colourDesign: 'Classic Blue 19-4052', originalColourDesign: 'Classic Blue 19-4052', mandatory: true }),
  TRIM(6, { classification: 'Main Label', description: 'Woven Damask 30×50mm', consumption: 1, colourDesign: 'Buyer Standard', originalColourDesign: 'Buyer Standard', mandatory: true }),
];

let seq = 0;
const mkSr = (over = {}) => {
  seq += 1;
  return {
    id: seq,
    srNo: docNo(SR_DOC_PREFIX.REQUEST, 1000 + seq),
    orderNo: 'ORD/25-26/1042',
    bomId: null,
    styleNo: 'N58921SR-37',
    garmentName: 'Girls Woven Shirt — Long Sleeve',
    buyerName: 'Vingino',
    buyerCountry: 'India',
    season: 'Spring/Summer 2027',
    sampleTypeId: 7,
    sampleTypeName: 'SMS',
    colourSubstitutionAllowed: false,
    round: 1,
    status: 'DRAFT',
    priority: 'NORMAL',
    sampleQty: 2,
    sizes: ['104', '116', '128'],
    colourReference: 'Pantone 19-4052 Classic Blue',
    specialInstructions: '',
    inHandDate: d(5),
    dispatchDeadline: d(8),
    buyerApprovalDeadline: d(16),
    remarks: '',
    materials: baseMaterials(),
    dispatchRef: null,
    feedback: null,
    invoiceRef: null,
    statusHistory: [{ status: 'DRAFT', date: d(-2), user: 'Priya S.' }],
    activity: [
      { id: 1, timestamp: ts(-2, '11:02'), user: 'Priya S.', action: 'Sample Request created', details: '6 material lines auto-populated' },
    ],
    version: 0,
    ...over,
  };
};

export const buildSeedDb = () => {
  seq = 0;
  const requests = [
    // 1 — overseas SMS, In Production, on the DRAFT dispatch (gate demo)
    mkSr({
      orderNo: 'ORD/25-26/1051', buyerName: 'Vingino', buyerCountry: 'Netherlands',
      sampleTypeId: 7, sampleTypeName: 'SMS', priority: 'URGENT',
      status: 'IN_PRODUCTION', inHandDate: d(-1), dispatchDeadline: d(2), buyerApprovalDeadline: d(10),
      specialInstructions: 'Self-fabric loop on left sleeve placket. Send with hangtag mock-up.',
      statusHistory: [
        { status: 'DRAFT', date: d(-8), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-7), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-6), user: 'Ravi Kumar' },
      ],
    }),
    // 2 — Fit, dispatched + revision-required feedback (closed; no auto-round in R2)
    mkSr({
      orderNo: 'ORD/25-26/1042', styleNo: 'KG-6202', garmentName: 'Girls Woven Blouse', buyerName: 'Koalabay',
      sampleTypeId: 2, sampleTypeName: 'Fit', colourSubstitutionAllowed: true,
      status: 'REVISION_REQUIRED',
      inHandDate: d(-16), dispatchDeadline: d(-13), buyerApprovalDeadline: d(-5),
      dispatchRef: { dispatchId: 1, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1001) },
      feedback: {
        date: d(-4), from: 'Marieke de Vries', decision: 'REVISION_REQUIRED',
        rejectionReasonCodes: ['FIT_ISSUE', 'MEASUREMENT_VARIATION'],
        comments: {
          fit: 'Shoulder slope too square on 116. Armhole 1 cm tight across all sizes.',
          fabricShade: 'Shade acceptable against approved lab dip.',
          measurement: 'Sleeve length +1.5 cm vs spec on 128.',
          workmanship: 'Placket topstitch uneven on one piece.',
          additional: 'Corrections noted for bulk — no re-sample required.',
        },
        attachments: [{ name: 'Koalabay_CommentSheet.xlsx', size: 91500, type: 'xlsx' }],
        importSource: 'Koalabay_CommentSheet.xlsx',
      },
      statusHistory: [
        { status: 'DRAFT', date: d(-20), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-19), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-18), user: 'Ravi Kumar' },
        { status: 'DISPATCHED', date: d(-13), user: 'Suresh V.' },
        { status: 'FEEDBACK_RECEIVED', date: d(-4), user: 'Priya S.' },
        { status: 'REVISION_REQUIRED', date: d(-4), user: 'Priya S.' },
      ],
    }),
    // 3 — plain Fit DRAFT (R2: no rounds, no revised-type chain)
    mkSr({
      orderNo: 'ORD/25-26/1042', styleNo: 'KG-6202', garmentName: 'Girls Woven Blouse', buyerName: 'Koalabay',
      sampleTypeId: 2, sampleTypeName: 'Fit', colourSubstitutionAllowed: true,
      status: 'DRAFT',
      inHandDate: null, dispatchDeadline: null, buyerApprovalDeadline: null,
    }),
    // 4 — Proto, dispatched overseas w/ issued commercial invoice, awaiting feedback (has comment draft → Pending Approval)
    mkSr({
      orderNo: 'ORD/25-26/1055', styleNo: 'O56054-1', garmentName: 'Boys Denim Jacket', buyerName: 'Raizzed',
      buyerCountry: 'Netherlands', sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'DISPATCHED',
      inHandDate: d(-6), dispatchDeadline: d(-3), buyerApprovalDeadline: d(6),
      dispatchRef: { dispatchId: 2, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1002) },
      invoiceRef: { invoiceId: 1, invoiceNo: null, invoiceType: 'COMMERCIAL', declaredValue: 13.8 }, // invoiceNo filled below
      feedback: {
        date: d(-1), from: 'Anita George', decision: null,
        rejectionReasonCodes: [],
        comments: { fit: 'Initial notes — wash review pending.', fabricShade: '', measurement: '', workmanship: '', additional: '' },
        attachments: [], importSource: null,
      },
      statusHistory: [
        { status: 'DRAFT', date: d(-12), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-11), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-9), user: 'Ravi Kumar' },
        { status: 'DISPATCHED', date: d(-3), user: 'Suresh V.' },
      ],
    }),
    // 5 — PP Sample, local hand delivery, approved this week
    mkSr({
      orderNo: 'ORD/25-26/1060', styleNo: 'K64942-37', garmentName: 'Boys Cargo Short', buyerName: 'Koalabay',
      sampleTypeId: 5, sampleTypeName: 'PP Sample',
      status: 'APPROVED',
      inHandDate: d(-10), dispatchDeadline: d(-8), buyerApprovalDeadline: d(-1),
      dispatchRef: { dispatchId: 3, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1003) },
      feedback: {
        date: d(-1), from: 'Anita George', decision: 'APPROVED',
        rejectionReasonCodes: [],
        comments: { fit: 'Approved as submitted.', fabricShade: '', measurement: '', workmanship: '', additional: 'Proceed for bulk.' },
        attachments: [], importSource: null,
      },
      statusHistory: [
        { status: 'DRAFT', date: d(-14), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-13), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-12), user: 'Ravi Kumar' },
        { status: 'DISPATCHED', date: d(-8), user: 'Suresh V.' },
        { status: 'FEEDBACK_RECEIVED', date: d(-1), user: 'Priya S.' },
        { status: 'APPROVED', date: d(-1), user: 'Priya S.' },
      ],
    }),
    // 6 — Photoshoot Sample, overdue In Production (alert strip)
    mkSr({
      orderNo: 'ORD/25-26/1058', styleNo: 'L62003-1', garmentName: 'Girls Denim Jacket', buyerName: 'Vingino',
      buyerCountry: 'Netherlands',
      sampleTypeId: 4, sampleTypeName: 'Photoshoot Sample',
      status: 'IN_PRODUCTION', priority: 'URGENT',
      inHandDate: d(-4), dispatchDeadline: d(-2), buyerApprovalDeadline: d(8),
      statusHistory: [
        { status: 'DRAFT', date: d(-10), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-9), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-8), user: 'Ravi Kumar' },
      ],
    }),
    // 7 — Fit SUBMITTED, due tomorrow (material-issue tab: Fit)
    mkSr({
      orderNo: 'ORD/25-26/1061', styleNo: 'Q500017', garmentName: 'Girls Jersey Dress', buyerName: 'Raizzed',
      buyerCountry: 'Netherlands',
      sampleTypeId: 2, sampleTypeName: 'Fit', colourSubstitutionAllowed: true,
      status: 'SUBMITTED',
      inHandDate: d(0), dispatchDeadline: d(1), buyerApprovalDeadline: d(9),
      statusHistory: [
        { status: 'DRAFT', date: d(-5), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-3), user: 'Priya S.' },
      ],
    }),
    // 8 — SMS, In Production, on the DRAFT dispatch with #1
    mkSr({
      orderNo: 'ORD/25-26/1062', styleNo: 'N58924SR-37', garmentName: 'Girls Woven Blouse', buyerName: 'Vingino',
      buyerCountry: 'Netherlands', sampleTypeId: 7, sampleTypeName: 'SMS',
      status: 'IN_PRODUCTION',
      inHandDate: d(9), dispatchDeadline: d(12), buyerApprovalDeadline: d(21),
      statusHistory: [
        { status: 'DRAFT', date: d(-3), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-2), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-1), user: 'Ravi Kumar' },
      ],
    }),
    // 9 — Proto draft due today
    mkSr({
      orderNo: 'ORD/25-26/1063', styleNo: 'T77210', garmentName: 'Boys Polo — Pique', buyerName: 'Koalabay',
      sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'DRAFT',
      inHandDate: d(-1), dispatchDeadline: d(0), buyerApprovalDeadline: d(7),
    }),
    // 10 — Shipment Sample, dispatched + rejected (SAMPLE-invoice demo: didn't convert)
    mkSr({
      orderNo: 'ORD/25-26/1044', styleNo: 'M11402', garmentName: 'Girls Skort', buyerName: 'Raizzed',
      buyerCountry: 'Netherlands', sampleTypeId: 6, sampleTypeName: 'Shipment Sample',
      status: 'REJECTED',
      inHandDate: d(-25), dispatchDeadline: d(-22), buyerApprovalDeadline: d(-12),
      dispatchRef: { dispatchId: 4, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1004) },
      invoiceRef: { invoiceId: 3, invoiceNo: docNo('SA', 1001), invoiceType: 'SAMPLE', declaredValue: 592.2 },
      feedback: {
        date: d(-11), from: 'Anita George', decision: 'REJECTED',
        rejectionReasonCodes: ['BUYER_CHANGE'],
        comments: { fit: '', fabricShade: '', measurement: '', workmanship: '', additional: 'Style dropped from the range.' },
        attachments: [], importSource: null,
      },
      statusHistory: [
        { status: 'DRAFT', date: d(-30), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-29), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-27), user: 'Ravi Kumar' },
        { status: 'DISPATCHED', date: d(-22), user: 'Suresh V.' },
        { status: 'FEEDBACK_RECEIVED', date: d(-11), user: 'Priya S.' },
        { status: 'REJECTED', date: d(-11), user: 'Priya S.' },
      ],
    }),
    // 11 — Proto, comments received, DECISION PENDING (rests at Feedback Received)
    mkSr({
      orderNo: 'ORD/25-26/1046', styleNo: 'P30988-2', garmentName: 'Girls Twill Pinafore', buyerName: 'Koalabay',
      sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'FEEDBACK_RECEIVED',
      inHandDate: d(-9), dispatchDeadline: d(-7), buyerApprovalDeadline: d(2),
      dispatchRef: { dispatchId: 5, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1005) },
      feedback: {
        date: d(-1), from: 'S. Ramesh', decision: null,
        rejectionReasonCodes: [],
        comments: {
          fit: 'Waist seat fine on 104/116; buyer re-checking 128 against the updated spec.',
          fabricShade: 'Shade approved against lab dip.',
          measurement: '', workmanship: '', additional: 'Decision expected after the internal fit session.',
        },
        attachments: [], importSource: null,
      },
      statusHistory: [
        { status: 'DRAFT', date: d(-14), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-13), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-11), user: 'Ravi Kumar' },
        { status: 'DISPATCHED', date: d(-7), user: 'Suresh V.' },
        { status: 'FEEDBACK_RECEIVED', date: d(-1), user: 'Priya S.' },
      ],
    }),
    // 12 — Proto SUBMITTED (material-issue tab: Proto)
    mkSr({
      orderNo: 'ORD/25-26/1064', styleNo: 'T77219', garmentName: 'Boys Henley Tee', buyerName: 'Koalabay',
      sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'SUBMITTED',
      inHandDate: d(3), dispatchDeadline: d(6), buyerApprovalDeadline: d(14),
      statusHistory: [
        { status: 'DRAFT', date: d(-2), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-1), user: 'Priya S.' },
      ],
    }),
    // 13 — SMS SUBMITTED (material-issue tab: SMS)
    mkSr({
      orderNo: 'ORD/25-26/1065', styleNo: 'R20441', garmentName: 'Girls Chambray Skirt', buyerName: 'Raizzed',
      buyerCountry: 'Netherlands', sampleTypeId: 7, sampleTypeName: 'SMS',
      status: 'SUBMITTED',
      inHandDate: d(6), dispatchDeadline: d(9), buyerApprovalDeadline: d(18),
      statusHistory: [
        { status: 'DRAFT', date: d(-2), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(0), user: 'Priya S.' },
      ],
    }),
  ];

  const fy = fiscalYearLabel();

  // ── Dispatch entity seeds (R2): one per already-shipped SR + one combined DRAFT ──
  const dispatches = [
    {
      id: 1, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1001), status: 'DISPATCHED',
      buyerName: 'Koalabay', buyerCountry: 'India', srIds: [2],
      deliveryMethod: 'COURIER', dispatchedDate: d(-13), courierId: 1, courierName: 'DHL Express',
      trackingNo: '7712 4498 0031', dispatchMode: 'AIR', packages: 1, courierCost: 1850,
      buyingOffice: null, handedOverTo: null, acknowledgement: null,
      remarks: '2 pcs each in 104/116/128.', documents: [], dispatchedBy: 'Suresh V.',
      activity: [{ id: 1, timestamp: ts(-13, '16:02'), user: 'Suresh V.', action: 'Marked as Dispatched' }],
    },
    {
      id: 2, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1002), status: 'DISPATCHED',
      buyerName: 'Raizzed', buyerCountry: 'Netherlands', srIds: [4],
      deliveryMethod: 'COURIER', dispatchedDate: d(-3), courierId: 2, courierName: 'FedEx',
      trackingNo: '8890 1123 7745', dispatchMode: 'AIR', packages: 1, courierCost: 2400,
      buyingOffice: null, handedOverTo: null, acknowledgement: null,
      remarks: '', documents: [{ name: 'AWB_8890_1123_7745.pdf', size: 312000, type: 'pdf' }], dispatchedBy: 'Suresh V.',
      activity: [{ id: 1, timestamp: ts(-3, '15:10'), user: 'Suresh V.', action: 'Marked as Dispatched' }],
    },
    {
      id: 3, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1003), status: 'DISPATCHED',
      buyerName: 'Koalabay', buyerCountry: 'India', srIds: [5],
      deliveryMethod: 'LOCAL_HAND', dispatchedDate: d(-8), courierId: 6, courierName: 'Hand Delivered — Buying Office',
      trackingNo: null, dispatchMode: 'HAND_CARRY', packages: 1, courierCost: 0,
      buyingOffice: 'Koalabay Buying House — Chennai', handedOverTo: 'S. Ramesh', acknowledgement: 'Signed DC',
      remarks: '', documents: [{ name: 'Signed_DC_1060.pdf', size: 180000, type: 'pdf' }], dispatchedBy: 'Suresh V.',
      activity: [{ id: 1, timestamp: ts(-8, '12:30'), user: 'Suresh V.', action: 'Marked as Dispatched' }],
    },
    {
      id: 4, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1004), status: 'DISPATCHED',
      buyerName: 'Raizzed', buyerCountry: 'Netherlands', srIds: [10],
      deliveryMethod: 'COURIER', dispatchedDate: d(-22), courierId: 5, courierName: 'DTDC',
      trackingNo: 'D22019945IN', dispatchMode: 'ROAD', packages: 1, courierCost: 420,
      buyingOffice: null, handedOverTo: null, acknowledgement: null,
      remarks: '', documents: [], dispatchedBy: 'Suresh V.',
      activity: [{ id: 1, timestamp: ts(-22, '11:15'), user: 'Suresh V.', action: 'Marked as Dispatched' }],
    },
    {
      id: 5, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1005), status: 'DISPATCHED',
      buyerName: 'Koalabay', buyerCountry: 'India', srIds: [11],
      deliveryMethod: 'COURIER', dispatchedDate: d(-7), courierId: 3, courierName: 'UPS',
      trackingNo: '1Z 999 AA1 01 2345 6784', dispatchMode: 'AIR', packages: 1, courierCost: 1650,
      buyingOffice: null, handedOverTo: null, acknowledgement: null,
      remarks: '', documents: [], dispatchedBy: 'Suresh V.',
      activity: [{ id: 1, timestamp: ts(-7, '14:45'), user: 'Suresh V.', action: 'Marked as Dispatched' }],
    },
    // DRAFT dispatch combining the two Vingino/Netherlands IN_PRODUCTION SRs (gate demo)
    {
      id: 6, dispatchNo: docNo(SR_DOC_PREFIX.DISPATCH, 1006), status: 'DRAFT',
      buyerName: 'Vingino', buyerCountry: 'Netherlands', srIds: [1, 8],
      deliveryMethod: 'COURIER', dispatchedDate: d(0), courierId: 1, courierName: 'DHL Express',
      trackingNo: null, dispatchMode: 'AIR', packages: 1, courierCost: null,
      buyingOffice: null, handedOverTo: null, acknowledgement: null,
      remarks: 'Combine both SS27 development styles in one carton.', documents: [], dispatchedBy: null,
      activity: [{ id: 1, timestamp: ts(-1, '09:20'), user: 'Priya S.', action: 'Dispatch draft created — 2 SR(s) for Vingino' }],
    },
  ];

  // ── Invoice seeds — every status across both types ─────────────────────────
  const invoices = [
    // 1 — COMMERCIAL, DISPATCHED (covers SR #4)
    {
      id: 1, invoiceType: 'COMMERCIAL', invoiceNo: docNo('EXSG', 1002), series: 'EXSG', status: 'DISPATCHED',
      invoiceDate: d(-4),
      consigneeName: 'Raizzed B.V.', consigneeContact: 'Attn: Anita George · +31 (0)20 555 0182',
      consigneeAddress: 'Keizersgracht 12, 1015 CW Amsterdam, Netherlands',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1055 · 02 Jun 2026',
      otherReferences: 'Sample submission — SS27 development',
      buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'DELIVERY AT PLACE — BY COURIER', paymentTerms: 'SAMPLES ONLY', containerNo: '',
      marksAndNos: 'SG/RZ 1-1', packages: '1 CARTON',
      currency: 'EUR',
      lines: [
        { key: 'l1', srId: 4, srNo: docNo(SR_DOC_PREFIX.REQUEST, 1004), styleNo: 'O56054-1', hsnCode: '6203', description: 'BOYS DENIM JACKET', quantity: 6, uom: 'PCS', rate: 2.1, manual: false },
        { key: 'l2', srId: null, srNo: null, styleNo: null, hsnCode: '48211010', description: 'FABRIC SWATCHES', quantity: 24, uom: 'PCS', rate: 0.05, manual: true },
      ],
      srIds: [4], cancelReason: null,
      activity: [
        { id: 1, timestamp: ts(-4, '15:20'), user: 'Priya S.', action: 'Invoice issued', details: `${docNo('EXSG', 1002)} · EUR 13.80` },
        { id: 2, timestamp: ts(-3, '09:41'), user: 'Suresh V.', action: 'All covered SRs dispatched via DSP — invoice marked Dispatched' },
      ],
      version: 0,
    },
    // 2 — COMMERCIAL, DRAFT (covers SR #1 only — partial-coverage gate demo vs draft dispatch #6)
    {
      id: 2, invoiceType: 'COMMERCIAL', invoiceNo: null, series: 'EXSG', status: 'DRAFT',
      invoiceDate: d(0),
      consigneeName: 'Vingino B.V.', consigneeContact: 'Attn: Marieke de Vries · +31 (0)20 850 1200',
      consigneeAddress: 'Koningin Wilhelminaplein 13, 1062 HH Amsterdam, Netherlands',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1051 · 12 Jun 2026',
      otherReferences: '', buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'DELIVERY AT PLACE — BY COURIER', paymentTerms: 'SAMPLES ONLY', containerNo: '',
      marksAndNos: '', packages: '',
      currency: 'EUR',
      lines: [
        { key: 'l1', srId: 1, srNo: docNo(SR_DOC_PREFIX.REQUEST, 1001), styleNo: 'N58921SR-37', hsnCode: '6206', description: 'GIRLS WOVEN SHIRT — LONG SLEEVE', quantity: 6, uom: 'PCS', rate: null, manual: false },
      ],
      srIds: [1], cancelReason: null,
      activity: [{ id: 1, timestamp: ts(0, '09:05'), user: 'Priya S.', action: 'Commercial invoice draft created' }],
      version: 0,
    },
    // 3 — SAMPLE, ISSUED (2× recovery charge for the rejected/non-converted SR #10)
    {
      id: 3, invoiceType: 'SAMPLE', invoiceNo: docNo('SA', 1001), series: 'SA', status: 'ISSUED',
      invoiceDate: d(-2),
      consigneeName: 'Raizzed B.V.', consigneeContact: 'Attn: Anita George',
      consigneeAddress: 'Keizersgracht 12, 1015 CW Amsterdam, Netherlands',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1044 · 08 May 2026',
      otherReferences: 'Cancel sampling charges — style dropped from range',
      buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'AS AGREED', paymentTerms: 'TT 30 DAYS', containerNo: '',
      marksAndNos: '', packages: '',
      currency: 'USD',
      lines: [
        { key: 'l1', srId: 10, srNo: docNo(SR_DOC_PREFIX.REQUEST, 1010), styleNo: 'M11402', hsnCode: '6203', description: 'GIRLS SKORT — CANCELLED SAMPLE CHARGES', quantity: 6, uom: 'PCS', rate: 41.2, manual: false },
        { key: 'l2', srId: null, srNo: null, styleNo: null, hsnCode: '6217', description: 'FABRIC COSTING FOR CANCELLED STYLES', quantity: 1, uom: 'LOT', rate: 345, manual: true },
      ],
      srIds: [10], cancelReason: null,
      activity: [{ id: 1, timestamp: ts(-2, '11:30'), user: 'Priya S.', action: 'Invoice issued', details: `${docNo('SA', 1001)} · USD 592.20` }],
      version: 0,
    },
    // 4 — COMMERCIAL, CANCELLED (with mandatory reason, shown in view + activity)
    {
      id: 4, invoiceType: 'COMMERCIAL', invoiceNo: docNo('EXSG', 1001), series: 'EXSG', status: 'CANCELLED',
      invoiceDate: d(-15),
      consigneeName: 'Vingino B.V.', consigneeContact: 'Attn: Marieke de Vries',
      consigneeAddress: 'Marienhoef 6, 3851 ST Ermelo, Netherlands',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1038 · 22 Apr 2026',
      otherReferences: '', buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'DELIVERY AT PLACE — BY COURIER', paymentTerms: 'SAMPLES ONLY', containerNo: '',
      marksAndNos: 'SG/VNG 1-1', packages: '1 CARTON',
      currency: 'EUR',
      lines: [
        { key: 'l1', srId: null, srNo: null, styleNo: 'N58880SR-11', hsnCode: '6206', description: 'GIRLS WOVEN SHIRT — SS27 PROTO', quantity: 4, uom: 'PCS', rate: 0.85, manual: true },
      ],
      srIds: [], cancelReason: 'Consignee address changed after issue — cancelled and re-raised with the corrected Amsterdam address.',
      activity: [
        { id: 1, timestamp: ts(-15, '10:12'), user: 'Priya S.', action: 'Invoice issued', details: `${docNo('EXSG', 1001)} · EUR 3.40` },
        { id: 2, timestamp: ts(-14, '17:55'), user: 'Priya S.', action: 'Invoice cancelled — linked SRs released for re-invoicing', details: 'Reason: Consignee address changed after issue — cancelled and re-raised with the corrected Amsterdam address.' },
      ],
      version: 0,
    },
  ];

  // Fill the dispatched SR's commercial invoiceRef number
  requests[3].invoiceRef = { invoiceId: 1, invoiceNo: invoices[0].invoiceNo, invoiceType: 'COMMERCIAL', declaredValue: 13.8 };

  // ── Sample issues ────────────────────────────────────────────────────────
  // Every SR at In Production or beyond got there through a material issue —
  // so each one carries an SRI record, dated from its IN_PRODUCTION history
  // stamp. One issue holds BOTH the fabric and the trim lines.
  const ISSUED_STATUSES = ['IN_PRODUCTION', 'DISPATCHED', 'FEEDBACK_RECEIVED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'];
  let sriSeq = 0;
  const sampleIssues = requests
    .filter((sr) => ISSUED_STATUSES.includes(sr.status))
    .map((sr) => {
      sriSeq += 1;
      const issuedOn = sr.statusHistory.find((h) => h.status === 'IN_PRODUCTION')?.date || d(-1);
      return {
        id: sriSeq,
        issueNo: docNo(SR_DOC_PREFIX.ISSUE, 1000 + sriSeq),
        srId: sr.id,
        srNo: sr.srNo,
        issuedDate: issuedOn,
        issuedBy: 'Ravi Kumar',
        receivedBy: 'Suresh V. (Sampling Room)',
        remarks: sr.priority === 'URGENT' ? 'Urgent sample — issued ahead of the bulk pick list.' : '',
        lines: sr.materials.map((m) => {
          const requiredQty = computeSampleQtyRequired(m, sr.sampleQty, sr.sizes || []);
          return {
            lineNo: m.lineNo,
            section: m.section,
            fabricType: m.fabricType,
            classification: m.classification,
            description: m.description,
            colourDesign: m.colourDesign,
            width: m.width,
            uom: m.uom,
            requiredQty,
            issueQty: requiredQty,
          };
        }),
      };
    });

  return {
    seedVersion: SEED_VERSION,
    // sys_doc_counters equivalent: one counter per <PREFIX>/<FY>, last number used
    docSeq: {
      [`${SR_DOC_PREFIX.REQUEST}/${fy}`]: 1000 + requests.length,
      [`${SR_DOC_PREFIX.DISPATCH}/${fy}`]: 1000 + dispatches.length,
      [`${SR_DOC_PREFIX.ISSUE}/${fy}`]: 1000 + sampleIssues.length,
      [`EXSG/${fy}`]: 1002,
      [`SA/${fy}`]: 1001,
    },
    requests,
    dispatches,
    invoices,
    samplePos: [],
    sampleIssues,
    masters: {
      sampleTypes: SEED_SAMPLE_TYPES,
      couriers: SEED_COURIERS,
      buyingOffices: SEED_BUYING_OFFICES,
      rejectionReasonCodes: SEED_REJECTION_REASONS,
      feedbackCategories: SEED_FEEDBACK_CATEGORIES,
      hsnCodes: SEED_HSN_CODES,
      companyProfileExtra: SEED_COMPANY_PROFILE_EXTRA,
    },
  };
};
