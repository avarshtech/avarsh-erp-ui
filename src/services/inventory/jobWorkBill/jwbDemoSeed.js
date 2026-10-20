/**
 * Demo data for the job-work bill mock, dated relative to the day it is seeded. Each PO shows one rule:
 *   CPPO 1004 completed, rejects at receipt and at the panel check  → rejection charge + material damage
 *   CPPO 1006 short-closed with pieces never returned                → shortage recovery
 *   GPPO 1009 completed, one DC never checked                         → QC pending blocks the bill
 *   CPPO 1008 billed per KG, nothing rejected                         → units, a clean bill
 *   GPPO 1010 partially completed                                     → never offered in New Bill
 *   CPPO 1001 / GPPO 1005 / GPPO 1007 already carry a bill (approved / pending approval / draft; 1007 has an
 *   excess allowance, a fractional one on L, an invoice rate above the PO and other charges above the PO).
 * Vendors, GSTINs and numbers are invented.
 */
import dayjs from 'dayjs';
import { decorateBill, gstSplit, proposeDeductions } from '../../../utils/jobWorkBillCalc';
import { buildBill, logActivity, withDeductionFigures } from './jwbMockSnapshot';

export const JWB_SEED_VERSION = 1;

const VENDORS = [
  { id: 1000101, name: 'Sri Murugan Screen Prints', gstin: '33AAKFS4127M1Z2', city: 'Tiruppur', igstApplicable: false, paymentTerms: '30 days from bill passing' },
  { id: 1000102, name: 'Kavya Embroideries', gstin: '33ABZPK8841D1ZQ', city: 'Coimbatore', igstApplicable: false, paymentTerms: '15 days' },
  { id: 1000103, name: 'Bengaluru Wash House', gstin: '29AAHFB2290L1ZK', city: 'Bengaluru', igstApplicable: true, paymentTerms: '45 days' },
];

// Per-garment costing of the two demo orders; ORD/0003 is costed per dozen.
const COSTING = {
  'ORD/0002': { styleNo: 'AV-TS-101', pricingUnit: 'PIECE', fabric: 92.4, materials: 118.75 },
  'ORD/0003': { styleNo: 'AV-DJ-220', pricingUnit: 'DOZEN', fabric: 2640, materials: 3180 },
};

const PIECE = { uom: 'PIECE', unitPieces: 1, unitUnits: 1 };
const ln = (id, orderNo, color, panel, size, poQty, poRate, extra = {}) => ({
  id, orderNo, color, panel, size, poQty, issuedQty: poQty, poRate, allowanceQty: 0, ...PIECE, ...extra,
});
const dl = (poLineId, goodQty, rejectedReceiptQty = 0, rejectedQcQty = 0) => ({ poLineId, goodQty, rejectedReceiptQty, rejectedQcQty });

