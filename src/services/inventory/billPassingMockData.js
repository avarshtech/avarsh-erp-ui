/**
 * Seed data for the Bill Passing mock layer.
 *
 * Shapes match the future backend DTOs exactly (camelCase, YYYY-MM-DD dates,
 * `version` for optimistic locking), so the API cutover changes the delegate in
 * billPassingService.js and nothing else.
 *
 * Dates are always relative to today so the demo never goes stale. Supplier
 * names, item descriptions and colours are taken from the client's live Excel
 * register; PO and GRN numbers use the ERP DocumentNumberService series rather
 * than the manual HO/25-26/FPS/ORG and F112 conventions of that sheet.
 *
 * Bump SEED_VERSION whenever the shape below changes — loadDb() discards a
 * stored copy whose seedVersion differs, which is the demo-reset path (and
 * destroys any demo data entered in the browser).
 */
import dayjs from 'dayjs';
import {
  BILL_PASSING_STATUS, DEBIT_ORIGIN, DEBIT_STATUS, ISSUE_STATUS,
  GST_TREATMENT, DEFAULT_TOLERANCE, DEBIT_TYPES, CHARGE_TYPES, ISSUE_TYPES,
} from '../../utils/billPassingConstants';
import { docNo, fiscalYearLabel, FIRST_DOC_NUMBER } from './billPassingDocNumbers';

export const SEED_VERSION = 1;

const d = (offsetDays) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
const ts = (offsetDays, time = '10:00') =>
  `${dayjs().add(offsetDays, 'day').format('YYYY-MM-DD')} ${time}`;

const FY = fiscalYearLabel();
const bp = (n) => docNo('BP', n, FY);
const po = (n) => docNo('PO', n, FY);
const grn = (n) => docNo('GRN', n, FY);
const qc = (n) => docNo('QC', n, FY);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// ── Masters ────────────────────────────────────────────────────────────────
const SEED_SUPPLIERS = [
  { id: 1, name: 'Sri Lakshmi Textiles', gstin: '33AABCS1429B1ZP', stateCode: '33', igstApplicable: false, paymentTerms: '45 Days Credit', active: true },
  { id: 2, name: 'KAALIRAMAN TEX',       gstin: '33AAGFK5521M1Z4', stateCode: '33', igstApplicable: false, paymentTerms: '30 Days Credit', active: true },
  { id: 3, name: 'MVPNK Enterprise',     gstin: '29AAFCM8812K1ZX', stateCode: '29', igstApplicable: true,  paymentTerms: '60 Days Credit', active: true },
];

// ── Purchase orders and their lines ────────────────────────────────────────
// poLineItemId is the join key everything downstream hangs off, exactly as
// inv_grn_line_items.po_line_item_id does in the real schema.
const SEED_POS = [
  // Older, fully received and fully billed — the closed case on the register.
  { id: 5, poNumber: po(1000), poDate: d(-60), supplierId: 1, deliveryDate: d(-30), status: 'Approved', gstPercent: 5 },
  { id: 1, poNumber: po(1001), poDate: d(-40), supplierId: 1, deliveryDate: d(-5),  status: 'Approved', gstPercent: 5 },
  { id: 2, poNumber: po(1002), poDate: d(-35), supplierId: 2, deliveryDate: d(-2),  status: 'Approved', gstPercent: 5 },
  { id: 3, poNumber: po(1003), poDate: d(-30), supplierId: 3, deliveryDate: d(2),   status: 'Approved', gstPercent: 5 },
  { id: 4, poNumber: po(1004), poDate: d(-22), supplierId: 2, deliveryDate: d(10),  status: 'Approved', gstPercent: 5 },
];

