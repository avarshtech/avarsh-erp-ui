import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { getSupplierById } from '../services/master/supplierService';
import { getPurchaseOrderByIdAnyStatus } from '../services/inventory/inventoryService';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * GRN PDF Generator — Modern, rich UI/UX document for both Fabric and Accessories GRNs.
 *
 * Usage:
 *   import { generateGRNPdf } from '../utils/grnPdfGenerator';
 *   await generateGRNPdf(grnData);
 */

// ─── Number to Indian Rupee Words (reused pattern from poPdfGenerator) ────────

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
  let result = '';
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

// ─── Format Helpers ────────────────────────────────────────────────────────────

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatQty = (val, digits = 2) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return dayjs(dateStr).format('DD-MMM-YYYY');
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return dayjs(dateStr).format('DD-MMM-YYYY HH:mm:ss');
};

const escapeHtml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ─── Build line item rows (type-aware) ────────────────────────────────────────

/**
 * For Fabric GRNs: lineItems carry nested `rolls`; we aggregate rolls per line.
 * For Accessories GRNs: lineItems carry a flat receivingQty with optional cartons.
 *
 * Returns an array of simplified row objects the HTML template renders.
 */
const buildRows = (grn, poLineItemsByPli) => {
  const isFabric = grn.type === 'Fabric' || grn.grnType === 'Fabric';
  const lineItems = grn.lineItems || [];

  return lineItems.map((li, idx) => {
    const poLi = poLineItemsByPli[li.poLineItemId] || {};
    const rate = Number(li.rate ?? poLi.unitPrice ?? 0);

    // Resolve tax rates from PO line item
    const sgstPct = Number(poLi.sgstPercent ?? poLi.sgst ?? 0);
    const cgstPct = Number(poLi.cgstPercent ?? poLi.cgst ?? 0);
    const igstPct = Number(poLi.igstPercent ?? poLi.igst ?? 0);

    // Qty: for fabric = sum of rolls, for accessories = receivingQty
    let qty = 0;
    if (isFabric && Array.isArray(li.rolls) && li.rolls.length > 0) {
      qty = li.rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0);
    } else {
      qty = Number(li.receivingQty || 0);
    }

    const taxable = qty * rate;
    const igstAmt = (taxable * igstPct) / 100;
    const cgstAmt = (taxable * cgstPct) / 100;
    const sgstAmt = (taxable * sgstPct) / 100;
    const total = taxable + igstAmt + cgstAmt + sgstAmt;

    // HSN code from variant attributes if available, else blank
    const hsn = li.hsnCode || poLi.hsnCode || poLi.hsnSacCode || '';
    // GSM / Width pulled from first roll (fabric) or line item snapshot
    const firstRoll = isFabric && li.rolls && li.rolls[0];
    const gsm = firstRoll?.gsm ?? li.gsm ?? poLi.gsm ?? '';
    const width = firstRoll?.width ?? li.width ?? poLi.width ?? '';

    return {
      sl: idx + 1,
      itemCode: li.itemCode || poLi.itemCode || '',
      description: li.description || poLi.description || poLi.itemName || '',
      color: li.color || '',
      size: li.size || '',
      hsn,
      gsm,
      width,
      qty,
      uom: li.uom || poLi.uomName || '',
      rate,
      taxable,
      sgstPct,
      cgstPct,
      igstPct,
      sgstAmt,
      cgstAmt,
      igstAmt,
      total,
      rolls: li.rolls || [],
    };
  });
};

// ─── Aggregate tax breakup ────────────────────────────────────────────────────

const computeTotals = (rows, isIgst) => {
  let subtotal = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalQty = 0;
  const gstBreakupMap = {};

  rows.forEach((r) => {
    subtotal += r.taxable;
    totalQty += r.qty;
    totalSgst += r.sgstAmt;
    totalCgst += r.cgstAmt;
    totalIgst += r.igstAmt;

    const gstPercent = isIgst ? r.igstPct : (r.sgstPct + r.cgstPct);
    if (gstPercent > 0) {
      const key = gstPercent.toString();
      if (!gstBreakupMap[key]) {
        gstBreakupMap[key] = { percent: gstPercent, taxableValue: 0, amount: 0 };
      }
      gstBreakupMap[key].taxableValue += r.taxable;
      gstBreakupMap[key].amount += isIgst ? r.igstAmt : (r.sgstAmt + r.cgstAmt);
    }
  });

  const grandTotal = subtotal + totalSgst + totalCgst + totalIgst;
  const gstBreakup = Object.values(gstBreakupMap).sort((a, b) => a.percent - b.percent);

  return { subtotal, totalSgst, totalCgst, totalIgst, grandTotal, totalQty, gstBreakup };
};