export const buildJwbSeed = (today) => {
  const d = (n) => dayjs(today).subtract(n, 'day').format('YYYY-MM-DD');
  const dc = (id, returnNo, ago, vendorDcNo, check, lines) => ({
    id, returnNo, returnDate: d(ago), vendorDcNo, vendorDcDate: d(ago + 1), check, lines,
  });
  const pc = (id, no, status) => ({ id, checkNo: no, status });
  const po = (id, source, poNumber, vendorId, status, processName, ago, lines, dcs, extra = {}) => ({
    id, source, poNumber, vendorId, status, processName, sacCode: '998821', gstRatePercent: 5, otherCharges: 0,
    poDate: d(ago), expectedReturnDate: d(ago - 12), lines, dcs, ...extra,
  });
  const CPP = 'CUT_PANEL_PO';
  const GPO = 'GARMENT_PROCESS_PO';

  const pos = [
    po(501, CPP, 'CPPO/26-27/1001', 1000101, 'COMPLETED', 'Front Panel Print', 40,
      [ln(5011, 'ORD/0002', 'Navy', 'Front', 'M', 150, 4.25), ln(5012, 'ORD/0002', 'Navy', 'Front', 'L', 150, 4.25)],
      [dc(1, 'RDC/26-27/1003', 26, 'SMP/DC/2190', pc(31, 'PC-021', 'FAILED'), [dl(5011, 148, 2, 1), dl(5012, 150)])]),
    po(502, GPO, 'GPPO/26-27/1005', 1000102, 'COMPLETED', 'Garment Embroidery', 30,
      [ln(5021, 'ORD/0003', 'Indigo', null, 'M', 120, 22), ln(5022, 'ORD/0003', 'Indigo', null, 'L', 120, 22)],
      [dc(2, 'GRD/26-27/1008', 16, 'KE/DC/0412', pc(41, 'GC-008', 'PASSED'), [dl(5021, 120), dl(5022, 120)])]),
    po(503, GPO, 'GPPO/26-27/1007', 1000103, 'COMPLETED', 'Enzyme Wash', 25, [
      ln(5031, 'ORD/0003', 'Indigo', null, 'M', 408, 18, { allowanceQty: 8 }),
      ln(5032, 'ORD/0003', 'Indigo', null, 'L', 515, 18, { allowanceQty: 10.5 }),
      ln(5033, 'ORD/0003', 'Indigo', null, 'XL', 306, 18, { allowanceQty: 6 }),
    ], [
      dc(3, 'GRD/26-27/1011', 9, 'BWH/DC/7781', pc(42, 'GC-011', 'FAILED'), [dl(5031, 400, 8, 6), dl(5032, 508, 7, 9)]),
      dc(4, 'GRD/26-27/1013', 6, 'BWH/DC/7795', pc(43, 'GC-012', 'PASSED'), [dl(5033, 302, 4)]),
    ], { otherCharges: 200 }),
    po(504, CPP, 'CPPO/26-27/1004', 1000101, 'COMPLETED', 'Front Panel Print', 22, [
      ln(5041, 'ORD/0002', 'Navy', 'Front', 'S', 120, 4.5), ln(5042, 'ORD/0002', 'Navy', 'Front', 'M', 200, 4.5),
      ln(5043, 'ORD/0002', 'Navy', 'Front', 'L', 200, 4.5), ln(5044, 'ORD/0002', 'Navy', 'Front', 'XL', 80, 4.5),
    ], [
      dc(5, 'RDC/26-27/1012', 8, 'SMP/DC/2231', pc(32, 'PC-031', 'FAILED'), [dl(5041, 120), dl(5042, 196, 4, 6)]),
      dc(6, 'RDC/26-27/1019', 4, 'SMP/DC/2246', pc(33, 'PC-034', 'FAILED'), [dl(5043, 195, 5, 3), dl(5044, 80)]),
    ]),
    po(505, CPP, 'CPPO/26-27/1006', 1000102, 'CLOSED', 'Chest Embroidery', 28,
      [ln(5051, 'ORD/0002', 'White', 'Front', 'M', 300, 6), ln(5052, 'ORD/0002', 'White', 'Front', 'L', 300, 6)],
      [dc(7, 'RDC/26-27/1015', 7, 'KE/DC/0431', pc(34, 'PC-033', 'FAILED'), [dl(5051, 285, 5, 2), dl(5052, 276, 4)])]),
    po(506, GPO, 'GPPO/26-27/1009', 1000101, 'COMPLETED', 'Garment Printing', 18,
      [ln(5061, 'ORD/0003', 'Black', null, 'M', 100, 12), ln(5062, 'ORD/0003', 'Black', null, 'L', 100, 12)], [
        dc(8, 'GRD/26-27/1016', 5, 'SMP/DC/2240', pc(44, 'GC-014', 'PASSED'), [dl(5061, 100)]),
        dc(9, 'GRD/26-27/1018', 2, 'SMP/DC/2252', null, [dl(5062, 98, 2)]),
      ]),
    po(507, GPO, 'GPPO/26-27/1010', 1000102, 'PARTIALLY_COMPLETED', 'Garment Embroidery', 10,
      [ln(5071, 'ORD/0003', 'Indigo', null, 'M', 200, 22)],
      [dc(10, 'GRD/26-27/1017', 3, 'KE/DC/0440', pc(45, 'GC-015', 'PASSED'), [dl(5071, 120)])]),
    po(508, CPP, 'CPPO/26-27/1008', 1000103, 'COMPLETED', 'Panel Garment Dyeing', 20,
      [ln(5081, 'ORD/0002', 'Grey Melange', 'Body', 'All', 500, 120, { uom: 'KG', unitPieces: 500, unitUnits: 25 })],
      [dc(11, 'RDC/26-27/1017', 6, 'BWH/DC/7790', pc(35, 'PC-032', 'PASSED'), [dl(5081, 500)])]),
  ];

  const db = {
    seedVersion: JWB_SEED_VERSION, vendors: VENDORS, costing: COSTING, pos, bills: [],
    counters: { JWB: 1003, VDN: 1001 }, seq: { bill: 3, deduction: 0 },
  };
  const nextDeductionId = () => { db.seq.deduction += 1; return db.seq.deduction; };
  const vendorOf = (p) => VENDORS.find((v) => v.id === p.vendorId);
  const make = (id, jwbNumber, poId, invoiceNo, ago) => {
    const p = pos.find((x) => x.id === poId);
    return buildBill(db, { id, jwbNumber, po: p, vendor: vendorOf(p), createdAt: dayjs(d(ago)).toISOString(), vendorInvoiceNo: invoiceNo, vendorInvoiceDate: d(ago) });
  };
  const propose = (b) => proposeDeductions(b, decorateBill(b).lines, b.deductions, nextDeductionId);
  const rule = (b, type, rate) => b.deductions.map((x) => (x.type !== type ? x
    : withDeductionFigures({ ...x, rate: rate ?? x.rate, status: 'CONFIRMED' }, b.gstRatePercent)));

  // Approved, with its Vendor Debit Note.
  let b1 = make(1, 'JWB/26-27/1001', 501, 'SMP/INV/1187', 20);
  b1 = { ...b1, deductions: propose(b1) };
  b1 = { ...b1, deductions: rule(b1, 'REJECTION_CHARGE') };
  b1 = { ...b1, deductions: rule(b1, 'MATERIAL_DAMAGE', 92.4) };
  const passed = decorateBill(b1);
  b1 = {
    ...b1, status: 'APPROVED', version: 6, submittedAt: d(19), approvedAt: dayjs(d(15)).toISOString(),
    vdnNumber: 'VDN/26-27/1001', vdnDate: d(15), vdnAmount: passed.debitNoteTotal, vdnRevision: 1,
  };
  b1.activity = ['Created as draft', 'Submitted', 'Verification started', 'Sent for approval', 'Approved']
    .reduce((acc, a, i) => logActivity({ activity: acc }, a, i === 4 ? `Vendor Debit Note ${b1.vdnNumber}` : '', d(20 - i)), []);

  // Clean bill waiting for the approver.
  let b2 = make(2, 'JWB/26-27/1002', 502, 'KE/INV/0388', 12);
  b2 = { ...b2, status: 'PENDING_APPROVAL', version: 4, submittedAt: d(11), sentForApprovalAt: dayjs(d(10)).toISOString() };
  b2.activity = ['Created as draft', 'Submitted', 'Verification started', 'Sent for approval']
    .reduce((acc, a, i) => logActivity({ activity: acc }, a, '', d(12 - i)), []);

  // Draft: he invoiced at 18.50 against 18.00 and charged 250 against 200 for transport.
  let b3 = make(3, 'JWB/26-27/1003', 503, 'BWH/INV/2291', 3);
  b3 = { ...b3, otherCharges: 250, lines: b3.lines.map((l) => ({ ...l, invoiceRate: 18.5 })) };
  // His IGST is on his own figures, so it follows the edited invoice.
  const gst = gstSplit(decorateBill(b3).invoiceTaxable, b3.gstRatePercent, b3.igstApplicable);
  b3 = { ...b3, invoiceCgst: gst.cgst, invoiceSgst: gst.sgst, invoiceIgst: gst.igst };
  b3.activity = logActivity(b3, 'Created as draft', '', d(3));

  db.bills = [b1, b2, b3];
  return db;
};