const SEED_PO_LINES = [
  // PO/1000 — the earlier closed delivery, billed in full on BP/1006.
  { id: 501, poId: 5, itemCode: 'FAB-CSJ-180', description: 'Fabric - Knitted (Kgs) - Cotton Single Jersey 180 GSM', color: 'Optical White', size: '', uom: 'kg', qty: 500, rate: 420, gstPercent: 5, hsnCode: '60062200' },

  // PO/1001 — the PRD section 13 worked example: 2,500 kg @ 420 + 5% GST.
  { id: 101, poId: 1, itemCode: 'FAB-CSJ-180', description: 'Fabric - Knitted (Kgs) - Cotton Single Jersey 180 GSM', color: 'Optical White', size: '', uom: 'kg', qty: 2500, rate: 420, gstPercent: 5, hsnCode: '60062200' },

  // PO/1002 — KAALIRAMAN, four lines, mirrors the client's register.
  { id: 201, poId: 2, itemCode: 'FAB-SJ-100C',  description: 'Fabric - Knitted (Kgs) - Single Jersey 100% Cotton',            color: 'Mid Bisquit 16-1103',      size: '', uom: 'kg', qty: 300, rate: 500, gstPercent: 5, hsnCode: '60062200' },
  { id: 202, poId: 2, itemCode: 'FAB-FT-80OC',  description: 'Fabric - Knitted (Kgs) - French Terry 80% Organic Cotton',      color: '249 Leaf Green as swatch', size: '', uom: 'kg', qty: 120, rate: 585, gstPercent: 5, hsnCode: '60062200' },
  { id: 203, poId: 2, itemCode: 'FAB-RIB-2X2',  description: 'Fabric - Knitted (Kgs) - 2x2 Rib 95% CO 5% EA Dia 24D',         color: 'Darkblue grey 19-4023tcx', size: '', uom: 'kg', qty: 60,  rate: 500, gstPercent: 5, hsnCode: '60062200' },
  { id: 204, poId: 2, itemCode: 'FAB-WAF-100O', description: 'Fabric - Knitted (Kgs) - Waffle 100% Organic Cotton Yarn Dyed',  color: 'Dkofwhite/Dkbluegrey',     size: '', uom: 'kg', qty: 150, rate: 730, gstPercent: 5, hsnCode: '60062200' },

  // PO/1003 — MVPNK wadding.
  { id: 301, poId: 3, itemCode: 'WAD-QLT-60',   description: 'Wadding - Quilting 100% Polyester - Width 60 C100',             color: 'White', size: '', uom: 'kg', qty: 500, rate: 560, gstPercent: 5, hsnCode: '56012200' },

  // PO/1004 — KAALIRAMAN, received but not yet billed at all.
  { id: 401, poId: 4, itemCode: 'FAB-LYC-95OC', description: 'Fabric - Knitted (Kgs) - Lycra Jersey 95% Organic Cotton 5% EA', color: 'Ivoorwit 11-4201tcx', size: '', uom: 'kg', qty: 220, rate: 590, gstPercent: 5, hsnCode: '60062200' },
  { id: 402, poId: 4, itemCode: 'FAB-DOT-100O', description: 'Fabric - Knitted (Kgs) - DOT Print 100% Organic Cotton',         color: 'Dark Off White',      size: '', uom: 'kg', qty: 560, rate: 605, gstPercent: 5, hsnCode: '60062200' },
];

// ── GRNs, their lines, and the QC inspection per line ──────────────────────
// One GRN records one supplier delivery challan (challanNo on the header), so a
// GRN line IS the challan's item line — that is what billing is controlled on.
const SEED_GRNS = [
  { id: 8, grnNumber: grn(1000), grnType: 'Fabric', grnDate: d(-34), poId: 5, challanNo: 'DC-498', challanDate: d(-35), invoiceDate: d(-35), status: 'Closed', vehicleNumber: 'TN 38 BX 4412', transporter: 'Sri Balaji Roadways' },
  { id: 1, grnNumber: grn(1001), grnType: 'Fabric', grnDate: d(-26), poId: 1, challanNo: 'DC-501', challanDate: d(-27), invoiceDate: d(-27), status: 'Closed', vehicleNumber: 'TN 38 BX 4412', transporter: 'Sri Balaji Roadways' },
  { id: 2, grnNumber: grn(1002), grnType: 'Fabric', grnDate: d(-19), poId: 1, challanNo: 'DC-502', challanDate: d(-20), invoiceDate: d(-20), status: 'Closed', vehicleNumber: 'TN 38 BX 4412', transporter: 'Sri Balaji Roadways' },
  { id: 3, grnNumber: grn(1003), grnType: 'Fabric', grnDate: d(-12), poId: 1, challanNo: 'DC-503', challanDate: d(-13), invoiceDate: d(-13), status: 'Closed', vehicleNumber: 'TN 45 AC 9087', transporter: 'Sri Balaji Roadways' },
  { id: 4, grnNumber: grn(1004), grnType: 'Fabric', grnDate: d(-24), poId: 2, challanNo: 'KT/1188',  challanDate: d(-25), invoiceDate: d(-25), status: 'Closed', vehicleNumber: 'TN 33 CE 1220', transporter: 'KPN Freight' },
  { id: 5, grnNumber: grn(1005), grnType: 'Fabric', grnDate: d(-16), poId: 2, challanNo: 'KT/1204',  challanDate: d(-17), invoiceDate: d(-17), status: 'Closed', vehicleNumber: 'TN 33 CE 1220', transporter: 'KPN Freight' },
  { id: 6, grnNumber: grn(1006), grnType: 'Fabric', grnDate: d(-9),  poId: 3, challanNo: 'MV/0271',  challanDate: d(-10), invoiceDate: d(-10), status: 'Closed', vehicleNumber: 'KA 05 MJ 3341', transporter: 'VRL Logistics' },
  { id: 7, grnNumber: grn(1007), grnType: 'Fabric', grnDate: d(-4),  poId: 4, challanNo: 'KT/1263',  challanDate: d(-5),  invoiceDate: d(-5),  status: 'Closed', vehicleNumber: 'TN 33 CE 1220', transporter: 'KPN Freight' },
];

