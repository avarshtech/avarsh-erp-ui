import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { getSupplierById } from '../services/master/supplierService';

/**
 * Return to Supplier (Return DC) print generator (CRD_INV_004).
 *
 * Opens a print-ready HTML document in a new window and triggers the browser
 * print dialog. Mirrors the pattern used by grnPdfGenerator / poPdfGenerator
 * — single self-contained HTML doc with inline CSS, no extra deps.
 *
 *   import { generateReturnDcPdf } from '../utils/returnToSupplierPdfGenerator';
 *   await generateReturnDcPdf(returnData);
 */

// ─── Format helpers ──────────────────────────────────────────────────────────
const formatCurrency = (val) => {
  const n = parseFloat(val) || 0;
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const formatQty = (val) => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};
const formatDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
const formatDateTime = (d) => (d ? dayjs(d).format('DD-MMM-YYYY HH:mm') : '—');
const escapeHtml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// ─── Number to Indian Rupee Words (reused pattern) ───────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const numberToWordsBelow1000 = (n) => {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberToWordsBelow1000(n % 100) : '');
};

const numberToIndianWords = (num) => {
  if (!num || num === 0) return 'Indian Rupee Zero only';
  const absNum = Math.abs(num);
  const rupees = Math.floor(absNum);
  const paise = Math.round((absNum - rupees) * 100);
  let result;
  if (rupees === 0) {
    result = 'Zero';
  } else {
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const remainder = rupees % 1000;
    const parts = [];
    if (crore > 0) parts.push(numberToWordsBelow1000(crore) + ' Crore');
    if (lakh > 0) parts.push(numberToWordsBelow1000(lakh) + ' Lakh');
    if (thousand > 0) parts.push(numberToWordsBelow1000(thousand) + ' Thousand');
    if (remainder > 0) parts.push(numberToWordsBelow1000(remainder));
    result = parts.join(' ');
  }
  let text = 'Indian Rupee ' + result;
  if (paise > 0) text += ' And Paise ' + numberToWordsBelow1000(paise);
  text += ' only';
  return text;
};