// ─── Build full HTML Document ─────────────────────────────────────────────────

const buildGRNHtml = (grn, rows, totals, org, supplier, po, isIgst) => {
  const isFabric = grn.type === 'Fabric' || grn.grnType === 'Fabric';
  const typeBadge = isFabric ? 'FABRIC' : 'ACCESSORIES';
  const companyName = org?.organisationName || 'Company Name';
  const companyAddr = [org?.addressLine1, org?.addressLine2, org?.city, org?.stateName, org?.pincode]
    .filter(Boolean).join(', ');
  const orgGstin = org?.gstin || '';
  const orgPan = org?.pan || '';
  const orgStateCode = orgGstin.substring(0, 2);

  const supplierName = supplier?.name || grn.supplier || '';
  const supplierAddr = supplier
    ? [supplier.addressLine1, supplier.addressLine2, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')
    : '';
  const supplierGstin = supplier?.gstin || '';
  const supplierPan = supplier?.pan || '';
  const supplierStateCode = supplierGstin.substring(0, 2);

  const amountInWords = numberToIndianWords(totals.grandTotal);
  const watermarkText = companyName;
  const poRef = po?.orderReferences?.[0] || {};
  const garmentName = poRef.garmentType || poRef.garmentName || '';
  const season = poRef.season || '';

  // ─── Line Items Table (type-aware columns) ───────────────────────────────
  let lineItemsRows = '';
  rows.forEach((r) => {
    const descParts = [];
    if (r.description) descParts.push(`<strong>${escapeHtml(r.description)}</strong>`);
    if (r.itemCode) descParts.push(`<span class="item-code">Code: ${escapeHtml(r.itemCode)}</span>`);
    if (r.color) descParts.push(`<span class="attr">Color: ${escapeHtml(r.color)}</span>`);
    if (r.size) descParts.push(`<span class="attr">Size: ${escapeHtml(r.size)}</span>`);
    if (r.hsn) descParts.push(`<span class="attr">HSN/SAC: ${escapeHtml(r.hsn)}</span>`);
    if (r.gsm) descParts.push(`<span class="attr">GSM: ${escapeHtml(r.gsm)}</span>`);
    if (r.width) descParts.push(`<span class="attr">Width: ${escapeHtml(r.width)}"</span>`);

    let gstColumns = '';
    if (isIgst) {
      gstColumns = `
        <td class="num">${r.igstPct.toFixed(2)}%</td>
        <td class="num">${formatCurrency(r.igstAmt)}</td>`;
    } else {
      gstColumns = `
        <td class="num">${r.cgstPct.toFixed(2)}%</td>
        <td class="num">${formatCurrency(r.cgstAmt)}</td>
        <td class="num">${r.sgstPct.toFixed(2)}%</td>
        <td class="num">${formatCurrency(r.sgstAmt)}</td>`;
    }

    lineItemsRows += `
      <tr>
        <td class="num">${r.sl}</td>
        <td class="desc">${descParts.join('<br>')}</td>
        <td class="num">${formatQty(r.qty, 2)}</td>
        <td>${escapeHtml(r.uom)}</td>
        <td class="num">${formatCurrency(r.rate)}</td>
        <td class="num">${formatCurrency(r.taxable)}</td>
        ${gstColumns}
        <td class="num total">${formatCurrency(r.total)}</td>
      </tr>
    `;
  });

  // ─── GST breakup table ───────────────────────────────────────────────────
  let gstBreakupRows = '';
  totals.gstBreakup.forEach((g) => {
    const label = isIgst ? `IGST @ ${g.percent}%` : `GST @ ${g.percent}%`;
    gstBreakupRows += `
      <tr>
        <td>${label}</td>
        <td class="num">${formatCurrency(g.taxableValue)}</td>
        <td class="num">${formatCurrency(g.amount)}</td>
      </tr>
    `;
  });

  const gstHeaderCols = isIgst
    ? `<th>IGST %</th><th>IGST Amt</th>`
    : `<th>CGST %</th><th>CGST Amt</th><th>SGST %</th><th>SGST Amt</th>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GRN ${escapeHtml(grn.grnNumber || '')}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10px;
    color: #1f2937;
    background: #fff;
    position: relative;
  }
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 100px;
    color: rgba(0, 0, 0, 0.04);
    font-weight: 900;
    letter-spacing: 8px;
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
  }
  .page {
    position: relative;
    z-index: 1;
    max-width: 190mm;
    margin: 0 auto;
  }

  /* ─── Header ─── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12px;
    border-bottom: 3px solid #1e40af;
    margin-bottom: 14px;
  }
  .header .brand { display: flex; gap: 12px; align-items: flex-start; }
  .header .brand img { width: 58px; height: 58px; object-fit: contain; }
  .header .brand .company-info h1 {
    font-size: 18px;
    font-weight: 700;
    color: #1e3a8a;
    letter-spacing: -0.3px;
  }
  .header .brand .company-info .addr {
    font-size: 9.5px;
    color: #4b5563;
    margin-top: 2px;
    max-width: 300px;
  }
  .header .brand .company-info .gstin {
    margin-top: 4px;
    font-size: 9px;
    color: #6b7280;
  }
  .header .brand .company-info .gstin strong { color: #1f2937; }
  .header .doc-meta { text-align: right; }
  .header .doc-meta .doc-title {
    font-size: 15px;
    font-weight: 700;
    color: #1e3a8a;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .header .doc-meta .doc-sub {
    font-size: 9px;
    color: #6b7280;
    line-height: 1.5;
  }
  .header .doc-meta .doc-sub strong { color: #1f2937; }

  /* ─── Type badge ─── */
  .type-badge {
    display: inline-block;
    padding: 3px 12px;
    background: ${isFabric ? '#1e40af' : '#7c3aed'};
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    border-radius: 3px;
    margin-top: 4px;
  }

  /* ─── Metadata grid ─── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .meta-card {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 10px 12px;
    background: #fafafa;
  }
  .meta-card h3 {
    font-size: 9px;
    font-weight: 700;
    color: #1e40af;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .meta-card .row { display: flex; padding: 2px 0; font-size: 9.5px; }
  .meta-card .row .label {
    width: 110px;
    color: #6b7280;
    flex-shrink: 0;
  }
  .meta-card .row .value {
    color: #1f2937;
    font-weight: 500;
    flex: 1;
  }
  .meta-card .row .value.mono { font-family: 'Courier New', monospace; }

  /* ─── Line items table ─── */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 9px;
  }
  table.items th {
    background: #1e3a8a;
    color: #fff;
    padding: 7px 6px;
    text-align: left;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border: 1px solid #1e3a8a;
  }
  table.items td {
    padding: 7px 6px;
    border: 1px solid #e5e7eb;
    vertical-align: top;
  }
  table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.items td.total { font-weight: 700; color: #1e40af; }
  table.items td.desc { line-height: 1.5; }
  table.items td.desc .item-code,
  table.items td.desc .attr {
    display: inline-block;
    font-size: 8.5px;
    color: #6b7280;
    margin-right: 8px;
    margin-top: 2px;
  }
  table.items tr:nth-child(even) td { background: #f9fafb; }

  /* ─── Totals + GST breakup ─── */
  .totals-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 12px;
  }
  .words-box {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 10px 12px;
    background: #f9fafb;
  }
  .words-box .label {
    font-size: 8.5px;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }
  .words-box .words {
    font-size: 10px;
    color: #1f2937;
    font-weight: 500;
    line-height: 1.5;
  }
  table.gst {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }
  table.gst th {
    background: #f3f4f6;
    padding: 6px 8px;
    text-align: left;
    border: 1px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
  }
  table.gst td {
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
  }
  table.gst td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.gst tr.total-row { font-weight: 700; background: #dbeafe; color: #1e3a8a; }

  /* ─── Grand total banner ─── */
  .grand-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: linear-gradient(90deg, #1e3a8a 0%, #3730a3 100%);
    color: #fff;
    border-radius: 4px;
    margin-bottom: 14px;
  }
  .grand-total .gt-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .grand-total .gt-value {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .grand-total .gt-qty {
    font-size: 10px;
    opacity: 0.9;
    font-weight: 500;
  }

  /* ─── Signature block ─── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 30px;
    padding-top: 12px;
  }
  .sig-block {
    text-align: center;
    padding-top: 40px;
    border-top: 1px solid #9ca3af;
  }
  .sig-block .sig-title {
    font-size: 9.5px;
    font-weight: 600;
    color: #374151;
  }
  .sig-block .sig-sub {
    font-size: 8px;
    color: #9ca3af;
    margin-top: 2px;
  }

  /* ─── Footer ─── */
  .footer {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    font-size: 8px;
    color: #9ca3af;
  }

  @media print {
    .watermark { color: rgba(0, 0, 0, 0.035); }
  }
</style>
</head>
<body>
  <div class="watermark">${escapeHtml(watermarkText)}</div>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="brand">
        <img src="${sristiLogo}" alt="Logo" onerror="this.style.display='none'">
        <div class="company-info">
          <h1>${escapeHtml(companyName)}</h1>
          <div class="addr">${escapeHtml(companyAddr)}</div>
          <div class="gstin">
            <strong>PAN:</strong> ${escapeHtml(orgPan)} &nbsp;&nbsp;
            <strong>GSTIN:</strong> ${escapeHtml(orgGstin)} &nbsp;&nbsp;
            <strong>State Code:</strong> ${escapeHtml(orgStateCode)}
          </div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">GOODS RECEIPT NOTE</div>
        <div class="doc-sub">
          <strong>GRN #:</strong> ${escapeHtml(grn.grnNumber || '—')}<br>
          <strong>Date:</strong> ${formatDate(grn.grnDate)}<br>
          <strong>Generated:</strong> ${formatDateTime(new Date())}
        </div>
        <div class="type-badge">${typeBadge}</div>
      </div>
    </div>

    <!-- Metadata grid -->
    <div class="meta-grid">
      <div class="meta-card">
        <h3>GRN Details</h3>
        <div class="row"><div class="label">GRN Number</div><div class="value mono">${escapeHtml(grn.grnNumber || '—')}</div></div>
        <div class="row"><div class="label">GRN Date</div><div class="value">${formatDate(grn.grnDate)}</div></div>
        <div class="row"><div class="label">PO Number</div><div class="value mono">${escapeHtml(grn.poNumber || '—')}</div></div>
        <div class="row"><div class="label">Style #</div><div class="value">${escapeHtml(grn.styleNumber || '—')}</div></div>
        <div class="row"><div class="label">Buyer</div><div class="value">${escapeHtml(grn.buyerName || '—')}</div></div>
        ${garmentName ? `<div class="row"><div class="label">Garment</div><div class="value">${escapeHtml(garmentName)}</div></div>` : ''}
        ${season ? `<div class="row"><div class="label">Season</div><div class="value">${escapeHtml(season)}</div></div>` : ''}
        <div class="row"><div class="label">Challan / Invoice #</div><div class="value mono">${escapeHtml(grn.challanNo || '—')}</div></div>
        <div class="row"><div class="label">Invoice Date</div><div class="value">${formatDate(grn.invoiceDate)}</div></div>
        <div class="row"><div class="label">DC Date</div><div class="value">${formatDate(grn.deliveryChallanDate)}</div></div>
        <div class="row"><div class="label">Vehicle #</div><div class="value">${escapeHtml(grn.vehicleNumber || '—')}</div></div>
        <div class="row"><div class="label">Transporter</div><div class="value">${escapeHtml(grn.transporter || '—')}</div></div>
      </div>
      <div class="meta-card">
        <h3>Supplier</h3>
        <div class="row"><div class="label">Name</div><div class="value"><strong>${escapeHtml(supplierName || '—')}</strong></div></div>
        ${supplierAddr ? `<div class="row"><div class="label">Address</div><div class="value">${escapeHtml(supplierAddr)}</div></div>` : ''}
        ${supplierGstin ? `<div class="row"><div class="label">GSTIN</div><div class="value mono">${escapeHtml(supplierGstin)}</div></div>` : ''}
        ${supplierPan ? `<div class="row"><div class="label">PAN</div><div class="value mono">${escapeHtml(supplierPan)}</div></div>` : ''}
        ${supplierStateCode ? `<div class="row"><div class="label">State Code</div><div class="value">${escapeHtml(supplierStateCode)}</div></div>` : ''}
        ${grn.createdByName ? `<div class="row"><div class="label">Created By</div><div class="value">${escapeHtml(grn.createdByName)}</div></div>` : ''}
        ${grn.remarks ? `<div class="row"><div class="label">Remarks</div><div class="value">${escapeHtml(grn.remarks)}</div></div>` : ''}
      </div>
    </div>

    <!-- Line items table -->
    <table class="items">
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Description</th>
          <th style="width:70px">Qty</th>
          <th style="width:50px">UOM</th>
          <th style="width:70px">Rate</th>
          <th style="width:85px">Taxable</th>
          ${gstHeaderCols}
          <th style="width:90px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsRows}
      </tbody>
    </table>

    <!-- Totals row -->
    <div class="totals-row">
      <div class="words-box">
        <div class="label">Amount in Words</div>
        <div class="words">${escapeHtml(amountInWords)}</div>
      </div>
      <table class="gst">
        <thead>
          <tr>
            <th>Tax Description</th>
            <th class="num">Taxable Value</th>
            <th class="num">Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          ${gstBreakupRows}
          <tr class="total-row">
            <td>Total</td>
            <td class="num">${formatCurrency(totals.subtotal)}</td>
            <td class="num">${formatCurrency(totals.totalSgst + totals.totalCgst + totals.totalIgst)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Grand total banner -->
    <div class="grand-total">
      <div>
        <div class="gt-label">Total Receiving</div>
        <div class="gt-qty">${formatQty(totals.totalQty, 2)} ${rows[0]?.uom || ''}</div>
      </div>
      <div class="gt-value">INR ${formatCurrency(totals.grandTotal)}</div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-title">Prepared By</div>
        <div class="sig-sub">${escapeHtml(grn.createdByName || '')}</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Checked By</div>
        <div class="sig-sub">Store / QC Team</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Authorised Signatory</div>
        <div class="sig-sub">${escapeHtml(companyName)}</div>
      </div>
    </div>

    <div class="footer">
      This is a computer-generated document. Printed on ${formatDateTime(new Date())}
    </div>
  </div>
</body>
</html>`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateGRNPdf = async (grnData, options = {}) => {
  if (!grnData) {
    console.error('GRN data is required for PDF generation');
    return;
  }

  try {
    // Organisation
    let org = options.organisation || getCachedOrganisation();
    if (!org) {
      org = await fetchAndCacheOrganisation();
    }
    org = org || {};

    // Fetch PO (to get tax rates + supplier id)
    let po = options.po || null;
    if (!po && grnData.poId) {
      try { po = await getPurchaseOrderByIdAnyStatus(grnData.poId); } catch { /* ignore */ }
    }

    // Supplier details — fetch if not provided
    let supplier = options.supplier || null;
    const supplierId = po?.supplierId || grnData.supplierId;
    if (!supplier && supplierId) {
      try {
        const res = await getSupplierById(supplierId);
        supplier = res?.data || res || null;
      } catch { /* ignore */ }
    }

    // Build indexed PO line items by pli id so we can look up rate/tax
    const poLineItemsByPli = {};
    (po?.items || po?.lineItems || []).forEach((li) => {
      poLineItemsByPli[li.id] = li;
    });

    // Determine tax regime from PO
    const isIgst = Boolean(po?.isIgstApplicable || po?.igstApplicable);

    const rows = buildRows(grnData, poLineItemsByPli);
    const totals = computeTotals(rows, isIgst);

    const html = buildGRNHtml(grnData, rows, totals, org, supplier, po, isIgst);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Please allow pop-ups to print the GRN.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
    setTimeout(() => {
      try { printWindow.print(); } catch { /* ignore */ }
    }, 2000);
  } catch (error) {
    console.error('Failed to generate GRN PDF:', error);
    throw error;
  }
};

export default { generateGRNPdf };
