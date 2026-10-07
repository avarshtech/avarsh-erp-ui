import dayjs from 'dayjs';
import { EXCEPTION_SEVERITY as SEV, DEFAULT_TOLERANCE, areDebitsEditable } from './billPassingConstants.js';
import { BILLABLE_PO_STATUSES, JW_DEDUCTION_TYPES, uomShort } from './jobWorkBillConstants.js';

/**
 * Job-work bill arithmetic — garment-industry practice for a job worker's invoice (owner, 2026-10-07):
 * pay what came back good, take back what he billed for rejected or short pieces, recover damaged material
 * and shortages above the PO's process-loss allowance through a debit note.
 *
 * Quantities are pieces; money is in the PO's billing unit (`unitPieces` pieces make `unitUnits` units:
 * PIECE 1/1, DOZEN 12/1, KG/LOT poQty/billingQty). Pure functions: the mock API and, at cutover, the Java
 * calculators compute the same numbers (golden cases in jobWorkBillGolden.json).
 */

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const r3 = (x) => Math.round((x + Number.EPSILON) * 1000) / 1000;
const r4 = (x) => Math.round((x + Number.EPSILON) * 10000) / 10000;
const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

export const toUnits = (pcs, l) => r3((pcs * l.unitUnits) / l.unitPieces);
export const toPcs = (units, l) => Math.round((units * l.unitPieces) / l.unitUnits);

/**
 * One PO line, as the bill sees it. Keyed figures (invoice qty/rate, passed qty) default to what came back,
 * the PO rate and what QC accepted. With m = min(passed, invoiced) units:
 *   passed amount = m × min(invoice rate, PO rate)
 *   rate diff     = m × invoice rate − passed amount            (≥ 0)
 *   rejection     = invoice amount − m × invoice rate           (≥ 0)
 * so invoice amount − rejection − rate diff = passed amount, exactly.
 */
export const deriveLine = (line, poStatus) => {
  // What was keyed stays apart from the effective figures, so a decorated line derives again unchanged and a
  // save sends only what the user keyed (an unkeyed figure keeps following the DCs).
  const keyed = line.keyed || { invoiceUnits: line.invoiceUnits ?? null, invoiceRate: line.invoiceRate ?? null, passedUnits: line.passedUnits ?? null };
  const l = { ...line, ...keyed };
  const returnedQty = l.goodQty + l.rejectedReceiptQty;
  const acceptedQty = Math.max(0, l.goodQty - l.rejectedQcQty);
  const rejectedQty = l.rejectedReceiptQty + l.rejectedQcQty;
  const shortQty = poStatus === 'CLOSED' ? Math.max(0, l.issuedQty - returnedQty) : 0;
  const invoiceUnits = l.invoiceUnits ?? toUnits(returnedQty, l);
  const invoiceRate = l.invoiceRate ?? l.poRate;
  const passedUnits = l.passedUnits ?? toUnits(acceptedQty, l);
  const m = Math.min(passedUnits, invoiceUnits);
  const invoiceAmount = r2(invoiceUnits * invoiceRate);
  const atInvoiceRate = r2(m * invoiceRate);
  const passedAmount = r2(m * Math.min(invoiceRate, l.poRate));
  const passedPcs = toPcs(passedUnits, l);
  // Rejects paid anyway (the verifier passed them: not his fault) are not recovered from him.
  const unpaidRejects = Math.max(0, rejectedQty - Math.max(0, passedPcs - acceptedQty));
  const allowance = Math.floor(l.allowanceQty || 0);
  const allowanceLeft = Math.max(0, allowance - unpaidRejects);
  return {
    ...l,
    keyed,
    returnedQty, acceptedQty, rejectedQty, shortQty, invoiceUnits, invoiceRate, passedUnits, passedPcs,
    billedUnits: r3(m),
    invoiceAmount,
    passedAmount,
    rateDiffAmount: r2(atInvoiceRate - passedAmount),
    rejectionAmount: r2(invoiceAmount - atInvoiceRate),
    recoverableRejectQty: Math.max(0, unpaidRejects - allowance),
    recoverableShortQty: Math.max(0, shortQty - allowanceLeft),
    allowanceUsed: Math.min(allowance, unpaidRejects + shortQty),
  };
};

/** GST on a taxable value: IGST for an inter-state vendor, otherwise CGST + SGST (SGST takes the odd paisa). */
export const gstSplit = (taxable, ratePercent, igst) => {
  const tax = r2((taxable * (ratePercent || 0)) / 100);
  if (igst) return { cgst: 0, sgst: 0, igst: tax, total: tax };
  const cgst = r2(tax / 2);
  return { cgst, sgst: r2(tax - cgst), igst: 0, total: tax };
};

