/**
 * Bill Passing calculation and reconciliation — pure functions, no I/O.
 *
 * Shared by the mock API (which persists the result) and the workspace screens
 * (which recompute live as the user types, before anything is saved). Keeping
 * it pure means the figures on screen and the figures stored can never drift,
 * and it is the same arithmetic the backend will own after cutover (BR-12:
 * recomputed server-side on every change, client value never trusted).
 */
import {
  DEBIT_STATUS, DEBIT_ORIGIN, EXCEPTION_SEVERITY, ISSUE_STATUS,
  LINE_BILLING_STATUS, DEFAULT_TOLERANCE, ISSUE_TYPES,
  getPercentToleranceStatus, getValueToleranceStatus,
} from './billPassingConstants';

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const round3 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 1000) / 1000;

const sum = (arr, pick) => arr.reduce((s, x) => s + (Number(pick(x)) || 0), 0);

/** Every GRN line on the bill, flattened. */
export const billLines = (bill) => (bill?.grns || []).flatMap((g) => g.lines || []);

/**
 * The same lines, each carrying the GRN it belongs to. Lines are stored nested
 * under their GRN, so anything that needs a grnId (a debit reference, the lines
 * register) must go through here rather than through billLines().
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

// ── Money ──────────────────────────────────────────────────────────────────

/** Basic value = sum of what each line is actually being billed for. */
export const computeBasic = (bill) => round2(sum(billLines(bill), (l) => l.billedValue));

export const computeChargesTotal = (bill) => round2(sum(bill?.charges || [], (c) => c.amount));

/** GST applies to the basic value plus any charge flagged taxable. */
export const computeTaxableValue = (bill) =>
  round2(computeBasic(bill) + sum((bill?.charges || []).filter((c) => c.taxable), (c) => c.amount));

/** The keyed figure is what will be paid, so that is what reaches Net Payable. */
export const computeTaxTotal = (bill) =>
  round2(sum(bill?.taxes || [], (t) => t.asPerInvoiceAmount));

/** Only CONFIRMED debits reduce the payable (BR-11). */
export const computeDebitTotal = (bill) =>
  round2(sum((bill?.debits || []).filter((d) => d.status === DEBIT_STATUS.CONFIRMED), (d) => d.debitAmount));

/**
 * BR-12 — Net Payable = Basic + Charges + Taxes − Confirmed Debits − Adjustments.
 * Returns a NEW bill with every derived total refreshed; never mutates.
 */
