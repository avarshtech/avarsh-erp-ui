/**
 * Seed data for the Sample Request mock layer. All dates are computed relative
 * to "today" (TNA convention — never hand-dated) so the demo always shows a
 * live spread: overdue, due-today, amber, green, a Round-1→2 chain, an
 * overseas pair for the invoice gate, and one approval inside this week.
 */
import dayjs from 'dayjs';

export const SEED_VERSION = 5;

const d = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
const ts = (offsetDays, time = '10:00') =>
  `${dayjs().add(offsetDays, 'day').format('YYYY-MM-DD')} ${time}`;

// ── Master seeds ───────────────────────────────────────────────────────────

// The five original types ship as master rows (PRD §9 seeded values); new
// user-created types default to substitution NOT allowed.
export const SEED_SAMPLE_TYPES = [
  { id: 1, name: 'Proto', colourSubstitutionDefault: true,  active: true, custom: false },
  { id: 2, name: 'Fit', colourSubstitutionDefault: true,  active: true, custom: false },
  { id: 3, name: 'SMS', colourSubstitutionDefault: false, active: true, custom: false },
  { id: 4, name: 'Pre-Production', colourSubstitutionDefault: false, active: true, custom: false },
  { id: 5, name: 'TOP', colourSubstitutionDefault: false, active: true, custom: false },
  { id: 6, name: 'Wash Test Sample', colourSubstitutionDefault: false, active: true, custom: true },
];

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

// Default global label set; per-buyer sets are supported (PRD §8.5 —
// "configurable per buyer without a code change").
export const SEED_FEEDBACK_CATEGORIES = [
  {
    buyerName: null,
    labels: { fit: 'Fit', fabricShade: 'Fabric / Shade', measurement: 'Measurement', workmanship: 'Workmanship' },
  },
];

// HSN default per garment/product category (PRD §10.5 — editable per line)
export const SEED_HSN_CODES = [
  { category: 'Woven', code: '6206' },
  { category: 'Knit', code: '6109' },
  { category: 'Denim', code: '6203' },
  { category: 'Swatch', code: '48211010' },
  { category: 'Default', code: '6217' },
];

