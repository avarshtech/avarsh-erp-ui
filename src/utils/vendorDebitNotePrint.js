/**
 * The Vendor Debit Note (owner D5, 2026-10-07) — what an approved job-work bill takes back from the job worker:
 * rejected or short pieces he billed, a rate above the PO, material damaged in his hands, pieces never returned,
 * penalties. Confirmed deductions only. It wears the Supplier PO print's design (utils/print/poPrintTheme).
 *
 * A commercial document: under GST only the vendor's credit note reduces his output tax, so the note says so.
 */
import { esc, documentShell, openPrintWindow, documentFileName } from './printDoc';
import { amountInWordsIndian } from './amountInWords';
import { formatDate } from './formatters';
import { JW_DEDUCTION_TYPES, billSourceOf, uomShort } from './jobWorkBillConstants';
import {
  PO_PRINT_CSS, companyWatermark, headerBand, infoCards, detailsGrid, itemsSection, totalsBox, summarySection,
  amountInWords, noteStrip, signatures, printFooter,
} from './print/poPrintTheme';

const n = (v, dp = 0) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const inr = (v) => `₹ ${n(v, 2)}`;
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** `bill` is the decorated job-work bill; `demo` stamps DEMO across the page while the screens run on demo data. */
export const printVendorDebitNote = (bill, org = {}, { demo = false } = {}) => {
  const rows = bill.deductions.filter((d) => d.status === 'CONFIRMED');
  const lineOf = (id) => bill.lines.find((l) => l.id === id);
  const against = (d) => {
    const l = lineOf(d.lineId);
    return l ? [l.orderNo, l.color, l.panel, l.size].filter(Boolean).join(' · ') : 'Whole bill';
  };
  const qty = (d) => {
    if (d.qty == null) return '—';
    const uom = JW_DEDUCTION_TYPES[d.type]?.basis === 'PCS' ? 'PIECE' : lineOf(d.lineId)?.uom;
    return `${n(d.qty, uom === 'PIECE' ? 0 : 3)} ${uomShort(uom)}`;
  };
  const head = '<th class="left">#</th><th class="left">Deduction</th><th class="left">Against</th><th class="left">Reason</th>'
    + '<th>Qty</th><th>Rate ₹</th><th>Amount ₹</th><th>GST ₹</th><th>Total ₹</th>';
  const body = rows.map((d, i) => `<tr><td class="left">${i + 1}</td><td class="left">${esc(JW_DEDUCTION_TYPES[d.type]?.label)}</td>
    <td class="left">${esc(against(d))}</td><td class="left">${esc(d.reason)}</td><td class="num">${esc(qty(d))}</td>
    <td class="num">${d.rate == null ? '—' : n(d.rate, 2)}</td><td class="num">${n(d.amount, 2)}</td>
    <td class="num">${n(d.gstAmount, 2)}</td><td class="num total-col">${n(d.amount + d.gstAmount, 2)}</td></tr>`).join('');

  const gst = bill.deductionGst;
  const cgst = r2(gst / 2);
  const tax = bill.igstApplicable
    ? [{ label: `IGST @ ${bill.gstRatePercent}%`, value: inr(gst), kind: 'tax' }]
    : [{ label: `CGST @ ${bill.gstRatePercent / 2}%`, value: inr(cgst), kind: 'tax' },
      { label: `SGST @ ${bill.gstRatePercent / 2}%`, value: inr(r2(gst - cgst)), kind: 'tax' }];
  const totals = totalsBox([
    { label: 'Deductions', value: inr(bill.deductionTotal), kind: 'subtotal' }, ...tax,
    { label: 'Debit note total', value: inr(bill.debitNoteTotal), kind: 'highlight' },
  ]);
  const cancelled = !(bill.debitNoteTotal > 0);
  const kind = billSourceOf(bill.source).label;
  const docNo = `${bill.vdnNumber}${bill.vdnRevision > 1 ? ` (Rev ${bill.vdnRevision})` : ''}`;

  const html = `${companyWatermark(org)}<div class="page-content">
    ${headerBand({ org, docLabel: 'Debit Note · Job Work', docNo, status: cancelled ? 'Cancelled' : (bill.vdnRevision > 1 ? 'Revised' : 'Issued') })}
    ${infoCards([
    { title: 'Debited to (job worker)', name: bill.vendorName, gstin: bill.vendorGstin || '—', details: [bill.vendorCity] },
    { title: 'Against', name: `Invoice ${bill.vendorInvoiceNo || '—'}`, details: [`dated ${formatDate(bill.vendorInvoiceDate)}`, `${kind} ${bill.poNumber} · ${bill.processName}`] },
  ])}
    ${detailsGrid([
    ['Debit note no.', docNo], ['Date', formatDate(bill.vdnDate)], ['Bill passing no.', bill.jwbNumber],
    ['Vendor invoice', bill.vendorInvoiceNo || '—'], ['Invoice date', formatDate(bill.vendorInvoiceDate)],
    ['PO', bill.poNumber], ['Process', bill.processName], ['SAC', bill.sacCode],
    ['Vendor DCs', bill.dcs.map((d) => d.vendorDcNo).join(', ') || '—'],
  ])}
    ${itemsSection({ title: 'Deductions', head, body })}
    ${summarySection({ label: 'Deductions', value: String(rows.length), totals })}
    ${amountInWords(amountInWordsIndian(bill.debitNoteTotal))}
    ${noteStrip('Note', 'Please adjust this amount against your invoice. This is a commercial debit note: the GST shown reverses the GST charged on the amounts deducted, so please issue a matching credit note under GST.')}
    ${signatures([{ role: 'Prepared by' }, { role: 'Authorised signatory' }, { role: 'Vendor acknowledgement' }])}
    ${printFooter(org)}
  </div>`;
  const title = documentFileName({ docType: 'VendorDebitNote', buyer: bill.vendorName, docNo: bill.vdnNumber }).replace(/\.pdf$/, '');
  const watermark = demo ? 'DEMO' : (cancelled ? 'CANCELLED' : undefined);
  return openPrintWindow(documentShell({ title, bodyCss: PO_PRINT_CSS, watermark, body: html }));
};
