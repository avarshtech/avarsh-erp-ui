import dayjs from 'dayjs';
import { amountInWords } from './amountInWords';
import { billLinesWithGrn } from './billPassingCalc';
import {
  BILL_PASSING_STATUS_LABEL,
  CHARGE_TYPES,
  DEBIT_STATUS,
  DEBIT_TYPES,
  DEBIT_ORIGIN_LABEL,
} from './billPassingConstants';

/**
 * Bill Passing Voucher print (AC-12).
 *
 * This is the sheet Accounts keys into Tally, so it is deliberately exhaustive
 * where Tally needs it — supplier GSTIN, the supplier invoice reference, the
 * PO, EVERY challan covered by the bill, the taxable value, the GST break-up
 * line by line, the debit break-up with its reason, and the Net Payable in
 * figures and in words. Same mechanism as the other document generators in
 * this folder: one self-contained HTML document written into a fresh
 * same-origin window, printed, then closed. No external CSS, fonts or images.
 */

// ─── Escaping + formatting ───────────────────────────────────────────────────
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const money = (v) => `₹ ${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const rate = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-');
const num = (v) => Number(v) || 0;

const DEBIT_NAME = (code) => DEBIT_TYPES.find((t) => t.code === code)?.name || code || '-';
const CHARGE_NAME = (code) => CHARGE_TYPES.find((t) => t.code === code)?.name || code || '-';

const TD = 'border:1px solid #333;padding:3px 5px;font-size:10px;vertical-align:top;';
const TH = 'border:1px solid #333;padding:4px 5px;font-size:9.5px;font-weight:700;background:#ececec;text-align:center;';

/** Bordered label/value cell for the header grid. */
const fld = (label, value, opts = {}) => `
  <td colspan="${opts.colspan || 1}" style="${TD}${opts.style || ''}">
    <div style="font-size:8px;color:#555;font-style:italic;text-transform:uppercase;letter-spacing:.4px;">${esc(label)}</div>
    <div style="font-size:${opts.big ? 11.5 : 10.5}px;font-weight:${opts.bold ? 700 : 400};white-space:pre-wrap;">${esc(value) || '-'}</div>
  </td>`;

/** Every challan the bill covers — the typed header list plus each GRN's own. */
const challanNumbers = (bill) => {
  const seen = new Set();
  String(bill?.challanNumbers || '').split(/[,;/|]+/).forEach((c) => {
    const t = c.trim();
    if (t) seen.add(t);
  });
  (bill?.grns || []).forEach((g) => {
    const t = String(g?.challanNo || '').trim();
    if (t) seen.add(t);
  });
  return [...seen];
};

/** "45 Days Credit" + an invoice date implies a due date; anything else does not. */
const paymentDue = (bill) => {
  const terms = bill?.paymentTerms || bill?.supplierPaymentTerms || '';
  const days = String(terms).match(/(\d+)\s*day/i);
  if (!days || !bill?.invoiceDate) return { terms, due: null };
  return { terms, due: dayjs(bill.invoiceDate).add(Number(days[1]), 'day') };
};

// ─── Blocks ──────────────────────────────────────────────────────────────────
const lineRows = (bill) => billLinesWithGrn(bill).map((l, i) => `
  <tr>
    <td style="${TD}text-align:center;">${i + 1}</td>
    <td style="${TD}text-align:center;">${esc(l.grnNumber)}<div style="font-size:8px;color:#555;">${esc(day(l.grnDate))}</div></td>
    <td style="${TD}text-align:center;">${esc(l.itemCode)}</td>
    <td style="${TD}">${esc(l.description)}${l.color || l.size ? `<div style="font-size:8px;color:#555;">${esc([l.color, l.size].filter(Boolean).join(' / '))}</div>` : ''}</td>
    <td style="${TD}text-align:center;">${esc(l.uom)}</td>
    <td style="${TD}text-align:right;">${qty(l.billedQty)}</td>
    <td style="${TD}text-align:right;">${rate(l.invoiceRate ?? l.rate)}</td>
    <td style="${TD}text-align:right;">${money(l.billedValue)}</td>
  </tr>`).join('');

const chargeRows = (bill) => (bill?.charges || []).map((c) => `
  <tr>
    <td style="${TD}" colspan="2">${esc(CHARGE_NAME(c.chargeTypeCode))}${c.remarks ? ` &mdash; ${esc(c.remarks)}` : ''}</td>
    <td style="${TD}text-align:center;">${c.taxable ? 'Taxable' : 'Non-taxable'}</td>
    <td style="${TD}text-align:right;">${money(c.amount)}</td>
  </tr>`).join('');

const taxRows = (bill) => (bill?.taxes || []).map((t) => `
  <tr>
    <td style="${TD}text-align:center;">${esc(t.taxType)}</td>
    <td style="${TD}text-align:center;">${rate(t.ratePercent)} %</td>
    <td style="${TD}text-align:right;">${money(t.taxableValue)}</td>
    <td style="${TD}text-align:right;">${money(t.computedAmount)}</td>
    <td style="${TD}text-align:right;font-weight:700;">${money(t.asPerInvoiceAmount)}</td>
    <td style="${TD}text-align:right;color:${num(t.variance) ? '#a8071a' : '#333'};">${money(t.variance)}</td>
  </tr>`).join('');

const debitRows = (bill) => (bill?.debits || []).map((d, i) => `
  <tr>
    <td style="${TD}text-align:center;">${i + 1}</td>
    <td style="${TD}">${esc(DEBIT_NAME(d.debitTypeCode))}<div style="font-size:8px;color:#555;">${esc(DEBIT_ORIGIN_LABEL[d.origin] || d.origin)}${d.debitNoteNumber ? ` &middot; ${esc(d.debitNoteNumber)}` : ''}</div></td>
    <td style="${TD}">${esc([d.reasonCode, d.reasonText, d.remarks].filter(Boolean).join(' - ')) || '-'}</td>
    <td style="${TD}text-align:right;">${qty(d.debitQty)}</td>
    <td style="${TD}text-align:right;">${rate(d.rate)}</td>
    <td style="${TD}text-align:center;">${esc(d.gstTreatment === 'WITH_GST' ? 'With GST' : 'Without GST')}</td>
    <td style="${TD}text-align:center;">${esc(d.status)}</td>
    <td style="${TD}text-align:right;font-weight:${d.status === DEBIT_STATUS.CONFIRMED ? 700 : 400};color:${d.status === DEBIT_STATUS.CONFIRMED ? '#a8071a' : '#888'};">${money(d.debitAmount)}</td>
  </tr>`).join('');

const summaryRow = (label, value, opts = {}) => `
  <tr>
    <td style="${TD}${opts.strong ? 'font-weight:700;' : ''}${opts.pad ? 'padding-left:14px;' : ''}">${esc(label)}</td>
    <td style="${TD}text-align:right;font-weight:${opts.strong ? 700 : 400};${opts.color ? `color:${opts.color};` : ''}${opts.big ? 'font-size:12.5px;' : ''}">${opts.negative && num(value) ? `(-) ${money(value)}` : money(value)}</td>
  </tr>`;

// ─── Document ────────────────────────────────────────────────────────────────
export const buildBillPassingVoucherHtml = (bill) => {
  const b = bill || {};
  const challans = challanNumbers(b);
  const { terms, due } = paymentDue(b);
  const lines = billLinesWithGrn(b);
  const totalQty = lines.reduce((s, l) => s + num(l.billedQty), 0);
  const taxable = num(b.invoiceBasicAmount) + (b.charges || []).filter((c) => c.taxable).reduce((s, c) => s + num(c.amount), 0);
  const net = num(b.netPayable);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(b.bpNumber || 'Bill Passing Voucher')}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #111; font-size: 10px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  h2 { margin: 0; font-size: 14px; letter-spacing: 3px; }
  .sec { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 4px; }
  @media print { body { margin: 8mm; } }
</style>
</head>
<body>
  <div style="text-align:center;border:1px solid #333;border-bottom:none;padding:7px;">
    <h2>BILL PASSING VOUCHER</h2>
    <div style="font-size:9px;color:#555;">Accounts posting reference &middot; Status: ${esc(BILL_PASSING_STATUS_LABEL[b.status] || b.status)}</div>
  </div>

  <table>
    <tr>
      ${fld('Supplier', b.supplierName, { colspan: 2, bold: true, big: true })}
      ${fld('Bill Passing No.', b.bpNumber, { bold: true, big: true })}
      ${fld('Financial Year', b.financialYear)}
    </tr>
    <tr>
      ${fld('Supplier GSTIN', b.supplierGstin || b.gstin, { colspan: 2, bold: true })}
      ${fld('Supplier Invoice No.', b.supplierInvoiceNo, { bold: true })}
      ${fld('Invoice Date', day(b.invoiceDate), { bold: true })}
    </tr>
    <tr>
      ${fld('Purchase Order', b.poNumber, { bold: true })}
      ${fld('Payment Terms', terms)}
      ${fld('Due Date', due ? due.format('DD-MMM-YYYY') : 'As per agreed terms', { bold: !!due })}
      ${fld('Tally Reference', b.tallyReferenceNo)}
    </tr>
    <tr>
      ${fld(`Challan Numbers (${challans.length})`, challans.length ? challans.join(', ') : '-', { colspan: 3 })}
      ${fld('GRNs Covered', (b.grns || []).map((g) => g.grnNumber).join(', '))}
    </tr>
    ${b.headerRemarks ? `<tr>${fld('Remarks', b.headerRemarks, { colspan: 4 })}</tr>` : ''}
  </table>

  <div class="sec">Billed Lines</div>
  <table>
    <tr>
      <th style="${TH}width:26px;">#</th>
      <th style="${TH}width:92px;">GRN</th>
      <th style="${TH}width:90px;">Item Code</th>
      <th style="${TH}">Description</th>
      <th style="${TH}width:48px;">UOM</th>
      <th style="${TH}width:78px;">Billed Qty</th>
      <th style="${TH}width:70px;">Rate</th>
      <th style="${TH}width:92px;">Value</th>
    </tr>
    ${lines.length ? lineRows(b) : `<tr><td style="${TD}text-align:center;" colspan="8">No GRN lines attached to this bill.</td></tr>`}
    <tr>
      <td style="${TD}text-align:right;font-weight:700;" colspan="5">Total</td>
      <td style="${TD}text-align:right;font-weight:700;">${qty(totalQty)}</td>
      <td style="${TD}"></td>
      <td style="${TD}text-align:right;font-weight:700;">${money(b.invoiceBasicAmount)}</td>
    </tr>
  </table>

  ${(b.charges || []).length ? `
  <div class="sec">Charges</div>
  <table>
    <tr>
      <th style="${TH}" colspan="2">Charge</th>
      <th style="${TH}width:100px;">GST Applicability</th>
      <th style="${TH}width:110px;">Amount</th>
    </tr>
    ${chargeRows(b)}
    <tr>
      <td style="${TD}text-align:right;font-weight:700;" colspan="3">Charges Total</td>
      <td style="${TD}text-align:right;font-weight:700;">${money(b.chargesTotal)}</td>
    </tr>
  </table>` : ''}

  <div class="sec">GST Break-up &middot; Taxable Value ${money(taxable)}</div>
  <table>
    <tr>
      <th style="${TH}width:70px;">Tax</th>
      <th style="${TH}width:60px;">Rate</th>
      <th style="${TH}">Taxable Value</th>
      <th style="${TH}">Computed</th>
      <th style="${TH}">As per Invoice</th>
      <th style="${TH}width:90px;">Variance</th>
    </tr>
    ${(b.taxes || []).length ? taxRows(b) : `<tr><td style="${TD}text-align:center;" colspan="6">No tax lines on this invoice.</td></tr>`}
    <tr>
      <td style="${TD}text-align:right;font-weight:700;" colspan="4">Total Tax</td>
      <td style="${TD}text-align:right;font-weight:700;">${money(b.taxTotal)}</td>
      <td style="${TD}"></td>
    </tr>
  </table>

  <div class="sec">Debit Break-up</div>
  <table>
    <tr>
      <th style="${TH}width:26px;">#</th>
      <th style="${TH}width:140px;">Debit Type</th>
      <th style="${TH}">Reason</th>
      <th style="${TH}width:78px;">Qty</th>
      <th style="${TH}width:70px;">Rate</th>
      <th style="${TH}width:88px;">GST</th>
      <th style="${TH}width:80px;">Status</th>
      <th style="${TH}width:92px;">Amount</th>
    </tr>
    ${(b.debits || []).length ? debitRows(b) : `<tr><td style="${TD}text-align:center;" colspan="8">No debits raised against this bill.</td></tr>`}
    <tr>
      <td style="${TD}text-align:right;font-weight:700;" colspan="7">Confirmed Debits (deducted from payable)</td>
      <td style="${TD}text-align:right;font-weight:700;color:#a8071a;">${money(b.debitTotal)}</td>
    </tr>
  </table>

  <table style="width:60%;margin-left:auto;">
    ${summaryRow('Basic Value', b.invoiceBasicAmount)}
    ${summaryRow('Add: Charges', b.chargesTotal)}
    ${summaryRow('Taxable Value', taxable, { strong: true })}
    ${summaryRow('Add: GST / Taxes', b.taxTotal)}
    ${summaryRow('Less: Confirmed Debits', b.debitTotal, { negative: true, color: '#a8071a' })}
    ${summaryRow('Less: Adjustments', b.adjustmentTotal, { negative: true, color: '#a8071a' })}
    ${summaryRow('NET PAYABLE', net, { strong: true, big: true })}
  </table>

  <table>
    <tr>
      <td style="${TD}font-weight:700;font-size:10.5px;">
        NET PAYABLE (IN WORDS): ${esc(amountInWords(net, 'INR'))}
      </td>
    </tr>
  </table>

  <table>
    <tr>
      <td style="${TD}width:33%;height:56px;">Prepared / Verified by<div style="font-size:8px;color:#555;">Bill passed on ${esc(day(b.approvedAt || b.submittedAt))}</div></td>
      <td style="${TD}width:33%;">Approved by<div style="font-size:8px;color:#555;">${esc(BILL_PASSING_STATUS_LABEL[b.status] || b.status)}</div></td>
      <td style="${TD}">Accounts / Tally Posting<div style="font-size:8px;color:#555;">Ref: ${esc(b.tallyReferenceNo || 'to be keyed')}</div></td>
    </tr>
  </table>
  <div style="font-size:8px;color:#555;text-align:center;">
    System-generated voucher &middot; ${esc(b.bpNumber)} &middot; printed ${esc(dayjs().format('DD-MMM-YYYY HH:mm'))}
  </div>
</body>
</html>`;
};

export const printBillPassingVoucher = (bill) => {
  // Every interpolated value goes through esc(), so nothing user-entered can
  // execute in the print window.
  const html = buildBillPassingVoucherHtml(bill);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
  return true;
};

export default { buildBillPassingVoucherHtml, printBillPassingVoucher };
