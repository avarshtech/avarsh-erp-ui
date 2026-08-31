/**
 * Read side of the Bill Passing mock: everything the module pulls rather than
 * keys. Mirrors the future REST contract:
 *   GET /inventory/bill-passing/sources/suppliers
 *   GET /inventory/bill-passing/sources/pos?supplierId=
 *   GET /inventory/bill-passing/sources/po/{poId}
 *   GET /inventory/bill-passing/lines
 *   GET /inventory/bill-passing/dashboard
 *
 * The user never re-keys PO, GRN or QC data (PRD section 1.1) — it is assembled
 * here, with each GRN line carrying its QC result, how much of it has already
 * been billed, and any debit note that already recovered part of it.
 */
import { loadDb } from './billPassingMockStore';
import {
  cumulativeBilledQty, coveringBillNumbers, lineBillingStatus, round2, round3, billLines,
} from '../../utils/billPassingCalc';
import { LINE_BILLING_STATUS } from '../../utils/billPassingConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
export const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };

const byId = (arr, id) => arr.find((x) => x.id === id);

/** One GRN line, enriched with QC, billing history and any linked debit note. */
const enrichGrnLine = (db, gl, excludeBillId) => {
  const pl = byId(db.poLines, gl.poLineItemId) || {};
  const q = db.qcs.find((x) => x.grnLineItemId === gl.id);
  const accepted = q ? q.acceptedQty : 0;
  const rejected = q ? q.rejectedQty : 0;

  // Payable basis is QC-accepted quantity (BR-08); until QC completes there is
  // no accepted figure, so the received quantity is the only ceiling.
  const billable = q ? accepted : gl.receivedQty;
  const billedSoFar = cumulativeBilledQty(db.bills, gl.id, excludeBillId);
  const linkedNotes = db.debitNotes.filter((n) => n.grnLineItemId === gl.id);

  return {
    grnLineItemId: gl.id,
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
    shortageQty: round3(Math.max(0, (pl.qty || 0) - gl.receivedQty)),
    excessQty: round3(Math.max(0, gl.receivedQty - (pl.qty || 0))),
    rate: pl.rate,
    grnValue: round2(gl.receivedQty * (pl.rate || 0)),
    qcId: q ? q.id : null,
    qcNumber: q ? q.qcNumber : null,
    qcStatus: q ? q.status : 'Pending',
    qcResult: q ? q.overallResult : null,
    qcInspector: q ? q.inspector : null,
    qcInspectionDate: q ? q.inspectionDate : null,
    rejectionReason: q ? q.rejectionReason : '',
    defects: q ? q.defects : [],
    qtyUnquantified: !q,
    // Billing control (BR-23/24)
    billableQty: round3(billable),
    billedQty: round3(billedSoFar),
    pendingQty: round3(Math.max(0, billable - billedSoFar)),
    billingStatus: lineBillingStatus(billedSoFar, billable),
    coveringBills: coveringBillNumbers(db.bills, gl.id, excludeBillId),
    linkedDebitNotes: linkedNotes.map((n) => ({
      id: n.id, debitNoteNumber: n.debitNoteNumber, qty: n.qty,
      unitPrice: n.unitPrice, grandTotal: n.grandTotal, status: n.status,
      returnNumber: n.returnNumber,
    })),
  };
};

/** Active suppliers, for the first step of the entry form. */
export const listBpSuppliers = async () => {
  await delay(60);
  const db = loadDb();
  return clone(db.suppliers.filter((s) => s.active));
};

/**
 * POs of a supplier that still have something to bill. A PO whose every GRN
 * line is fully billed drops out unless `includeFullyBilled` is set.
 */