export const deductionGst = (d, ratePercent) =>
  (d.gstTreatment === 'WITH_GST' ? r2((d.amount * (ratePercent || 0)) / 100) : 0);

export const computeTotals = (bill, lines, deductions) => {
  const linesInvoice = r2(sum(lines, 'invoiceAmount'));
  const invoiceTaxable = r2(linesInvoice + (Number(bill.otherCharges) || 0));
  const gstComputed = gstSplit(invoiceTaxable, bill.gstRatePercent, bill.igstApplicable);
  const invoiceGst = r2((Number(bill.invoiceCgst) || 0) + (Number(bill.invoiceSgst) || 0) + (Number(bill.invoiceIgst) || 0));
  const invoiceTotal = r2(invoiceTaxable + invoiceGst + (Number(bill.invoiceRoundOff) || 0));
  const confirmed = deductions.filter((d) => d.status === 'CONFIRMED');
  const deductionTotal = r2(sum(confirmed, 'amount'));
  const deductionGstTotal = r2(sum(confirmed, 'gstAmount'));
  const debitNoteTotal = r2(deductionTotal + deductionGstTotal);
  return {
    linesInvoice, invoiceTaxable, gstComputed, invoiceGst, invoiceTotal,
    passedAmount: r2(sum(lines, 'passedAmount')),
    rejectionAmount: r2(sum(lines, 'rejectionAmount')),
    rateDiffAmount: r2(sum(lines, 'rateDiffAmount')),
    taxVariance: r2(invoiceGst - gstComputed.total),
    deductionTotal, deductionGst: deductionGstTotal, debitNoteTotal,
    netPayable: r2(invoiceTotal - debitNoteTotal),
    debitPercent: invoiceTaxable > 0 ? r2((deductionTotal / invoiceTaxable) * 100) : 0,
  };
};

const keyOf = (type, lineId) => `${type}:${lineId ?? ''}`;

/**
 * "Propose deductions": a fresh proposal per line and type, from the figures as they stand. Manual rows and
 * system rows the verifier already confirmed or dropped are kept; a recovery rate keyed on an open proposal
 * survives the re-proposal.
 */
export const proposeDeductions = (bill, lines, existing, nextId) => {
  const kept = existing.filter((d) => d.origin === 'MANUAL' || d.status !== 'PROPOSED');
  const ruled = new Set(kept.filter((d) => d.origin === 'SYSTEM_PROPOSED').map((d) => keyOf(d.type, d.lineId)));
  const keyedRate = new Map(existing.filter((d) => d.origin === 'SYSTEM_PROPOSED' && d.status === 'PROPOSED')
    .map((d) => [keyOf(d.type, d.lineId), d.rate]));
  const out = [];
  const add = (type, line, qty, rate, amount, reason) => {
    if (ruled.has(keyOf(type, line?.id))) return;
    const gstTreatment = JW_DEDUCTION_TYPES[type].gst;
    const d = {
      id: nextId(), lineId: line?.id ?? null, type, qty, rate, amount: r2(amount), gstTreatment, reason,
      remarks: '', origin: 'SYSTEM_PROPOSED', status: 'PROPOSED',
    };
    out.push({ ...d, gstAmount: deductionGst(d, bill.gstRatePercent) });
  };
  lines.forEach((l) => {
    const what = [l.color, l.panel, l.size].filter(Boolean).join(' · ');
    if (l.rejectionAmount > 0) {
      const qty = r3(l.invoiceUnits - l.billedUnits);
      add('REJECTION_CHARGE', l, qty, l.invoiceRate, l.rejectionAmount, `${what}: invoiced ${qty} ${uomShort(l.uom)} he is not paid for`);
    }
    if (l.rateDiffAmount > 0) {
      add('RATE_DIFFERENCE', l, l.billedUnits, r4(l.invoiceRate - l.poRate), l.rateDiffAmount, `${what}: invoiced at ${l.invoiceRate} against PO ${l.poRate}`);
    }
    const reuse = (type) => keyedRate.get(keyOf(type, l.id)) || 0;
    if (l.recoverableRejectQty > 0) {
      const rate = reuse('MATERIAL_DAMAGE');
      add('MATERIAL_DAMAGE', l, l.recoverableRejectQty, rate, l.recoverableRejectQty * rate, `${what}: ${l.recoverableRejectQty} pcs rejected beyond the allowance`);
    }
    if (l.recoverableShortQty > 0) {
      const rate = reuse('SHORTAGE');
      add('SHORTAGE', l, l.recoverableShortQty, rate, l.recoverableShortQty * rate, `${what}: ${l.recoverableShortQty} pcs never returned`);
    }
  });
  const excess = r2((Number(bill.otherCharges) || 0) - (Number(bill.poOtherCharges) || 0));
  if (excess > 0) add('EXCESS_CHARGES', null, null, null, excess, `Other charges ${bill.otherCharges} against ${bill.poOtherCharges || 0} on the PO`);
  return [...kept, ...out];
};

