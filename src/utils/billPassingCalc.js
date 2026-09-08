/**
 * Bill Passing preview arithmetic — pure functions, no I/O.
 *
 * The server owns these figures: it recomputes every total, the reconciliation
 * and the exception list on each write, and its answer is what is stored and
 * shown (BR-12). What is left here is the live preview, so the workspace can
 * follow along while the user types a quantity or a charge, before anything is
 * saved.
 *
 * Rounding differs from the server's in one place only: JavaScript rounds a
 * negative exact half toward positive infinity where BigDecimal HALF_UP rounds
 * away from zero. The saved figure is always the server's.
 */
import { DEBIT_STATUS } from './billPassingConstants';

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const round3 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 1000) / 1000;

const sum = (arr, pick) => arr.reduce((s, x) => s + (Number(pick(x)) || 0), 0);

/** Every GRN line on the bill, flattened. */
export const billLines = (bill) => (bill?.grns || []).flatMap((g) => g.lines || []);

/**
 * The same lines, each carrying the GRN it belongs to. Lines are nested under
 * their GRN, so anything that needs a grnId (a debit reference, the QC panel)
 * must go through here rather than through billLines().
 */
export const billLinesWithGrn = (bill) =>
  (bill?.grns || []).flatMap((g) =>
    (g.lines || []).map((l) => ({
      ...l,
      grnId: g.grnId,
      grnNumber: g.grnNumber,
      grnDate: g.grnDate,
      challanNo: g.challanNo,
      challanDate: g.challanDate,
    })));

/** Basic value = sum of what each line is actually being billed for. */
export const computeBasic = (bill) => round2(sum(billLines(bill), (l) => l.billedValue));

/** GST applies to the basic value plus any charge flagged taxable. */
export const computeTaxableValue = (bill) =>
  round2(computeBasic(bill) + sum((bill?.charges || []).filter((c) => c.taxable), (c) => c.amount));

/**
 * BR-12 — Net Payable = Basic + Charges + Taxes − Confirmed Debits − Adjustments.
 * Returns a NEW bill with the derived totals refreshed; never mutates.
 */
export const recalcBill = (bill) => {
  const invoiceBasicAmount = computeBasic(bill);
  const chargesTotal = round2(sum(bill?.charges || [], (c) => c.amount));
  const taxTotal = round2(sum(bill?.taxes || [], (t) => t.asPerInvoiceAmount));
  const debitTotal = round2(sum(
    (bill?.debits || []).filter((d) => d.status === DEBIT_STATUS.CONFIRMED),
    (d) => d.debitAmount,
  ));
  const adjustmentTotal = round2(bill?.adjustmentTotal);
  return {
    ...bill,
    invoiceBasicAmount,
    chargesTotal,
    taxTotal,
    debitTotal,
    adjustmentTotal,
    netPayable: round2(invoiceBasicAmount + chargesTotal + taxTotal - debitTotal - adjustmentTotal),
  };
};

/** Recompute each tax line's expected amount and its variance vs the invoice. */
export const recalcTaxes = (bill) => {
  const taxableValue = computeTaxableValue(bill);
  return (bill?.taxes || []).map((t) => {
    const computedAmount = round2((taxableValue * (Number(t.ratePercent) || 0)) / 100);
    return {
      ...t,
      taxableValue,
      computedAmount,
      variance: round2((Number(t.asPerInvoiceAmount) || 0) - computedAmount),
    };
  });
};

/** Debit as a share of the invoice — drives the co-approval band. */
export const debitPercentOfInvoice = (bill) => {
  const basic = computeBasic(bill);
  if (!basic) return 0;
  return round2((round2(sum(
    (bill?.debits || []).filter((d) => d.status === DEBIT_STATUS.CONFIRMED),
    (d) => d.debitAmount,
  )) / basic) * 100);
};

/** BR-15 — a scanned copy of the supplier invoice must be on file before submit. */
export const hasSupplierInvoice = (bill) =>
  (bill?.attachments || []).some((a) => a.docType === 'SUPPLIER_INVOICE');