export const listBillablePos = async ({ supplierId, includeFullyBilled = false } = {}) => {
  await delay(120);
  const db = loadDb();
  const pos = db.purchaseOrders.filter((p) => !supplierId || p.supplierId === Number(supplierId));

  const rows = pos.map((p) => {
    const grns = db.grns.filter((g) => g.poId === p.id);
    const lines = db.grnLines
      .filter((gl) => grns.some((g) => g.id === gl.grnId))
      .map((gl) => enrichGrnLine(db, gl, null));
    const pending = round3(lines.reduce((s, l) => s + l.pendingQty, 0));
    const supplier = byId(db.suppliers, p.supplierId) || {};
    const poLines = db.poLines.filter((l) => l.poId === p.id);
    return {
      id: p.id,
      poNumber: p.poNumber,
      poDate: p.poDate,
      supplierId: p.supplierId,
      supplierName: supplier.name,
      deliveryDate: p.deliveryDate,
      gstPercent: p.gstPercent,
      poValue: round2(poLines.reduce((s, l) => s + l.qty * l.rate, 0)),
      grnCount: grns.length,
      pendingQty: pending,
      hasUnbilled: pending > 0,
    };
  });

  return clone(includeFullyBilled ? rows : rows.filter((r) => r.hasUnbilled));
};

/**
 * Everything a bill workspace needs for one PO: header, the PO-level summary
 * (FR-BP-302) and every GRN with its enriched lines, newest first.
 * `excludeBillId` keeps a bill being edited from counting against itself.
 */
export const getPoBillingSource = async (poId, { excludeBillId = null } = {}) => {
  await delay();
  const db = loadDb();
  const p = byId(db.purchaseOrders, Number(poId));
  if (!p) fail('NOT_FOUND', 'Purchase order not found');
  const supplier = byId(db.suppliers, p.supplierId) || {};
  const poLines = db.poLines.filter((l) => l.poId === p.id);

  const grns = db.grns
    .filter((g) => g.poId === p.id)
    .sort((a, b) => (a.grnDate < b.grnDate ? 1 : -1))
    .map((g) => ({
      grnId: g.id,
      grnNumber: g.grnNumber,
      grnType: g.grnType,
      grnDate: g.grnDate,
      challanNo: g.challanNo,
      challanDate: g.challanDate,
      status: g.status,
      vehicleNumber: g.vehicleNumber,
      transporter: g.transporter,
      lines: db.grnLines.filter((gl) => gl.grnId === g.id).map((gl) => enrichGrnLine(db, gl, excludeBillId)),
    }));

  const all = grns.flatMap((g) => g.lines);
  const billedValue = round2(
    db.bills
      .filter((b) => b.poId === p.id && b.status !== 'REJECTED' && b.id !== excludeBillId)
      .reduce((s, b) => s + b.invoiceBasicAmount, 0),
  );
  const poValue = round2(poLines.reduce((s, l) => s + l.qty * l.rate, 0));

  return clone({
    po: {
      id: p.id, poNumber: p.poNumber, poDate: p.poDate, deliveryDate: p.deliveryDate,
      gstPercent: p.gstPercent, status: p.status, poValue,
    },
    supplier: {
      id: supplier.id, name: supplier.name, gstin: supplier.gstin,
      stateCode: supplier.stateCode, igstApplicable: supplier.igstApplicable,
      paymentTerms: supplier.paymentTerms,
    },
    // FR-BP-302 consolidated summary row.
    summary: {
      poQty: round3(poLines.reduce((s, l) => s + l.qty, 0)),
      receivedQty: round3(all.reduce((s, l) => s + l.receivedQty, 0)),
      acceptedQty: round3(all.reduce((s, l) => s + l.acceptedQty, 0)),
      rejectedQty: round3(all.reduce((s, l) => s + l.rejectedQty, 0)),
      shortageQty: round3(all.reduce((s, l) => s + l.shortageQty, 0)),
      excessQty: round3(all.reduce((s, l) => s + l.excessQty, 0)),
      grnValue: round2(all.reduce((s, l) => s + l.grnValue, 0)),
      poValue,
      billedValue,
      balanceToBill: round2(poValue - billedValue),
      pendingQty: round3(all.reduce((s, l) => s + l.pendingQty, 0)),
    },
    grns,
  });
};

/**
 * The PO-line register — the flat view that replaces the client's Excel sheet.
 * One row per GRN line: what was ordered, what arrived, what was debited, and
 * which supplier invoice covered it. A row with no invoice is still to bill.
 */