const ex = (code, severity, title, detail) => ({ code, severity, title, detail });

export const computeExceptions = (bill, lines, totals, deductions) => {
  const out = [];
  if (!BILLABLE_PO_STATUSES.includes(bill.poStatus)) {
    out.push(ex('PO_NOT_FINAL', SEV.BLOCK, 'PO is not complete',
      `${bill.poNumber} is ${bill.poStatus}; a vendor bill is passed once every line is back or the PO is short-closed`));
  }
  const unchecked = (bill.dcs || []).filter((d) => !d.checkId || d.checkStatus === 'PARTIAL');
  if (unchecked.length) {
    out.push(ex('QC_PENDING', SEV.BLOCK, 'Check pending on vendor DCs',
      `${unchecked.map((d) => d.vendorDcNo).join(', ')} — complete the check before the bill is passed`));
  }
  const paidRejects = lines.filter((l) => l.passedPcs > l.acceptedQty);
  if (paidRejects.length) {
    out.push(ex('PASSED_ABOVE_ACCEPTED', SEV.BLOCK_WITH_OVERRIDE, 'Paying for rejected pieces',
      `${paidRejects.length} line(s) pass more than QC accepted; sending for approval needs a reason`));
  }
  const open = deductions.filter((d) => d.status === 'PROPOSED').length;
  if (open) out.push(ex('DEBITS_UNCONFIRMED', SEV.BLOCK, 'Deductions to confirm or drop', `${open} proposed deduction(s) still open`));
  if (Math.abs(totals.taxVariance) > DEFAULT_TOLERANCE.taxVarianceAmount) {
    out.push(ex('TAX_MISMATCH', SEV.WARN, 'GST differs from the PO rate',
      `Invoice GST ${totals.invoiceGst} against ${totals.gstComputed.total} at ${bill.gstRatePercent}%`));
  }
  const count = (pred) => lines.filter(pred).length;
  const above = count((l) => l.invoiceRate > l.poRate);
  if (above) out.push(ex('INVOICE_RATE_ABOVE_PO', SEV.WARN, 'Invoice rate above PO', `${above} line(s); the difference is a deduction`));
  const below = count((l) => l.invoiceRate < l.poRate);
  if (below) out.push(ex('INVOICE_RATE_BELOW_PO', SEV.WARN, 'Invoice rate below PO', `${below} line(s) are paid at his lower rate`));
  const short = count((l) => l.invoiceUnits < l.passedUnits);
  if (short) out.push(ex('INVOICE_QTY_BELOW_ACCEPTED', SEV.WARN, 'Invoiced less than accepted', `${short} line(s) are paid only what he invoiced`));
  return out;
};

/** Days the last DC came in after the PO's expected return date (0 when on time or unknown). */
export const lateDaysOf = (bill) => {
  const last = (bill.dcs || []).map((d) => d.vendorDcDate || d.returnDate).filter(Boolean).sort().pop();
  if (!last || !bill.expectedReturnDate) return 0;
  return Math.max(0, dayjs(last).diff(dayjs(bill.expectedReturnDate), 'day'));
};

/** Everything the screens read on a bill, computed from what is stored — the Stage 2 response shape. */
export const decorateBill = (bill) => {
  const lines = (bill.lines || []).map((l) => deriveLine(l, bill.poStatus));
  const deductions = bill.deductions || [];
  const totals = computeTotals(bill, lines, deductions);
  const exceptions = computeExceptions(bill, lines, totals, deductions);
  const blockers = exceptions.filter((x) => x.severity === SEV.BLOCK).map((x) => x.title);
  const open = areDebitsEditable(bill.status);
  return {
    ...bill, lines, deductions, ...totals, exceptions, blockers,
    canSendForApproval: blockers.length === 0,
    editable: open, debitsEditable: open,
    lateDays: lateDaysOf(bill),
    lineCount: lines.length, dcCount: (bill.dcs || []).length,
    approvalMode: 'DIRECT',
  };
};