export const recalcBill = (bill) => {
  const invoiceBasicAmount = computeBasic(bill);
  const chargesTotal = computeChargesTotal(bill);
  const taxTotal = computeTaxTotal(bill);
  const debitTotal = computeDebitTotal(bill);
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

/** Debit as a share of the invoice — drives the >5% co-approval band. */
export const debitPercentOfInvoice = (bill) => {
  const basic = computeBasic(bill);
  if (!basic) return 0;
  return round2((computeDebitTotal(bill) / basic) * 100);
};

// ── Per-line billing status (BR-23/24) ─────────────────────────────────────

/**
 * How much of a GRN line has been billed across every bill that still counts.
 * Rejected bills release their quantity; the bill being edited is excluded so
 * its own lines are not double-counted against itself.
 */
export const cumulativeBilledQty = (allBills, grnLineItemId, excludeBillId = null) =>
  round3((allBills || [])
    .filter((b) => b.status !== 'REJECTED' && b.id !== excludeBillId)
    .flatMap((b) => billLines(b))
    .filter((l) => l.grnLineItemId === grnLineItemId)
    .reduce((s, l) => s + (Number(l.billedQty) || 0), 0));

export const coveringBillNumbers = (allBills, grnLineItemId, excludeBillId = null) =>
  (allBills || [])
    .filter((b) => b.status !== 'REJECTED' && b.id !== excludeBillId)
    .filter((b) => billLines(b).some((l) => l.grnLineItemId === grnLineItemId && Number(l.billedQty) > 0))
    .map((b) => b.bpNumber);

export const lineBillingStatus = (billedSoFar, billableQty) => {
  if (!billedSoFar) return LINE_BILLING_STATUS.UNBILLED;
  if (round3(billedSoFar) >= round3(billableQty)) return LINE_BILLING_STATUS.FULLY_BILLED;
  return LINE_BILLING_STATUS.PARTIALLY_BILLED;
};

// ── Four-way reconciliation (FR-BP-601/602) ────────────────────────────────

/**
 * The PRD section 13 comparison: one row per measure, one column per source,
 * with the variance flagged against the configured tolerance. Reads far better
 * than five separate "A vs B" rows and is what the client already checks.
 */
export const buildReconciliation = (bill, tolerance = DEFAULT_TOLERANCE) => {
  const lines = billLines(bill);

  // Several GRN lines can be receipts against ONE PO line — three challans of
  // the same fabric, say. Summing poQty across them would report the ordered
  // quantity once per delivery, so the PO side is deduped by po_line_item_id.
  const poLineOnce = new Map();
  lines.forEach((l) => {
    if (l.poLineItemId != null && !poLineOnce.has(l.poLineItemId)) poLineOnce.set(l.poLineItemId, l);
  });
  const distinctPoLines = [...poLineOnce.values()];

  const poQty = round3(sum(distinctPoLines, (l) => l.poQty));
  const receivedQty = round3(sum(lines, (l) => l.receivedQty));
  const acceptedQty = round3(sum(lines, (l) => l.acceptedQty));
  const rejectedQty = round3(sum(lines, (l) => l.rejectedQty));
  const invoiceQty = round3(sum(lines, (l) => l.billedQty));

  const poValue = round2(sum(distinctPoLines, (l) => (Number(l.poQty) || 0) * (Number(l.rate) || 0)));
  const grnValue = round2(sum(lines, (l) => l.grnValue));
  const acceptedValue = round2(sum(lines, (l) => (Number(l.acceptedQty) || 0) * (Number(l.rate) || 0)));
  const rejectedValue = round2(sum(lines, (l) => (Number(l.rejectedQty) || 0) * (Number(l.rate) || 0)));
  const invoiceValue = computeBasic(bill);

  const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

  // Quantity: the invoice is measured against what QC accepted (BR-08).
  const qtyVariance = round3(invoiceQty - acceptedQty);
  const qtyStatus = getPercentToleranceStatus(pct(invoiceQty, acceptedQty), tolerance.qtyPercent);

  // Value: same basis, in money.
  const valueVariance = round2(invoiceValue - acceptedValue);
  const valueStatus = getValueToleranceStatus(valueVariance, tolerance.valueAmount);

  // Rate: any difference at all is a commercial exception (default limit 0%).
  const poRate = poQty ? round2(poValue / poQty) : 0;
  const invoiceRate = invoiceQty ? round2(invoiceValue / invoiceQty) : 0;
  const rateVariance = round2(invoiceRate - poRate);
  const rateStatus = getPercentToleranceStatus(pct(invoiceRate, poRate), tolerance.ratePercent);

  const debitTotal = computeDebitTotal(bill);
  // The rejected quantity is only "covered" if debits actually recover it.
  const rejectionCovered = round2(debitTotal) >= round2(round3(invoiceQty - acceptedQty) * poRate);

  return {
    matrix: [
      {
        key: 'quantity',
        label: 'Quantity',
        po: poQty, grn: receivedQty, qcAccepted: acceptedQty, qcRejected: rejectedQty, invoice: invoiceQty,
        variance: qtyVariance,
        variancePercent: round2(pct(invoiceQty, acceptedQty)),
        status: qtyVariance > 0 && rejectionCovered ? { ...qtyStatus, label: 'Covered by debits' } : qtyStatus,
        note: qtyVariance > 0
          ? `Invoice ${round3(qtyVariance)} above QC accepted${rejectionCovered ? ' — covered by rejection debits' : ' — needs a debit, query or exception'}`
          : '',
      },
      {
        key: 'value',
        label: 'Basic value',
        po: poValue, grn: grnValue, qcAccepted: acceptedValue, qcRejected: rejectedValue, invoice: invoiceValue,
        variance: valueVariance,
        variancePercent: round2(pct(invoiceValue, acceptedValue)),
        status: valueVariance > 0 && rejectionCovered ? { ...valueStatus, label: 'Covered by debits' } : valueStatus,
        note: valueVariance > 0 && rejectionCovered ? `Difference recovered as ${round2(debitTotal)} of debits` : '',
      },
      {
        key: 'rate',
        label: 'Rate',
        po: poRate, grn: poRate, qcAccepted: null, qcRejected: null, invoice: invoiceRate,
        variance: rateVariance,
        variancePercent: round2(pct(invoiceRate, poRate)),
        status: rateStatus,
        note: rateVariance > 0 ? 'Invoice rate above PO rate — raise a Rate Difference debit' : '',
      },
    ],
    valueSummary: {
      poValue, grnValue, invoiceValue,
      debitTotal,
      netPayable: round2(bill?.netPayable),
    },
    rejectionCovered,
  };
};

// ── Exceptions (PRD section 8) ─────────────────────────────────────────────

const blockingIssueCodes = new Set(ISSUE_TYPES.filter((t) => t.blocking).map((t) => t.code));

/**
 * Everything standing between this bill and approval. `severity` decides
 * whether the UI warns, blocks, or offers an authorised override.
 */
export const buildExceptions = (bill, tolerance = DEFAULT_TOLERANCE, opts = {}) => {
  const out = [];
  const lines = billLines(bill);
  const recon = buildReconciliation(bill, tolerance);

  const qtyRow = recon.matrix.find((m) => m.key === 'quantity');
  if (qtyRow.variance > 0 && !recon.rejectionCovered) {
    out.push({
      code: 'INVOICE_QTY_ABOVE_ACCEPTED',
      severity: EXCEPTION_SEVERITY.BLOCK,
      title: 'Invoice quantity exceeds QC accepted quantity',
      detail: `${round3(qtyRow.variance)} billed above accepted and not covered by a debit. Add a shortage or rejection debit, raise a supplier query, or record an Approver exception.`,
    });
  }

  const rateRow = recon.matrix.find((m) => m.key === 'rate');
  if (rateRow.variance > 0) {
    out.push({
      code: 'INVOICE_RATE_ABOVE_PO',
      severity: EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE,
      title: 'Invoice rate is above the PO rate',
      detail: `Invoice ${rateRow.invoice} against PO ${rateRow.po}. Confirm the proposed Rate Difference debit, or have an Approver accept the revised rate with a reason.`,
    });
  } else if (rateRow.variance < 0) {
    out.push({
      code: 'INVOICE_RATE_BELOW_PO',
      severity: EXCEPTION_SEVERITY.WARN,
      title: 'Invoice rate is below the PO rate',
      detail: 'Possible negotiated discount — confirm before passing.',
    });
  }

  // QC still open on a covered line (BR-06).
  const qcPending = lines.filter((l) => l.qcStatus && l.qcStatus !== 'Approved');
  if (qcPending.length) {
    out.push({
      code: 'QC_PENDING',
      severity: EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE,
      title: `QC pending on ${qcPending.length} line${qcPending.length > 1 ? 's' : ''}`,
      detail: `${qcPending.map((l) => l.itemCode).join(', ')} — the bill can be drafted but cannot pass verification until QC completes, unless an authorised override is recorded.`,
    });
  }

  // Quantity QC could not put a number to (trims criteria pass/fail).
  const unquantified = lines.filter((l) => l.qtyUnquantified);
  if (unquantified.length) {
    out.push({
      code: 'QTY_NOT_QUANTIFIED',
      severity: EXCEPTION_SEVERITY.WARN,
      title: 'Accepted quantity not quantified by QC',
      detail: `${unquantified.map((l) => l.itemCode).join(', ')} — QC recorded a criteria result without a per-unit split, so the payable quantity must be confirmed manually.`,
    });
  }

  // Tax keyed vs tax computed (BR-13).
  const taxVariance = round2(sum(recalcTaxes(bill), (t) => Math.abs(t.variance)));
  if (taxVariance > tolerance.taxVarianceAmount) {
    out.push({
      code: 'TAX_MISMATCH',
      severity: EXCEPTION_SEVERITY.WARN,
      title: 'Tax on the invoice differs from the computed tax',
      detail: `Variance of ${taxVariance}. Correct the tax lines or acknowledge with a reason — note the input-tax-credit impact.`,
    });
  }

  // Open blocking issues (FR-BP-803).
  const openBlocking = (bill?.issues || []).filter(
    (i) => i.status === ISSUE_STATUS.OPEN && blockingIssueCodes.has(i.issueTypeCode),
  );
  openBlocking.forEach((i) => {
    out.push({
      code: `ISSUE_${i.issueTypeCode}`,
      severity: EXCEPTION_SEVERITY.BLOCK,
      title: `Open blocking issue: ${i.issueTypeCode.replace(/_/g, ' ').toLowerCase()}`,
      detail: i.description,
    });
  });

  // Debits still awaiting the verifier.
  const proposed = (bill?.debits || []).filter((d) => d.status === DEBIT_STATUS.PROPOSED);
  if (proposed.length) {
    out.push({
      code: 'DEBITS_UNCONFIRMED',
      severity: EXCEPTION_SEVERITY.BLOCK,
      title: `${proposed.length} debit line${proposed.length > 1 ? 's' : ''} not yet confirmed`,
      detail: 'Proposed debits do not reduce Net Payable until the verifier confirms or drops them.',
    });
  }

  // Missing invoice attachment before submit (BR-15).
  if (opts.requireAttachment && !(bill?.attachments || []).some((a) => a.docType === 'SUPPLIER_INVOICE')) {
    out.push({
      code: 'MISSING_INVOICE_ATTACHMENT',
      severity: EXCEPTION_SEVERITY.BLOCK,
      title: 'Supplier invoice not attached',
      detail: 'A scanned copy of the supplier invoice is mandatory before the bill can be submitted.',
    });
  }

  return out;
};

/** Anything that hard-stops approval; overrides are surfaced separately. */
export const blockingExceptions = (exceptions) =>
  exceptions.filter((e) => e.severity === EXCEPTION_SEVERITY.BLOCK);

export const overridableExceptions = (exceptions) =>
  exceptions.filter((e) => e.severity === EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE);

// ── System-proposed debits (FR-BP-403 / 502) ───────────────────────────────

/**
 * What the system would recover, given what QC rejected and what Return to
 * Supplier already recovered. Quantity already covered by a debit note is
 * excluded, so the same rejection is never debited twice.
 */
export const proposeDebits = (bill, linkedDebitNotes = []) => {
  const proposals = [];
  const existing = bill?.debits || [];

  billLines(bill).forEach((l) => {
    if (!l.rejectedQty) return;

    const alreadyLinked = linkedDebitNotes
      .filter((n) => n.grnLineItemId === l.grnLineItemId)
      .reduce((s, n) => s + (Number(n.qty) || 0), 0);

    const alreadyOnBill = existing
      .filter((d) => d.grnLineItemId === l.grnLineItemId && d.origin !== DEBIT_ORIGIN.LINKED_DEBIT_NOTE)
      .reduce((s, d) => s + (Number(d.debitQty) || 0), 0);

    const outstanding = round3(l.rejectedQty - alreadyLinked - alreadyOnBill);
    if (outstanding <= 0) return;

    proposals.push({
      debitTypeCode: 'MATERIAL_REJECTION',
      grnLineItemId: l.grnLineItemId,
      qcId: l.qcId,
      debitQty: outstanding,
      rate: l.rate,
      debitAmount: round2(outstanding * l.rate),
      reasonCode: 'QC_REJECTION',
      reasonText: `QC rejected ${outstanding} ${l.uom || ''} on ${l.itemCode}`.trim(),
      origin: DEBIT_ORIGIN.SYSTEM_PROPOSED,
      status: DEBIT_STATUS.PROPOSED,
    });
  });

  // Rate difference — only when the supplier billed above the PO rate.
  billLines(bill).forEach((l) => {
    const diff = round2((Number(l.invoiceRate) || 0) - (Number(l.rate) || 0));
    if (diff <= 0 || !l.billedQty) return;
    const already = existing.some(
      (d) => d.debitTypeCode === 'RATE_DIFFERENCE' && d.grnLineItemId === l.grnLineItemId,
    );
    if (already) return;
    proposals.push({
      debitTypeCode: 'RATE_DIFFERENCE',
      grnLineItemId: l.grnLineItemId,
      qcId: null,
      debitQty: l.billedQty,
      rate: diff,
      debitAmount: round2(l.billedQty * diff),
      reasonCode: 'RATE_MISMATCH',
      reasonText: `Invoice rate ${l.invoiceRate} above PO rate ${l.rate}`,
      origin: DEBIT_ORIGIN.SYSTEM_PROPOSED,
      status: DEBIT_STATUS.PROPOSED,
    });
  });

  return proposals;
};