// ─── HTML builder ────────────────────────────────────────────────────────────
const buildHtml = (rtn, org, supplier) => {
  const isFabric = rtn.returnType === 'FABRIC';
  const typeBadge = isFabric ? 'FABRIC' : 'ACCESSORIES';
  const companyName = org?.organisationName || 'Company Name';
  const companyAddr = [org?.addressLine1, org?.addressLine2, org?.city, org?.state, org?.pincode]
    .filter(Boolean).join(', ');
  const orgGstin = org?.gstin || '';

  const supplierName = supplier?.name || rtn.supplierName || '';
  const supplierAddr = supplier
    ? [supplier.addressLine1, supplier.addressLine2, supplier.city, supplier.state, supplier.pincode]
        .filter(Boolean).join(', ')
    : '';
  const supplierGstin = supplier?.gstin || '';

  const items = rtn.items || [];
  const subtotal = Number(rtn.subtotal || 0);
  const taxTotal = Number(rtn.taxTotal || 0);
  const grandTotal = Number(rtn.grandTotal || 0);
  const totalQty = items.reduce((s, i) => s + Number(i.rejectedQty || 0), 0);

  const lineRows = items.map((it, idx) => {
    const qty = Number(it.rejectedQty || 0);
    const rate = Number(it.unitPrice || 0);
    const taxable = Number(it.lineValue || qty * rate);
    const tax = Number(it.taxValue || 0);
    const total = Number(it.totalAmount || taxable + tax);
    const descParts = [];
    if (it.description) descParts.push(`<strong>${escapeHtml(it.description)}</strong>`);
    if (it.itemCode) descParts.push(`<span class="attr">Code: ${escapeHtml(it.itemCode)}</span>`);
    if (it.rollNumber) descParts.push(`<span class="attr">Roll: ${escapeHtml(it.rollNumber)}</span>`);
    if (it.size) descParts.push(`<span class="attr">Size: ${escapeHtml(it.size)}</span>`);
    if (it.color) descParts.push(`<span class="attr">Color: ${escapeHtml(it.color)}</span>`);
    if (it.qcNumber) descParts.push(`<span class="attr">QC: ${escapeHtml(it.qcNumber)}</span>`);
    if (it.grnNumber) descParts.push(`<span class="attr">GRN: ${escapeHtml(it.grnNumber)}</span>`);
    if (it.rejectionReason) descParts.push(`<span class="reason">Reason: ${escapeHtml(it.rejectionReason)}</span>`);

    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>${descParts.join('<br/>')}</td>
        <td class="num">${formatQty(qty)}${it.uom ? ' ' + escapeHtml(it.uom) : ''}</td>
        <td class="num">${formatCurrency(rate)}</td>
        <td class="num">${formatCurrency(taxable)}</td>
        <td class="num">${formatCurrency(tax)}</td>
        <td class="num">${formatCurrency(total)}</td>
      </tr>`;
  }).join('');

  const amountInWords = numberToIndianWords(grandTotal);
  const debit = rtn.debitNote;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(rtn.returnNumber || 'Return DC')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 0; padding: 0; background: #fff; }
  .page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; }
  .company-name { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .company-addr { font-size: 11px; color: #4b5563; max-width: 380px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
  .badge { display: inline-block; background: #1e40af; color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px; }
  .doc-meta { font-size: 11px; color: #4b5563; margin-top: 6px; }

  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .meta-card { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; }
  .meta-card h3 { margin: 0 0 6px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-card .name { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  .row { display: flex; font-size: 11px; margin-top: 2px; }
  .row .label { width: 70px; color: #6b7280; }
  .row .value { flex: 1; color: #1f2937; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  table.items th { background: #1f2937; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.items th.num { text-align: right; }
  table.items td { padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .attr { display: inline-block; color: #6b7280; font-size: 10px; margin-right: 8px; }
  .reason { display: inline-block; color: #b91c1c; font-size: 10px; margin-top: 2px; font-style: italic; }

  .totals { display: flex; justify-content: space-between; margin-top: 16px; gap: 16px; }
  .words-box { flex: 1; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; }
  .words-box .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .words { font-weight: 600; font-size: 12px; margin-top: 4px; }
  table.totals-table { width: 280px; border-collapse: collapse; font-size: 11px; }
  table.totals-table td { padding: 4px 8px; }
  table.totals-table td.label { color: #6b7280; }
  table.totals-table td.value { text-align: right; font-variant-numeric: tabular-nums; }
  table.totals-table tr.grand td { border-top: 2px solid #1f2937; font-weight: 700; font-size: 13px; padding-top: 6px; }

  .grand-total { margin-top: 12px; padding: 10px 14px; background: #1e40af; color: #fff; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
  .gt-label { font-size: 11px; opacity: 0.85; }
  .gt-qty { font-size: 14px; font-weight: 600; }
  .gt-value { font-size: 18px; font-weight: 700; }

  .debit-note-card { margin-top: 16px; border: 1px dashed #1e40af; border-radius: 6px; padding: 10px 12px; background: #eff6ff; }
  .debit-note-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .debit-note-card .dn-number { font-size: 14px; font-weight: 700; color: #1e40af; margin-top: 2px; }

  .signatures { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 12px; }
  .sig-block { text-align: center; flex: 1; }
  .sig-title { border-top: 1px solid #1f2937; padding-top: 4px; margin-top: 36px; font-size: 11px; font-weight: 600; }
  .sig-sub { font-size: 10px; color: #6b7280; }

  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 12px 16px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <div>
        <div class="company-name">${escapeHtml(companyName)}</div>
        <div class="company-addr">${escapeHtml(companyAddr)}</div>
        ${orgGstin ? `<div class="company-addr">GSTIN: ${escapeHtml(orgGstin)}</div>` : ''}
      </div>
      <div class="doc-title">
        <h1>RETURN DC</h1>
        <span class="badge">${typeBadge}</span>
        <div class="doc-meta">
          <div><strong>${escapeHtml(rtn.returnNumber || '')}</strong></div>
          <div>Date: ${formatDate(rtn.returnDate)}</div>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <h3>Returned To (Supplier)</h3>
        <div class="name">${escapeHtml(supplierName)}</div>
        ${supplierAddr ? `<div class="row"><div class="label">Address</div><div class="value">${escapeHtml(supplierAddr)}</div></div>` : ''}
        ${supplierGstin ? `<div class="row"><div class="label">GSTIN</div><div class="value">${escapeHtml(supplierGstin)}</div></div>` : ''}
      </div>
      <div class="meta-card">
        <h3>Reference</h3>
        <div class="row"><div class="label">PO Number</div><div class="value">${escapeHtml(rtn.poNumber || '')}</div></div>
        <div class="row"><div class="label">PO Date</div><div class="value">${formatDate(rtn.poDate)}</div></div>
        ${rtn.grnRef ? `<div class="row"><div class="label">GRN Ref</div><div class="value">${escapeHtml(rtn.grnRef)}</div></div>` : ''}
        ${rtn.preparedByName ? `<div class="row"><div class="label">Prepared By</div><div class="value">${escapeHtml(rtn.preparedByName)}</div></div>` : ''}
        ${rtn.remarks ? `<div class="row"><div class="label">Remarks</div><div class="value">${escapeHtml(rtn.remarks)}</div></div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Description</th>
          <th class="num" style="width:110px">Qty</th>
          <th class="num" style="width:90px">Rate</th>
          <th class="num" style="width:100px">Taxable</th>
          <th class="num" style="width:90px">Tax</th>
          <th class="num" style="width:105px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No items</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <div class="words-box">
        <div class="label">Amount in Words</div>
        <div class="words">${escapeHtml(amountInWords)}</div>
      </div>
      <table class="totals-table">
        <tr><td class="label">Subtotal</td><td class="value">${formatCurrency(subtotal)}</td></tr>
        <tr><td class="label">Tax</td><td class="value">${formatCurrency(taxTotal)}</td></tr>
        <tr class="grand"><td class="label">Grand Total</td><td class="value">${formatCurrency(grandTotal)}</td></tr>
      </table>
    </div>

    <div class="grand-total">
      <div>
        <div class="gt-label">Total Returned Qty</div>
        <div class="gt-qty">${formatQty(totalQty)} ${escapeHtml(items[0]?.uom || '')}</div>
      </div>
      <div class="gt-value">${formatCurrency(grandTotal)}</div>
    </div>

    ${debit ? `
    <div class="debit-note-card">
      <div class="label">Debit Note Raised</div>
      <div class="dn-number">${escapeHtml(debit.debitNoteNumber)} &nbsp;·&nbsp; ${formatDate(debit.debitNoteDate)} &nbsp;·&nbsp; ${formatCurrency(debit.grandTotal)}</div>
    </div>` : ''}

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-title">Prepared By</div>
        <div class="sig-sub">${escapeHtml(rtn.preparedByName || '')}</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Store / QC</div>
        <div class="sig-sub">&nbsp;</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Authorised Signatory</div>
        <div class="sig-sub">${escapeHtml(companyName)}</div>
      </div>
    </div>

    <div class="footer">This is a computer-generated document. Printed on ${formatDateTime(new Date())}</div>
  </div>
</body>
</html>`;
};

// ─── Public API ──────────────────────────────────────────────────────────────
export const generateReturnDcPdf = async (returnData, options = {}) => {
  if (!returnData) {
    console.error('Return data is required');
    return;
  }
  try {
    let org = options.organisation || getCachedOrganisation();
    if (!org) org = await fetchAndCacheOrganisation();
    org = org || {};

    let supplier = options.supplier || null;
    if (!supplier && returnData.supplierId) {
      try {
        const res = await getSupplierById(returnData.supplierId);
        supplier = res?.data || res || null;
      } catch { /* ignore — we'll fall back to snapshot supplierName */ }
    }

    const html = buildHtml(returnData, org, supplier);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Allow pop-ups to print the Return DC.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 400);
    };
    setTimeout(() => {
      try { printWindow.print(); } catch { /* ignore */ }
    }, 1500);
  } catch (err) {
    console.error('Failed to generate Return DC PDF:', err);
    throw err;
  }
};

export default { generateReturnDcPdf };