// receivedQty is what stores booked; acceptedQty/rejectedQty come from QC.
const SEED_GRN_LINES = [
  { id: 1000, grnId: 8, poLineItemId: 501, receivedQty: 500 },

  { id: 1001, grnId: 1, poLineItemId: 101, receivedQty: 1000 },
  { id: 1002, grnId: 2, poLineItemId: 101, receivedQty: 750 },
  { id: 1003, grnId: 3, poLineItemId: 101, receivedQty: 500 },

  { id: 1004, grnId: 4, poLineItemId: 201, receivedQty: 300 },
  { id: 1005, grnId: 4, poLineItemId: 202, receivedQty: 104 },
  { id: 1006, grnId: 5, poLineItemId: 203, receivedQty: 46 },
  { id: 1007, grnId: 5, poLineItemId: 204, receivedQty: 142 },

  { id: 1008, grnId: 6, poLineItemId: 301, receivedQty: 454.7 },

  { id: 1009, grnId: 7, poLineItemId: 401, receivedQty: 206.85 },
  { id: 1010, grnId: 7, poLineItemId: 402, receivedQty: 553.56 },
];

// One QC per (grn, poLineItem) — inv_qc is keyed exactly that way.
const SEED_QCS = [
  { id: 10, qcNumber: qc(1000), grnId: 8, poLineItemId: 501, grnLineItemId: 1000, inspectionDate: d(-33), inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 500, rejectedQty: 0, rejectionReason: '', defects: [] },

  { id: 1, qcNumber: qc(1001), grnId: 1, poLineItemId: 101, grnLineItemId: 1001, inspectionDate: d(-25), inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 980,    rejectedQty: 20,   rejectionReason: 'GSM variation beyond tolerance',      defects: ['GSM variation'] },
  { id: 2, qcNumber: qc(1002), grnId: 2, poLineItemId: 101, grnLineItemId: 1002, inspectionDate: d(-18), inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 750,    rejectedQty: 0,    rejectionReason: '',                                    defects: [] },
  { id: 3, qcNumber: qc(1003), grnId: 3, poLineItemId: 101, grnLineItemId: 1003, inspectionDate: d(-11), inspector: 'S. Karthik',   status: 'Approved', overallResult: 'Pass', acceptedQty: 470,    rejectedQty: 30,   rejectionReason: 'Shade variation vs approved lab dip', defects: ['Shade variation'] },

  { id: 4, qcNumber: qc(1004), grnId: 4, poLineItemId: 201, grnLineItemId: 1004, inspectionDate: d(-23), inspector: 'S. Karthik',   status: 'Approved', overallResult: 'Pass', acceptedQty: 294,    rejectedQty: 6,    rejectionReason: 'Holes / needle lines on 2 rolls',     defects: ['Holes'] },
  { id: 5, qcNumber: qc(1005), grnId: 4, poLineItemId: 202, grnLineItemId: 1005, inspectionDate: d(-23), inspector: 'S. Karthik',   status: 'Approved', overallResult: 'Pass', acceptedQty: 104,    rejectedQty: 0,    rejectionReason: '',                                    defects: [] },
  { id: 6, qcNumber: qc(1006), grnId: 5, poLineItemId: 203, grnLineItemId: 1006, inspectionDate: d(-15), inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 46,     rejectedQty: 0,    rejectionReason: '',                                    defects: [] },
  { id: 7, qcNumber: qc(1007), grnId: 5, poLineItemId: 204, grnLineItemId: 1007, inspectionDate: d(-15), inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 142,    rejectedQty: 0,    rejectionReason: '',                                    defects: [] },

  { id: 8, qcNumber: qc(1008), grnId: 6, poLineItemId: 301, grnLineItemId: 1008, inspectionDate: d(-8),  inspector: 'S. Karthik',   status: 'Approved', overallResult: 'Pass', acceptedQty: 454.7,  rejectedQty: 0,    rejectionReason: '',                                    defects: [] },

  // GRN/1007 line 401 is still awaiting QC — drives the BR-06 "QC pending" path.
  { id: 9, qcNumber: qc(1009), grnId: 7, poLineItemId: 402, grnLineItemId: 1010, inspectionDate: d(-3),  inspector: 'R. Meenakshi', status: 'Approved', overallResult: 'Pass', acceptedQty: 553.56, rejectedQty: 0,    rejectionReason: '',                                    defects: [] },
];