export const searchBillLines = async (params = {}) => {
  await delay();
  const db = loadDb();
  const { supplierId, poId, search, billingStatus, page = 0, size = 20 } = params;

  const billLineIndex = new Map();
  db.bills.filter((b) => b.status !== 'REJECTED').forEach((b) => {
    billLines(b).forEach((l) => {
      const cur = billLineIndex.get(l.grnLineItemId) || [];
      cur.push({ bpNumber: b.bpNumber, billId: b.id, status: b.status, invoiceNo: b.supplierInvoiceNo, invoiceDate: b.invoiceDate, billedQty: l.billedQty });
      billLineIndex.set(l.grnLineItemId, cur);
    });
  });

  const debitByLine = new Map();
  db.bills.forEach((b) => (b.debits || []).forEach((dd) => {
    if (dd.grnLineItemId == null || dd.status === 'DROPPED') return;
    debitByLine.set(dd.grnLineItemId, round2((debitByLine.get(dd.grnLineItemId) || 0) + dd.debitAmount));
  }));

  let rows = db.grnLines.map((gl) => {
    const g = byId(db.grns, gl.grnId) || {};
    const p = byId(db.purchaseOrders, g.poId) || {};
    const supplier = byId(db.suppliers, p.supplierId) || {};
    const e = enrichGrnLine(db, gl, null);
    const covers = billLineIndex.get(gl.id) || [];
    return {
      key: gl.id,
      grnLineItemId: gl.id,
      poId: p.id,
      poNumber: p.poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      itemCode: e.itemCode,
      description: e.description,
      color: e.color,
      uom: e.uom,
      poQty: e.poQty,
      receivedQty: e.receivedQty,
      acceptedQty: e.acceptedQty,
      rejectedQty: e.rejectedQty,
      // Recd vs PO — the variance the client eyeballs on the sheet today.
      qtyVariance: round3(e.receivedQty - e.poQty),
      debitAmount: debitByLine.get(gl.id) || 0,
      grnId: g.id,
      grnNumber: g.grnNumber,
      grnDate: g.grnDate,
      challanNo: g.challanNo,
      receivedDate: g.grnDate,
      rate: e.rate,
      poValue: round2((e.poQty || 0) * (e.rate || 0)),
      grnValue: e.grnValue,
      billedQty: e.billedQty,
      pendingQty: e.pendingQty,
      billingStatus: e.billingStatus,
      invoiceNo: covers.map((c) => c.invoiceNo).join(', '),
      invoiceDate: covers.length ? covers[0].invoiceDate : null,
      coveringBills: covers.map((c) => c.bpNumber),
    };
  });

  if (supplierId) rows = rows.filter((r) => r.supplierId === Number(supplierId));
  if (poId) rows = rows.filter((r) => r.poId === Number(poId));
  if (billingStatus) rows = rows.filter((r) => r.billingStatus === billingStatus);
  if (search) {
    const t = String(search).toLowerCase();
    rows = rows.filter((r) => [r.poNumber, r.supplierName, r.description, r.color, r.grnNumber, r.invoiceNo]
      .some((f) => String(f || '').toLowerCase().includes(t)));
  }

  rows.sort((a, b) => (a.receivedDate < b.receivedDate ? 1 : -1));

  const start = Number(page) * Number(size);
  return clone({
    content: rows.slice(start, start + Number(size)),
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / Number(size)) || 1,
    size: Number(size),
    number: Number(page),
    stats: {
      unbilled: rows.filter((r) => r.billingStatus === LINE_BILLING_STATUS.UNBILLED).length,
      partiallyBilled: rows.filter((r) => r.billingStatus === LINE_BILLING_STATUS.PARTIALLY_BILLED).length,
      fullyBilled: rows.filter((r) => r.billingStatus === LINE_BILLING_STATUS.FULLY_BILLED).length,
      pendingValue: round2(rows.reduce((s, r) => s + r.pendingQty * (r.rate || 0), 0)),
    },
  });
};