// Fields the REAL organisation-info master does NOT hold — everything else
// (exporter block, GSTIN, address, country, bank) is read live from
// GET /organisation-info (see plan: Company Profile reuse).
export const SEED_COMPANY_PROFILE_EXTRA = {
  iecNumber: '0405008481',
  swiftCode: 'UCBAINBB302',
  declarationText:
    'We declare that the goods described are samples supplied free of charge and are not for sale. '
    + 'The value shown is declared for customs purposes only and all particulars are true and correct.',
  signatory: 'Authorised Signatory',
  exporterCountryFallback: 'India',
  invoiceSeries: [
    { code: 'EXSG', label: 'Full export format' },
    { code: 'SA', label: 'Simple courier format' },
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
    srNo: `SRQ-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`,
    orderNo: 'ORD/25-26/1042',
    bomId: null,
    styleNo: 'N58921SR-37',
    garmentName: 'Girls Woven Shirt — Long Sleeve',
    buyerName: 'Vingino',
    buyerCountry: 'India',
    season: 'Spring/Summer 2027',
    sampleTypeId: 3,
    sampleTypeName: 'SMS',
    colourSubstitutionAllowed: false,
    round: 1,
    parentSrId: null,
    childSrId: null,
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
    dispatch: null,
    feedback: null,
    priorFeedbackRef: null,
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
    // 1 — overseas SMS, In Production, 2 days to dispatch (red) → demo invoice gate
    mkSr({
      orderNo: 'ORD/25-26/1051', buyerName: 'Vingino', buyerCountry: 'Netherlands',
      sampleTypeId: 3, sampleTypeName: 'SMS', priority: 'URGENT',
      status: 'IN_PRODUCTION', inHandDate: d(-1), dispatchDeadline: d(2), buyerApprovalDeadline: d(10),
      specialInstructions: 'Self-fabric loop on left sleeve placket. Send with hangtag mock-up.',
      statusHistory: [
        { status: 'DRAFT', date: d(-8), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-7), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-6), user: 'Ravi Kumar' },
      ],
    }),
    // 2 — Fit chain Round 1: revision required (closed) …
    mkSr({
      orderNo: 'ORD/25-26/1042', styleNo: 'KG-6202', garmentName: 'Girls Woven Blouse', buyerName: 'Koalabay',
      sampleTypeId: 2, sampleTypeName: 'Fit', colourSubstitutionAllowed: true,
      status: 'REVISION_REQUIRED',
      inHandDate: d(-16), dispatchDeadline: d(-13), buyerApprovalDeadline: d(-5),
      dispatch: {
        deliveryMethod: 'COURIER', dispatchedDate: d(-13), courierId: 1, courierName: 'DHL Express',
        trackingNo: '7712 4498 0031', dispatchMode: 'AIR', packages: 1, courierCost: 1850,
        buyingOffice: null, handedOverTo: null, acknowledgement: null,
        dispatchedBy: 'Suresh V.', remarks: '2 pcs each in 104/116/128.', documents: [],
      },
      feedback: {
        date: d(-4), from: 'Marieke de Vries', decision: 'REVISION_REQUIRED',
        rejectionReasonCodes: ['FIT_ISSUE', 'MEASUREMENT_VARIATION'],
        comments: {
          fit: 'Shoulder slope too square on 116. Armhole 1 cm tight across all sizes.',
          fabricShade: 'Shade acceptable against approved lab dip.',
          measurement: 'Sleeve length +1.5 cm vs spec on 128.',
          workmanship: 'Placket topstitch uneven on one piece.',
          additional: '',
        },
        attachments: [{ name: 'Koalabay_CommentSheet_R1.xlsx', size: 91500, type: 'xlsx' }],
        importSource: 'Koalabay_CommentSheet_R1.xlsx',
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
    // 3 — … Fit chain Round 2 draft carrying Round-1 comments
    mkSr({
      orderNo: 'ORD/25-26/1042', styleNo: 'KG-6202', garmentName: 'Girls Woven Blouse', buyerName: 'Koalabay',
      sampleTypeId: 2, sampleTypeName: 'Fit — Revised', colourSubstitutionAllowed: true,
      round: 2, parentSrId: 2, status: 'DRAFT',
      inHandDate: null, dispatchDeadline: null, buyerApprovalDeadline: null,
      priorFeedbackRef: {
        srNo: `SRQ-${new Date().getFullYear()}-0002`, round: 1, decision: 'REVISION_REQUIRED',
        date: d(-4), from: 'Marieke de Vries',
        comments: {
          fit: 'Shoulder slope too square on 116. Armhole 1 cm tight across all sizes.',
          measurement: 'Sleeve length +1.5 cm vs spec on 128.',
        },
      },
    }),
    // 4 — dispatched (courier), awaiting buyer feedback, overseas + issued invoice
    mkSr({
      orderNo: 'ORD/25-26/1055', styleNo: 'O56054-1', garmentName: 'Boys Denim Jacket', buyerName: 'Raizzed',
      buyerCountry: 'Netherlands', sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'DISPATCHED',
      inHandDate: d(-6), dispatchDeadline: d(-3), buyerApprovalDeadline: d(6),
      dispatch: {
        deliveryMethod: 'COURIER', dispatchedDate: d(-3), courierId: 2, courierName: 'FedEx',
        trackingNo: '8890 1123 7745', dispatchMode: 'AIR', packages: 1, courierCost: 2400,
        buyingOffice: null, handedOverTo: null, acknowledgement: null,
        dispatchedBy: 'Suresh V.', remarks: '', documents: [{ name: 'AWB_8890_1123_7745.pdf', size: 312000, type: 'pdf' }],
      },
      invoiceRef: { invoiceId: 1, invoiceNo: null, declaredValue: 13.8 }, // invoiceNo filled from seed invoice below
      // Comment DRAFT saved but no decision yet → counts as "Pending Approval"
      // (comments logged, action pending) while still Dispatched.
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
    // 5 — local hand delivery, approved this week (quick-stat)
    mkSr({
      orderNo: 'ORD/25-26/1060', styleNo: 'K64942-37', garmentName: 'Boys Cargo Short', buyerName: 'Koalabay',
      sampleTypeId: 4, sampleTypeName: 'Pre-Production',
      status: 'APPROVED',
      inHandDate: d(-10), dispatchDeadline: d(-8), buyerApprovalDeadline: d(-1),
      dispatch: {
        deliveryMethod: 'LOCAL_HAND', dispatchedDate: d(-8), courierId: 6, courierName: 'Hand Delivered — Buying Office',
        trackingNo: null, dispatchMode: 'HAND_CARRY', packages: 1, courierCost: 0,
        buyingOffice: 'Koalabay Buying House — Chennai', handedOverTo: 'S. Ramesh',
        acknowledgement: 'Signed DC', dispatchedBy: 'Suresh V.', remarks: '', documents: [{ name: 'Signed_DC_1060.pdf', size: 180000, type: 'pdf' }],
      },
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
    // 6 — overdue: dispatch deadline passed, still In Production (alert strip)
    mkSr({
      orderNo: 'ORD/25-26/1058', styleNo: 'L62003-1', garmentName: 'Girls Denim Jacket', buyerName: 'Vingino',
      sampleTypeId: 6, sampleTypeName: 'Wash Test Sample',
      status: 'IN_PRODUCTION', priority: 'URGENT',
      inHandDate: d(-4), dispatchDeadline: d(-2), buyerApprovalDeadline: d(8),
      statusHistory: [
        { status: 'DRAFT', date: d(-10), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-9), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-8), user: 'Ravi Kumar' },
      ],
    }),
    // 7 — submitted, due tomorrow (amber→red edge)
    mkSr({
      orderNo: 'ORD/25-26/1061', styleNo: 'Q500017', garmentName: 'Girls Jersey Dress', buyerName: 'Raizzed',
      sampleTypeId: 2, sampleTypeName: 'Fit', colourSubstitutionAllowed: true,
      status: 'SUBMITTED',
      inHandDate: d(0), dispatchDeadline: d(1), buyerApprovalDeadline: d(9),
      statusHistory: [
        { status: 'DRAFT', date: d(-5), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-3), user: 'Priya S.' },
      ],
    }),
    // 8 — comfortable green, In Production
    mkSr({
      orderNo: 'ORD/25-26/1062', styleNo: 'N58924SR-37', garmentName: 'Girls Woven Blouse', buyerName: 'Vingino',
      buyerCountry: 'Netherlands', sampleTypeId: 3, sampleTypeName: 'SMS',
      status: 'IN_PRODUCTION',
      inHandDate: d(9), dispatchDeadline: d(12), buyerApprovalDeadline: d(21),
      statusHistory: [
        { status: 'DRAFT', date: d(-3), user: 'Priya S.' },
        { status: 'SUBMITTED', date: d(-2), user: 'Priya S.' },
        { status: 'IN_PRODUCTION', date: d(-1), user: 'Ravi Kumar' },
      ],
    }),
    // 9 — draft due today (quick-stat "Due Today")
    mkSr({
      orderNo: 'ORD/25-26/1063', styleNo: 'T77210', garmentName: 'Boys Polo — Pique', buyerName: 'Koalabay',
      sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'DRAFT',
      inHandDate: d(-1), dispatchDeadline: d(0), buyerApprovalDeadline: d(7),
    }),
    // 10 — rejected chain end (no auto-round; PRD §14)
    mkSr({
      orderNo: 'ORD/25-26/1044', styleNo: 'M11402', garmentName: 'Girls Skort', buyerName: 'Raizzed',
      sampleTypeId: 5, sampleTypeName: 'TOP',
      status: 'REJECTED',
      inHandDate: d(-25), dispatchDeadline: d(-22), buyerApprovalDeadline: d(-12),
      dispatch: {
        deliveryMethod: 'COURIER', dispatchedDate: d(-22), courierId: 5, courierName: 'DTDC',
        trackingNo: 'D22019945IN', dispatchMode: 'ROAD', packages: 1, courierCost: 420,
        buyingOffice: null, handedOverTo: null, acknowledgement: null,
        dispatchedBy: 'Suresh V.', remarks: '', documents: [],
      },
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
    // 11 — comments received, DECISION PENDING → rests at Feedback Received
    mkSr({
      orderNo: 'ORD/25-26/1046', styleNo: 'P30988-2', garmentName: 'Girls Twill Pinafore', buyerName: 'Koalabay',
      sampleTypeId: 1, sampleTypeName: 'Proto', colourSubstitutionAllowed: true,
      status: 'FEEDBACK_RECEIVED',
      inHandDate: d(-9), dispatchDeadline: d(-7), buyerApprovalDeadline: d(2),
      dispatch: {
        deliveryMethod: 'COURIER', dispatchedDate: d(-7), courierId: 3, courierName: 'UPS',
        trackingNo: '1Z 999 AA1 01 2345 6784', dispatchMode: 'AIR', packages: 1, courierCost: 1650,
        buyingOffice: null, handedOverTo: null, acknowledgement: null,
        dispatchedBy: 'Suresh V.', remarks: '', documents: [],
      },
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
  ];

  // Cross-link the Fit chain
  requests[1].childSrId = requests[2].id;

  const invoices = [
    {
      id: 1,
      invoiceNo: `EXSG0031/${'26-27'}`,
      series: 'EXSG',
      status: 'DISPATCHED',
      invoiceDate: d(-4),
      consigneeName: 'Raizzed B.V.',
      consigneeAddress: 'Keizersgracht 12, 1015 CW Amsterdam, Netherlands\nATTN: ANITA GEORGE',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1055 · 02 Jun 2026',
      otherReferences: 'Sample submission — SS27 development',
      buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'DELIVERY AT PLACE — BY COURIER',
      marksAndNos: 'SG/RZ 1-1', packages: '1 CARTON',
      currency: 'EUR',
      lines: [
        { key: 'l1', srId: 4, srNo: `SRQ-${new Date().getFullYear()}-0004`, styleNo: 'O56054-1', hsnCode: '6203', description: 'BOYS DENIM JACKET', quantity: 6, uom: 'PCS', rate: 2.1, manual: false },
        { key: 'l2', srId: null, srNo: null, styleNo: null, hsnCode: '48211010', description: 'FABRIC SWATCHES', quantity: 24, uom: 'PCS', rate: 0.05, manual: true },
      ],
      srIds: [4],
      activity: [
        { id: 1, timestamp: ts(-4, '15:20'), user: 'Priya S.', action: 'Invoice issued', details: 'EXSG0031 · EUR 13.80' },
        { id: 2, timestamp: ts(-3, '09:41'), user: 'Suresh V.', action: 'Linked SR dispatched — invoice marked Dispatched' },
      ],
      version: 0,
    },
    {
      id: 2,
      invoiceNo: null, // DRAFT — number assigned on issue (PRD §10.8)
      series: 'EXSG',
      status: 'DRAFT',
      invoiceDate: d(0),
      consigneeName: 'Vingino B.V.',
      consigneeAddress: 'Koningin Wilhelminaplein 13, 1062 HH Amsterdam, Netherlands\nATTN: MARIEKE DE VRIES',
      destinationCountry: 'Netherlands',
      buyerOrderNoDate: 'ORD/25-26/1051 · 12 Jun 2026',
      otherReferences: '', buyerOtherThanConsignee: '', notifyParty: '',
      countryOfOrigin: 'India',
      preCarriage: 'N.A.', placeOfReceipt: 'N.A.', vesselFlightNo: '',
      portOfLoading: 'CHENNAI / INDIA', portOfDischarge: '', finalDestination: 'Netherlands',
      termsOfDelivery: 'DELIVERY AT PLACE — BY COURIER',
      marksAndNos: '', packages: '',
      currency: 'EUR',
      lines: [
        { key: 'l1', srId: 1, srNo: `SRQ-${new Date().getFullYear()}-0001`, styleNo: 'N58921SR-37', hsnCode: '6206', description: 'GIRLS WOVEN SHIRT — LONG SLEEVE', quantity: 6, uom: 'PCS', rate: null, manual: false },
      ],
      srIds: [1],
      activity: [{ id: 1, timestamp: ts(0, '09:05'), user: 'Priya S.', action: 'Invoice draft created' }],
      version: 0,
    },
  ];

  // Point the dispatched SR's invoiceRef at the issued invoice number
  requests[3].invoiceRef = { invoiceId: 1, invoiceNo: invoices[0].invoiceNo, declaredValue: 13.8 };

  const samplePos = [];

  return {
    seedVersion: SEED_VERSION,
    srSeq: { [new Date().getFullYear()]: 100 + requests.length },
    invSeq: { 'EXSG/26-27': 31 },
    poSeq: 1000,
    requests,
    invoices,
    samplePos,
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