/**
 * A debit note already raised through Return to Supplier for the 6 kg rejected
 * on GRN/1004. Bill Passing must show it, deduct it, and NOT propose a second
 * debit for the same quantity — the double-recovery guard.
 */
const SEED_DEBIT_NOTES = [
  {
    id: 1, debitNoteNumber: docNo('DBN', 1001, FY), debitNoteDate: d(-21),
    returnId: 1, returnNumber: docNo('RDC', 1001, FY),
    poId: 2, supplierId: 2, grnId: 4, grnLineItemId: 1004, qcId: 4,
    qty: 6, unitPrice: 500, subtotal: 3000, taxTotal: 150, grandTotal: 3150,
    status: 'RAISED',
  },
];

// ── Helpers used to build bill lines from the fixtures above ───────────────
const poLine = (id) => SEED_PO_LINES.find((l) => l.id === id);
const qcFor = (grnLineItemId) => SEED_QCS.find((q) => q.grnLineItemId === grnLineItemId);

/**
 * Build one bill GRN-line from a seeded GRN line. `billedQty` defaults to the
 * QC-accepted quantity, which is the payable basis (BR-08); pass a smaller
 * number to model an item-wise split across invoices.
 */
const billLine = (grnLineItemId, billedQty = null, overrides = {}) => {
  const gl = SEED_GRN_LINES.find((l) => l.id === grnLineItemId);
  const pl = poLine(gl.poLineItemId);
  const q = qcFor(grnLineItemId);
  const accepted = q ? q.acceptedQty : 0;
  const rejected = q ? q.rejectedQty : 0;
  const billed = billedQty == null ? accepted : billedQty;
  return {
    id: grnLineItemId,
    grnLineItemId,
    poLineItemId: gl.poLineItemId,
    itemCode: pl.itemCode,
    description: pl.description,
    color: pl.color,
    size: pl.size,
    uom: pl.uom,
    poQty: pl.qty,
    receivedQty: gl.receivedQty,
    acceptedQty: accepted,
    rejectedQty: rejected,
    shortageQty: 0,
    excessQty: 0,
    rate: pl.rate,
    grnValue: r2(gl.receivedQty * pl.rate),
    billedQty: r3(billed),
    invoiceRate: pl.rate,
    billedValue: r2(billed * pl.rate),
    qcId: q ? q.id : null,
    qcNumber: q ? q.qcNumber : null,
    qcStatus: q ? q.status : 'Pending',
    qcResult: q ? q.overallResult : null,
    // Trims QC records criteria pass/fail with no per-unit split; fabric is exact.
    qtyUnquantified: false,
    ...overrides,
  };
};

const billGrn = (grnId, lines) => {
  const g = SEED_GRNS.find((x) => x.id === grnId);
  return {
    id: grnId,
    grnId,
    grnNumber: g.grnNumber,
    grnType: g.grnType,
    grnDate: g.grnDate,
    challanNo: g.challanNo,
    challanDate: g.challanDate,
    lines,
  };
};

/** CGST+SGST split for intra-state, single IGST line for inter-state. */
const taxLines = (taxableValue, gstPercent, igst) => {
  const tv = r2(taxableValue);
  if (igst) {
    const amt = r2((tv * gstPercent) / 100);
    return [{ id: 1, taxType: 'IGST', ratePercent: gstPercent, taxableValue: tv, computedAmount: amt, asPerInvoiceAmount: amt, variance: 0 }];
  }
  const half = r2((tv * (gstPercent / 2)) / 100);
  return [
    { id: 1, taxType: 'CGST', ratePercent: gstPercent / 2, taxableValue: tv, computedAmount: half, asPerInvoiceAmount: half, variance: 0 },
    { id: 2, taxType: 'SGST', ratePercent: gstPercent / 2, taxableValue: tv, computedAmount: half, asPerInvoiceAmount: half, variance: 0 },
  ];
};

const activity = (entries) =>
  entries.map((e, i) => ({ id: entries.length - i, timestamp: e[0], user: e[1], action: e[2], details: e[3] || '' }));

