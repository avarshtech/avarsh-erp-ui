/**
 * How a job-work bill is built from its PO (the demo's stand-in for the Stage 2 server snapshot): the PO's lines
 * with every DC's good / rejected-at-receipt figures and each DC check's rejects folded in. The seed and the mock
 * API both build bills through here, so a seeded bill and one created on screen always agree.
 */
import dayjs from 'dayjs';
import { decorateBill, deductionGst, gstSplit, toUnits } from '../../../utils/jobWorkBillCalc';
import { JW_DEDUCTION_TYPES } from '../../../utils/jobWorkBillConstants';
import { currentFinancialYear } from '../../../utils/billPassingConstants';

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** The order's costing, per garment: fabric for a cut panel, all materials for a garment; DOZEN costing ÷ 12. */
export const costingRefOf = (costing, source) => {
  if (!costing) return null;
  const perPiece = (v) => (costing.pricingUnit === 'DOZEN' ? r2(v / 12) : v);
  return source === 'CUT_PANEL_PO'
    ? { basis: 'Fabric', perGarment: perPiece(costing.fabric) }
    : { basis: 'Materials', perGarment: perPiece(costing.materials) };
};

/** PO value as the PO shows it: basic + other charges + GST, rounded to the rupee. */
export const poValueOf = (po, vendor) => {
  const basic = po.lines.reduce((s, l) => s + r2(toUnits(l.poQty, l) * l.poRate), 0);
  const taxable = r2(basic + (po.otherCharges || 0));
  return Math.round(taxable + gstSplit(taxable, po.gstRatePercent, vendor.igstApplicable).total);
};

/** The bill's lines and DCs from the PO as it stands; figures keyed on the bill survive, per PO line. */
export const snapshotFromPo = (db, po, previous = {}) => {
  const keyed = new Map((previous.lines || []).map((l) => [l.id, l]));
  const fig = new Map(po.lines.map((l) => [l.id, { good: 0, rejRec: 0, rejQc: 0 }]));
  const dcs = po.dcs.map((dc) => {
    const t = { good: 0, rejRec: 0, rejQc: 0 };
    dc.lines.forEach((dl) => {
      const f = fig.get(dl.poLineId);
      // A DC's QC rejects count only once its check exists.
      const qc = dc.check ? (dl.rejectedQcQty || 0) : 0;
      [f, t].forEach((acc) => {
        acc.good += dl.goodQty;
        acc.rejRec += dl.rejectedReceiptQty || 0;
        acc.rejQc += qc;
      });
    });
    return {
      id: dc.id, returnNo: dc.returnNo, returnDate: dc.returnDate, vendorDcNo: dc.vendorDcNo, vendorDcDate: dc.vendorDcDate,
      checkId: dc.check?.id ?? null, checkNo: dc.check?.checkNo ?? null, checkStatus: dc.check?.status ?? null,
      goodQty: t.good, rejectedReceiptQty: t.rejRec, rejectedQcQty: t.rejQc,
    };
  });
  const lines = po.lines.map((l) => {
    const f = fig.get(l.id);
    const k = keyed.get(l.id) || {};
    const costing = db.costing[l.orderNo];
    return {
      id: l.id, orderNo: l.orderNo, styleNo: costing?.styleNo || null, color: l.color, panel: l.panel || null,
      size: l.size, uom: l.uom, unitPieces: l.unitPieces, unitUnits: l.unitUnits, poQty: l.poQty, issuedQty: l.issuedQty,
      poRate: l.poRate, allowanceQty: l.allowanceQty || 0,
      goodQty: f.good, rejectedReceiptQty: f.rejRec, rejectedQcQty: f.rejQc,
      invoiceUnits: k.invoiceUnits ?? null, invoiceRate: k.invoiceRate ?? null, passedUnits: k.passedUnits ?? null,
      costingRef: costingRefOf(costing, po.source),
    };
  });
  return { dcs, lines, poStatus: po.status };
};

/** A fresh draft for `po`: snapshots, and the GST lines pre-filled at the PO's rate (IGST or CGST + SGST). */
export const buildBill = (db, { id, jwbNumber, po, vendor, createdAt, vendorInvoiceNo = '', vendorInvoiceDate }) => {
  const bill = {
    id, source: po.source, jwbNumber, status: 'DRAFT', version: 0, createdAt,
    vendorId: vendor.id, vendorName: vendor.name, vendorGstin: vendor.gstin, vendorCity: vendor.city,
    igstApplicable: vendor.igstApplicable, paymentTerms: vendor.paymentTerms,
    poId: po.id, poNumber: po.poNumber, poDate: po.poDate, processName: po.processName, sacCode: po.sacCode,
    gstRatePercent: po.gstRatePercent, poOtherCharges: po.otherCharges || 0, poValue: poValueOf(po, vendor),
    expectedReturnDate: po.expectedReturnDate,
    vendorInvoiceNo, vendorInvoiceDate, financialYear: currentFinancialYear(new Date(vendorInvoiceDate)),
    headerRemarks: '', otherCharges: po.otherCharges || 0, invoiceRoundOff: 0,
    invoiceCgst: 0, invoiceSgst: 0, invoiceIgst: 0,
    ...snapshotFromPo(db, po), deductions: [], activity: [],
  };
  const gst = gstSplit(decorateBill(bill).invoiceTaxable, po.gstRatePercent, vendor.igstApplicable);
  return { ...bill, invoiceCgst: gst.cgst, invoiceSgst: gst.sgst, invoiceIgst: gst.igst };
};

/** Amount and GST of a deduction after an edit: quantity × rate for the quantity types, keyed otherwise. */
export const withDeductionFigures = (d, gstRatePercent) => {
  const amount = JW_DEDUCTION_TYPES[d.type]?.basis
    ? r2((Number(d.qty) || 0) * (Number(d.rate) || 0))
    : r2(Number(d.amount) || 0);
  const next = { ...d, amount };
  return { ...next, gstAmount: deductionGst(next, gstRatePercent) };
};

export const logActivity = (bill, action, details = '', at = dayjs()) => {
  const list = bill.activity || [];
  return [{ id: list.length + 1, timestamp: dayjs(at).toISOString(), user: 'Demo reviewer', action, details }, ...list];
};

/** The bill as the shared list shows it (the Stage 2 union row). */
export const listRowOf = (b) => ({
  key: `${b.source}:${b.id}`, source: b.source, id: b.id, number: b.jwbNumber, demo: true,
  partyType: 'VENDOR', partyId: b.vendorId, partyName: b.vendorName,
  poId: b.poId, poNumber: b.poNumber, invoiceNo: b.vendorInvoiceNo, invoiceDate: b.vendorInvoiceDate,
  challanNumbers: b.dcs.map((d) => d.vendorDcNo).join(', '),
  summary: `${b.processName} · ${b.lines.length} line${b.lines.length === 1 ? '' : 's'}`,
  poValue: b.poValue,
  receivedValue: r2(b.lines.reduce((s, l) => s + r2(toUnits(l.returnedQty, l) * l.poRate), 0)),
  invoiceValue: b.invoiceTotal, debitTotal: b.deductionTotal, netPayable: b.netPayable,
  blockerCount: b.blockers.length, tallyReferenceNo: b.tallyReferenceNo || null, status: b.status, version: b.version,
});