// ── Bills ──────────────────────────────────────────────────────────────────
function buildBills() {
  const supplierName = (id) => SEED_SUPPLIERS.find((s) => s.id === id).name;
  const poNumberOf = (id) => SEED_POS.find((p) => p.id === id).poNumber;

  // 1 ── PRD section 13 worked example. Three challans combined on one invoice.
  //      945,000 + 8,500 freight + 47,250 GST − 26,000 debits = 974,750 exactly.
  const b1Grns = [
    billGrn(1, [billLine(1001, 1000)]),
    billGrn(2, [billLine(1002, 750)]),
    billGrn(3, [billLine(1003, 500)]),
  ];
  const b1Basic = 945000;
  const b1Charges = 8500;
  const b1Taxes = taxLines(b1Basic, 5, false);
  const b1 = {
    id: 1,
    bpNumber: bp(1001),
    supplierId: 1, supplierName: supplierName(1),
    poId: 1, poNumber: poNumberOf(1),
    supplierInvoiceNo: 'SLT/1234', invoiceDate: d(-10), financialYear: FY,
    challanNumbers: 'DC-501, DC-502, DC-503',
    invoiceBasicAmount: b1Basic,
    chargesTotal: b1Charges,
    taxTotal: 47250,
    debitTotal: 26000,
    adjustmentTotal: 0,
    netPayable: 974750,
    status: BILL_PASSING_STATUS.PENDING_APPROVAL,
    headerRemarks: 'Three challans billed together; mill confirmed balance 250 kg ships next week.',
    grns: b1Grns,
    // PRD section 13 charges GST on the 945,000 basic only, so this freight
    // line sits outside the taxable value — keeping the bill self-consistent
    // instead of flagging a tax mismatch the moment it loads.
    charges: [{ id: 1, chargeTypeCode: 'FREIGHT', amount: 8500, taxable: false, remarks: 'Sri Balaji Roadways - billed outside taxable value' }],
    taxes: b1Taxes,
    debits: [
      { id: 1, debitTypeCode: 'GSM_VARIATION',   grnId: 1, grnLineItemId: 1001, qcId: 1, debitQty: 20, rate: 420, debitAmount: 8400,  reasonCode: 'QC_REJECTION', reasonText: 'GSM variation beyond tolerance',  remarks: '', gstTreatment: GST_TREATMENT.WITHOUT_GST, origin: DEBIT_ORIGIN.SYSTEM_PROPOSED, status: DEBIT_STATUS.CONFIRMED, debitNoteId: null, debitNoteNumber: null },
      { id: 2, debitTypeCode: 'SHADE_VARIATION', grnId: 3, grnLineItemId: 1003, qcId: 3, debitQty: 30, rate: 420, debitAmount: 12600, reasonCode: 'QC_REJECTION', reasonText: 'Shade variation vs approved lab dip', remarks: '', gstTreatment: GST_TREATMENT.WITHOUT_GST, origin: DEBIT_ORIGIN.SYSTEM_PROPOSED, status: DEBIT_STATUS.CONFIRMED, debitNoteId: null, debitNoteNumber: null },
      { id: 3, debitTypeCode: 'LATE_DELIVERY',   grnId: 3, grnLineItemId: null, qcId: null, debitQty: 0, rate: 0, debitAmount: 5000,  reasonCode: 'PENALTY',      reasonText: 'DC-503 arrived 7 days after PO delivery date', remarks: 'Escalation e-mail attached', gstTreatment: GST_TREATMENT.WITHOUT_GST, origin: DEBIT_ORIGIN.MANUAL, status: DEBIT_STATUS.CONFIRMED, debitNoteId: null, debitNoteNumber: null },
    ],
    issues: [],
    attachments: [{ id: 1, docType: 'SUPPLIER_INVOICE', fileName: 'SLT-1234.pdf', size: 184320, mime: 'application/pdf', uploadedAt: ts(-10, '11:20'), uploadedBy: 'Stores' }],
    activity: activity([
      [ts(-10, '11:24'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-9, '09:40'), 'Accounts Executive', 'Debits confirmed', 'GSM 8,400 + Shade 12,600 + Late delivery 5,000'],
      [ts(-9, '09:52'), 'Accounts Executive', 'Sent for approval', 'Net payable 974,750.00'],
    ]),
    submittedAt: ts(-10, '11:24'),
    approvedAt: null, sentToAccountsAt: null, tallyReferenceNo: null,
    duplicateOverrideBy: null, duplicateOverrideReason: null,
    queryReason: null, holdReason: null, holdSince: null, rejectReason: null, reopenReason: null,
    version: 3,
  };

  // 2 ── The double-recovery case. 6 kg of GRN/1004 was already returned and a
  //      debit note raised; that line is read-only and no second debit exists
  //      for it. The 2x2 Rib line is split — only 30 of 46 kg billed here.
  const b2Grns = [
    billGrn(4, [billLine(1004), billLine(1005)]),
    billGrn(5, [billLine(1006, 30), billLine(1007)]),
  ];
  const b2Basic = r2(294 * 500 + 104 * 585 + 30 * 500 + 142 * 730);
  const b2Taxes = taxLines(b2Basic + 4200, 5, false);
  const b2TaxTotal = r2(b2Taxes.reduce((s, t) => s + t.asPerInvoiceAmount, 0));
  const b2 = {
    id: 2,
    bpNumber: bp(1002),
    supplierId: 2, supplierName: supplierName(2),
    poId: 2, poNumber: poNumberOf(2),
    supplierInvoiceNo: '54', invoiceDate: d(-6), financialYear: FY,
    challanNumbers: 'KT/1188, KT/1204',
    invoiceBasicAmount: b2Basic,
    chargesTotal: 4200,
    taxTotal: b2TaxTotal,
    debitTotal: 3150,
    adjustmentTotal: 0,
    netPayable: r2(b2Basic + 4200 + b2TaxTotal - 3150),
    status: BILL_PASSING_STATUS.UNDER_VERIFICATION,
    headerRemarks: 'Rib line split - balance 16 kg to be billed on the next invoice.',
    grns: b2Grns,
    charges: [{ id: 1, chargeTypeCode: 'FREIGHT', amount: 4200, taxable: true, remarks: 'KPN Freight' }],
    taxes: b2Taxes,
    debits: [
      {
        id: 1, debitTypeCode: 'MATERIAL_REJECTION', grnId: 4, grnLineItemId: 1004, qcId: 4,
        debitQty: 6, rate: 500, debitAmount: 3150,
        reasonCode: 'QC_REJECTION', reasonText: 'Holes / needle lines on 2 rolls',
        remarks: 'Recovered through Return to Supplier - shown here so the same rejection is not debited twice.',
        gstTreatment: GST_TREATMENT.WITH_GST,
        origin: DEBIT_ORIGIN.LINKED_DEBIT_NOTE, status: DEBIT_STATUS.CONFIRMED,
        debitNoteId: 1, debitNoteNumber: docNo('DBN', 1001, FY),
      },
    ],
    issues: [
      { id: 1, parentIssueId: null, issueTypeCode: 'RATE_MISMATCH', description: 'Invoice rate on the Waffle line is 730 against PO 730 - confirmed no change, closing.', status: ISSUE_STATUS.RESOLVED, resolutionRemarks: 'Verified against PO. No action.', raisedBy: 'Accounts Executive', raisedAt: ts(-5, '14:10'), resolvedBy: 'Accounts Executive', resolvedAt: ts(-5, '16:02'), withdrawnBy: null, withdrawnAt: null, withdrawReason: null, autoLogged: false },
    ],
    attachments: [{ id: 1, docType: 'SUPPLIER_INVOICE', fileName: 'KT-INV-54.pdf', size: 122880, mime: 'application/pdf', uploadedAt: ts(-6, '10:05'), uploadedBy: 'Stores' }],
    activity: activity([
      [ts(-6, '10:07'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-5, '14:10'), 'Accounts Executive', 'Opened for verification'],
    ]),
    submittedAt: ts(-6, '10:07'),
    approvedAt: null, sentToAccountsAt: null, tallyReferenceNo: null,
    duplicateOverrideBy: null, duplicateOverrideReason: null,
    queryReason: null, holdReason: null, holdSince: null, rejectReason: null, reopenReason: null,
    version: 2,
  };

  // 3 ── A fresh draft, fully editable, so the workflow can be driven from the start.
  const b3Basic = r2(454.7 * 560);
  const b3Taxes = taxLines(b3Basic, 5, true);
  const b3TaxTotal = r2(b3Taxes.reduce((s, t) => s + t.asPerInvoiceAmount, 0));
  const b3 = {
    id: 3,
    bpNumber: bp(1003),
    supplierId: 3, supplierName: supplierName(3),
    poId: 3, poNumber: poNumberOf(3),
    supplierInvoiceNo: 'MVPNK/0271/26-27', invoiceDate: d(-2), financialYear: FY,
    challanNumbers: 'MV/0271',
    invoiceBasicAmount: b3Basic,
    chargesTotal: 0,
    taxTotal: b3TaxTotal,
    debitTotal: 0,
    adjustmentTotal: 0,
    netPayable: r2(b3Basic + b3TaxTotal),
    status: BILL_PASSING_STATUS.DRAFT,
    headerRemarks: '',
    grns: [billGrn(6, [billLine(1008)])],
    charges: [],
    taxes: b3Taxes,
    debits: [],
    issues: [],
    attachments: [],
    activity: activity([[ts(-2, '15:30'), 'Bill Passing Clerk', 'Draft created']]),
    submittedAt: null, approvedAt: null, sentToAccountsAt: null, tallyReferenceNo: null,
    duplicateOverrideBy: null, duplicateOverrideReason: null,
    queryReason: null, holdReason: null, holdSince: null, rejectReason: null, reopenReason: null,
    version: 1,
  };

  // 4 ── Returned with a query, and carrying an OPEN blocking issue.
  const b4Basic = r2(206.85 * 590);
  const b4Taxes = taxLines(b4Basic, 5, false);
  const b4TaxTotal = r2(b4Taxes.reduce((s, t) => s + t.asPerInvoiceAmount, 0));
  const b4 = {
    id: 4,
    bpNumber: bp(1004),
    supplierId: 2, supplierName: supplierName(2),
    poId: 4, poNumber: poNumberOf(4),
    supplierInvoiceNo: '69', invoiceDate: d(-4), financialYear: FY,
    challanNumbers: 'KT/1263',
    invoiceBasicAmount: b4Basic,
    chargesTotal: 0,
    taxTotal: b4TaxTotal,
    debitTotal: 0,
    adjustmentTotal: 0,
    netPayable: r2(b4Basic + b4TaxTotal),
    status: BILL_PASSING_STATUS.QUERY_RAISED,
    headerRemarks: '',
    // Lycra line has no QC yet — qcStatus Pending drives the BR-06 block.
    grns: [billGrn(7, [billLine(1009, 206.85, { acceptedQty: 0, rejectedQty: 0, qcStatus: 'Pending', qcResult: null, qcId: null, qcNumber: null, qtyUnquantified: true })])],
    charges: [],
    taxes: b4Taxes,
    debits: [],
    issues: [
      { id: 1, parentIssueId: null, issueTypeCode: 'QC_PENDING', description: 'QC not yet completed on the Lycra Jersey line of GRN/1007. Cannot certify payable quantity.', status: ISSUE_STATUS.OPEN, resolutionRemarks: '', raisedBy: 'Accounts Executive', raisedAt: ts(-3, '11:15'), resolvedBy: null, resolvedAt: null, withdrawnBy: null, withdrawnAt: null, withdrawReason: null, autoLogged: true },
    ],
    attachments: [{ id: 1, docType: 'SUPPLIER_INVOICE', fileName: 'KT-INV-69.pdf', size: 98304, mime: 'application/pdf', uploadedAt: ts(-4, '09:12'), uploadedBy: 'Stores' }],
    activity: activity([
      [ts(-4, '09:15'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-3, '11:15'), 'Accounts Executive', 'Query raised', 'QC pending on the Lycra Jersey line'],
    ]),
    submittedAt: ts(-4, '09:15'),
    approvedAt: null, sentToAccountsAt: null, tallyReferenceNo: null,
    duplicateOverrideBy: null, duplicateOverrideReason: null,
    queryReason: 'QC pending on the Lycra Jersey line of GRN/1007.',
    holdReason: null, holdSince: null, rejectReason: null, reopenReason: null,
    version: 2,
  };

  // 5 ── Parked on hold, ageing past the 3-day escalation default.
  const b5 = {
    ...b3,
    id: 5,
    bpNumber: bp(1005),
    supplierId: 2, supplierName: supplierName(2),
    poId: 2, poNumber: poNumberOf(2),
    supplierInvoiceNo: '52', invoiceDate: d(-14), financialYear: FY,
    challanNumbers: 'KT/1204',
    // Bills the 16 kg of the Rib line that BP/1002 left unbilled, completing
    // the split — cumulative 30 + 16 = 46, exactly the accepted quantity.
    invoiceBasicAmount: 8000, chargesTotal: 0, taxTotal: 400,
    debitTotal: 0, adjustmentTotal: 0, netPayable: 8400,
    status: BILL_PASSING_STATUS.ON_HOLD,
    headerRemarks: '',
    grns: [billGrn(5, [billLine(1006, 16)])],
    charges: [], taxes: taxLines(8000, 5, false), debits: [],
    issues: [
      { id: 1, parentIssueId: null, issueTypeCode: 'SUPPLIER_CLARIFICATION', description: 'Supplier billed 46 kg against a challan showing 46 kg but the rate differs from PO. Awaiting written confirmation.', status: ISSUE_STATUS.IN_PROGRESS, resolutionRemarks: '', raisedBy: 'Accounts Executive', raisedAt: ts(-7, '10:00'), resolvedBy: null, resolvedAt: null, withdrawnBy: null, withdrawnAt: null, withdrawReason: null, autoLogged: false },
    ],
    attachments: [],
    activity: activity([
      [ts(-9, '12:00'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-7, '10:02'), 'Accounts Executive', 'Put on hold', 'Awaiting supplier confirmation on rate'],
    ]),
    submittedAt: ts(-9, '12:00'),
    holdReason: 'Awaiting written rate confirmation from KAALIRAMAN TEX.',
    holdSince: ts(-7, '10:02'),
    version: 2,
  };

  // 6 ── Terminal: passed, handed to accounts, Tally voucher keyed back.
  const b6 = {
    ...b1,
    id: 6,
    bpNumber: bp(1006),
    poId: 5, poNumber: poNumberOf(5),
    supplierInvoiceNo: 'SLT/1102', invoiceDate: d(-32), financialYear: FY,
    challanNumbers: 'DC-498',
    // Freight is taxable here, so GST is charged on 212,500 — the ordinary case,
    // in contrast to BP/1001 where the PRD taxes the basic value alone.
    invoiceBasicAmount: 210000, chargesTotal: 2500, taxTotal: 10625,
    debitTotal: 0, adjustmentTotal: 0, netPayable: 223125,
    status: BILL_PASSING_STATUS.SENT_TO_ACCOUNTS,
    headerRemarks: '',
    grns: [billGrn(8, [billLine(1000)])],
    charges: [{ id: 1, chargeTypeCode: 'FREIGHT', amount: 2500, taxable: true, remarks: '' }],
    taxes: taxLines(212500, 5, false),
    debits: [],
    issues: [],
    attachments: [],
    activity: activity([
      [ts(-31, '10:00'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-30, '11:00'), 'Accounts Executive', 'Verified'],
      [ts(-29, '15:20'), 'Finance Manager', 'Approved', 'Net payable 223,125.00'],
      [ts(-28, '09:30'), 'Accounts', 'Sent to accounts', 'Voucher exported for Tally'],
      [ts(-27, '16:45'), 'Accounts', 'Tally voucher recorded', 'PUR/0417'],
    ]),
    submittedAt: ts(-31, '10:00'),
    approvedAt: ts(-29, '15:20'),
    sentToAccountsAt: ts(-28, '09:30'),
    tallyReferenceNo: 'PUR/0417',
    version: 6,
  };

  // 7 ── Terminal: refused, with the mandatory reason on record.
  const b7 = {
    ...b3,
    id: 7,
    bpNumber: bp(1007),
    supplierId: 2, supplierName: supplierName(2),
    poId: 2, poNumber: poNumberOf(2),
    supplierInvoiceNo: '43', invoiceDate: d(-26), financialYear: FY,
    challanNumbers: 'KT/1188',
    invoiceBasicAmount: 60840, chargesTotal: 0, taxTotal: 3042,
    debitTotal: 0, adjustmentTotal: 0, netPayable: 63882,
    status: BILL_PASSING_STATUS.REJECTED,
    grns: [billGrn(4, [billLine(1005)])],
    charges: [], taxes: taxLines(60840, 5, false), debits: [],
    issues: [],
    attachments: [],
    activity: activity([
      [ts(-25, '10:00'), 'Bill Passing Clerk', 'Submitted for verification'],
      [ts(-24, '14:00'), 'Finance Manager', 'Rejected', 'Duplicate of invoice 43 already booked'],
    ]),
    submittedAt: ts(-25, '10:00'),
    rejectReason: 'Duplicate of supplier invoice 43 already booked on an earlier bill.',
    version: 3,
  };

  return [b1, b2, b3, b4, b5, b6, b7];
}

/** A fresh database. Called by loadDb() when nothing valid is stored. */
export function buildSeedDb() {
  const bills = buildBills();
  return {
    seedVersion: SEED_VERSION,
    suppliers: SEED_SUPPLIERS,
    purchaseOrders: SEED_POS,
    poLines: SEED_PO_LINES,
    grns: SEED_GRNS,
    grnLines: SEED_GRN_LINES,
    qcs: SEED_QCS,
    debitNotes: SEED_DEBIT_NOTES,
    bills,
    // Masters, editable on the admin screens.
    debitTypes: DEBIT_TYPES.map((t, i) => ({ id: i + 1, sortOrder: (i + 1) * 10, active: true, ...t })),
    chargeTypes: CHARGE_TYPES.map((t, i) => ({ id: i + 1, sortOrder: (i + 1) * 10, active: true, ...t })),
    issueTypes: ISSUE_TYPES.map((t, i) => ({ id: i + 1, sortOrder: (i + 1) * 10, active: true, ...t })),
    tolerance: { id: 1, ...DEFAULT_TOLERANCE },
    // Continue the BP series after the seeded bills.
    docSeq: { [`BP/${FY}`]: FIRST_DOC_NUMBER - 1 + bills.length },
  };
}
