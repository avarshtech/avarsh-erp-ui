import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/organisationService';
import { getTermsConditionsById } from '../services/termsConditionsService';
import { getSupplierById } from '../services/supplierService';
import { getStateName } from './indianStates';
import { getPantoneSwatchUrl, isPantoneCode, extractPantoneCode } from '../services/pantoneService';

/**
 * PO PDF Generator - Professional Garments Industry Format
 * Generates a printable PO document optimized for raw material procurement.
 * Features: GST in columns, Pantone color swatches, modern styling, watermark.
 *
 * Usage:
 *   import { generatePOPdf } from '../utils/poPdfGenerator';
 *   generatePOPdf(poData);
 */

// ─── Number to Indian Rupee Words ──────────────────────────────────────────────

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

/**
 * Convert a number to Indian numbering system words.
 * e.g. 4643.52 → "Indian Rupee Four Thousand Six Hundred and Forty Three And Paise Fifty Two only"
 */
const numberToIndianWords = (num) => {
  if (num === 0) return 'Indian Rupee Zero only';

  const absNum = Math.abs(num);
  const rupees = Math.floor(absNum);
  const paise = Math.round((absNum - rupees) * 100);

  let result = '';

  if (rupees === 0) {
    result = 'Zero';
  } else {
    // Indian system: last 3 digits, then groups of 2
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
  if (paise > 0) {
    text += ' And Paise ' + numberToWordsBelow1000(paise);
  }
  text += ' only';
  return text;
};

// ─── Format Helpers ────────────────────────────────────────────────────────────

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD-MMM-YYYY');
};

const getStatusLabel = (status) => {
  if (!status) return '';
  const labels = {
    'Draft': 'Draft',
    'Pending_Approval': 'To be Approved',
    'Approved': 'Approved',
    'Rejected': 'Rejected',
    'Cancelled': 'Cancelled',
    'Referred_Back': 'Referred Back',
    'Sent_To_Supplier': 'Approved',
    'InProgress': 'In Progress',
    'Partially_Received': 'Partially Received',
    'Completed': 'Completed',
  };
  return labels[status] || status.replace(/_/g, ' ');
};

// ─── Compute GST Details ───────────────────────────────────────────────────────

const computeGSTDetails = (po) => {
  const items = po.lineItems || [];
  const isIgst = po.isIgstApplicable || po.igstApplicable || false;

  let subtotal = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;

  // Track GST breakup by percentage
  const gstBreakupMap = {};

  items.forEach((item) => {
    const qty = parseFloat(item.quantity || item.qty || 0);
    const price = parseFloat(item.unitPrice || 0);
    const base = qty * price;
    subtotal += base;

    let gstPercent = 0;
    if (item.gstPercent !== undefined && item.gstPercent !== null) {
      gstPercent = parseFloat(item.gstPercent) || 0;
    } else if (isIgst) {
      gstPercent = parseFloat(item.igst ?? item.igstPercent ?? 0) || 0;
    } else {
      gstPercent =
        (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) +
        (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
    }

    const gstAmount = (base * gstPercent) / 100;

    if (gstPercent > 0) {
      // Track breakup
      const percentKey = gstPercent.toString();
      if (!gstBreakupMap[percentKey]) {
        gstBreakupMap[percentKey] = { percent: gstPercent, taxableValue: 0, amount: 0 };
      }
      gstBreakupMap[percentKey].taxableValue += base;
      gstBreakupMap[percentKey].amount += gstAmount;

      if (isIgst) {
        totalIgst += gstAmount;
      } else {
        totalSgst += gstAmount / 2;
        totalCgst += gstAmount / 2;
      }
    }
  });

  // Convert breakup map to array sorted by percentage
  const gstBreakup = Object.values(gstBreakupMap).sort((a, b) => a.percent - b.percent);

  const grandTotal = po.grandTotal || (subtotal + totalSgst + totalCgst + totalIgst);

  return { subtotal, totalSgst, totalCgst, totalIgst, grandTotal, isIgst, gstBreakup };
};

// ─── Extract Pantone Swatches from Line Items ──────────────────────────────────

const extractColorSwatches = (item) => {
  const swatches = [];
  if (item.variantAttributes && typeof item.variantAttributes === 'object') {
    Object.entries(item.variantAttributes).forEach(([key, value]) => {
      const keyLower = key.toLowerCase();
      if ((keyLower.includes('color') || keyLower.includes('colour')) && value) {
        if (isPantoneCode(value)) {
          const code = extractPantoneCode(value);
          if (code) {
            swatches.push({
              code,
              name: value.includes('/') ? value.split('/')[1].trim() : '',
              url: getPantoneSwatchUrl(code),
            });
          }
        }
      }
    });
  }
  return swatches;
};

// ─── Build HTML Document ───────────────────────────────────────────────────────

const buildPOHtml = (po, org, termsContent, supplier) => {
  const gst = computeGSTDetails(po);
  const items = po.lineItems || [];
  const amountInWords = numberToIndianWords(gst.grandTotal);
  const poNumber = po.poNumber || po.poNo || '';
  const supplierName = po.supplierName || supplier?.name || '';
  const companyName = org?.organisationName || 'Company Name';
  const watermarkText = companyName;

  // PO Type: hard-code to "General" instead of 'Combined'
  const poType = 'General';

  // Build state code from GSTIN
  const orgGstin = org?.gstin || '';
  const supplierGstin = supplier?.gstin || po.supplierGstin || '';
  const orgStateCode = orgGstin.substring(0, 2);
  const supplierStateCode = supplierGstin.substring(0, 2);

  // Calculate total quantity per UOM
  const uomTotals = {};
  let totalQty = 0;
  items.forEach((item) => {
    const uom = item.uomName || item.uom || 'Units';
    const qty = parseFloat(item.quantity || item.qty || 0);
    uomTotals[uom] = (uomTotals[uom] || 0) + qty;
    totalQty += qty;
  });

  // Build line items table rows with GST in columns
  let lineItemsHtml = '';
  items.forEach((item, idx) => {
    const qty = parseFloat(item.quantity || item.qty || 0);
    const price = parseFloat(item.unitPrice || 0);
    const base = qty * price;
    const uom = item.uomName || item.uom || 'Units';

    let gstPercent = 0;
    if (item.gstPercent !== undefined && item.gstPercent !== null) {
      gstPercent = parseFloat(item.gstPercent) || 0;
    } else if (gst.isIgst) {
      gstPercent = parseFloat(item.igst ?? item.igstPercent ?? 0) || 0;
    } else {
      gstPercent =
        (parseFloat(item.sgstPercent ?? item.sgst ?? 0) || 0) +
        (parseFloat(item.cgstPercent ?? item.cgst ?? 0) || 0);
    }

    const gstAmount = (base * gstPercent) / 100;
    const totalWithTax = base + gstAmount;

    // Description with item details
    let descParts = [];
    if (item.itemName) descParts.push(`<strong>${item.itemName}</strong>`);
    if (item.description) descParts.push(item.description);
    if (item.itemCode) descParts.push(`<span class="item-code">Code: ${item.itemCode}</span>`);

    // Variant attributes (excluding color which shows as swatch)
    const colorSwatches = extractColorSwatches(item);
    if (item.variantAttributes && typeof item.variantAttributes === 'object') {
      Object.entries(item.variantAttributes).forEach(([k, v]) => {
        const keyLower = k.toLowerCase();
        if (!keyLower.includes('color') && !keyLower.includes('colour')) {
          descParts.push(`<span class="attr">${k}: ${v}</span>`);
        }
      });
    }

    // Color swatches HTML - cropped to show only color (no text from image)
    let swatchHtml = '';
    if (colorSwatches.length > 0) {
      swatchHtml = colorSwatches.map(swatch => `
        <div class="color-swatch-container">
          <div class="color-swatch-wrapper">
            <img src="${swatch.url}" class="color-swatch" alt="${swatch.code}" onerror="this.style.display='none'" />
          </div>
        </div>
      `).join('');
    }

    // GST columns based on type - only show relevant columns
    // Order: SGST%, CGST%, SGST, CGST (percentages first, then values)
    let gstColumnsHtml = '';
    if (gst.isIgst) {
      const igstAmt = gstAmount;
      gstColumnsHtml = `<td class="num">${gstPercent}%</td><td class="num">${formatCurrency(igstAmt)}</td>`;
    } else {
      const halfPercent = gstPercent / 2;
      const halfAmt = gstAmount / 2;
      gstColumnsHtml = `<td class="num">${halfPercent}%</td><td class="num">${halfPercent}%</td><td class="num">${formatCurrency(halfAmt)}</td><td class="num">${formatCurrency(halfAmt)}</td>`;
    }

    lineItemsHtml += `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="desc-cell">
          <div class="desc-content">${descParts.join('<br>')}</div>
          ${swatchHtml ? `<div class="swatches-row">${swatchHtml}</div>` : ''}
        </td>
        <td class="num">${formatCurrency(price)}</td>
        <td class="center nowrap">${qty}&nbsp;${uom}</td>
        <td class="num">${formatCurrency(base)}</td>
        ${gstColumnsHtml}
        <td class="num total-col">${formatCurrency(totalWithTax)}</td>
      </tr>`;
  });

  // Build total qty summary
  const totalQtyDisplay = Object.entries(uomTotals)
    .map(([uom, qty]) => `${formatCurrency(qty)} ${uom}`)
    .join(' | ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PO ${poNumber} - ${supplierName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 10mm 8mm 12mm 8mm; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      font-size: 9px;
      color: #1a1a1a;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 72px;
      font-weight: 800;
      color: rgba(99, 102, 241, 0.04);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 8px;
      text-transform: uppercase;
    }
    .page-content { position: relative; z-index: 1; }
    .header-section {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 6px 6px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .company-info { flex: 1; }
    .company-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .company-details { font-size: 8px; opacity: 0.9; line-height: 1.4; }
    .logo-box {
      width: 65px;
      height: 65px;
      background: white;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }
    .logo-box img { max-width: 55px; max-height: 55px; object-fit: contain; }
    .po-badge { text-align: right; padding-left: 20px; }
    .po-badge .po-label { font-size: 7px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
    .po-badge .po-number { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
    .po-badge .po-status {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 8px;
      font-weight: 600;
      margin-top: 4px;
    }
    .info-row { display: flex; gap: 8px; margin-top: 8px; }
    .info-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px 10px;
    }
    .info-card-header {
      font-size: 7px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6366f1;
      font-weight: 600;
      margin-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .info-card-body { font-size: 8px; }
    .info-card-body .name { font-size: 10px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
    .info-card-body .detail { color: #475569; margin-bottom: 2px; }
    .info-card-body .gstin { font-family: monospace; background: #e0e7ff; padding: 2px 5px; border-radius: 3px; font-size: 8px; display: inline-block; margin-top: 3px; margin-right: 6px; }
    .info-card-body .pan-badge { font-family: monospace; background: #fef3c7; padding: 2px 5px; border-radius: 3px; font-size: 8px; display: inline-block; margin-top: 3px; color: #92400e; margin-right: 6px; }
    .info-card-body .state-badge { font-family: monospace; background: #dcfce7; padding: 2px 5px; border-radius: 3px; font-size: 8px; display: inline-block; margin-top: 3px; color: #166534; }
    .po-details-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: #e2e8f0;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      margin-top: 8px;
      overflow: hidden;
    }
    .po-detail-item { background: white; padding: 6px 8px; text-align: center; }
    .po-detail-item .label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .po-detail-item .value { font-size: 9px; font-weight: 600; color: #1e293b; margin-top: 2px; }
    .items-section { margin-top: 8px; }
    .section-title {
      font-size: 9px;
      font-weight: 600;
      color: #374151;
      padding: 5px 8px;
      background: #f1f5f9;
      border-radius: 4px 4px 0 0;
      border: 1px solid #e2e8f0;
      border-bottom: none;
    }
    .items-table { width: 100%; border-collapse: collapse; font-size: 8px; }
    .items-table th {
      background: #1e293b;
      color: white;
      padding: 5px 3px;
      text-align: center;
      font-weight: 600;
      font-size: 7px;
      white-space: nowrap;
    }
    .items-table th.desc-col { text-align: left; padding-left: 6px; }
    .items-table td { border: 1px solid #e2e8f0; padding: 4px 3px; vertical-align: top; }
    .items-table .center { text-align: center; }
    .items-table .num { text-align: right; font-family: 'SF Mono', Monaco, monospace; font-size: 8px; vertical-align: top; }
    .items-table .center { vertical-align: top; }
    .items-table .nowrap { white-space: nowrap; }
    .items-table .total-col { background: #f0fdf4; font-weight: 600; }
    .items-table .desc-cell { padding: 4px 6px; }
    .items-table .desc-content { line-height: 1.35; }
    .items-table .item-code { color: #6366f1; font-size: 7px; }
    .items-table .attr { color: #64748b; font-size: 7px; }
    .swatches-row { display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
    .color-swatch-container { display: flex; align-items: center; }
    .color-swatch-wrapper {
      width: 36px;
      height: 36px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      position: relative;
    }
    .color-swatch {
      width: 100%;
      height: auto;
      position: absolute;
      top: 0;
      left: 0;
      transform: scale(1.3);
      transform-origin: top center;
    }
    .summary-section { margin-top: 8px; display: flex; gap: 8px; }
    .qty-summary {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px;
    }
    .qty-summary .label { font-size: 7px; color: #64748b; text-transform: uppercase; }
    .qty-summary .value { font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 2px; }
    .totals-box {
      width: 260px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 8px;
      font-size: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-row.highlight {
      background: #6366f1;
      color: white;
      font-weight: 700;
      font-size: 10px;
    }
    .totals-row .label { color: #475569; }
    .totals-row .value { font-weight: 600; font-family: monospace; }
    .totals-row.highlight .label, .totals-row.highlight .value { color: white; }
    .gst-breakup-header {
      background: #1e293b;
      color: #6366f1;
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .gst-group-header {
      background: #f8fafc;
      color: #374151;
      font-size: 7px;
      font-weight: 600;
      padding: 3px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .totals-row.gst-detail {
      padding-left: 16px;
      font-size: 7px;
      background: #fafafa;
    }
    .totals-row.gst-detail .label { color: #64748b; }
    .totals-row.total-gst {
      background: #f1f5f9;
      font-weight: 600;
    }
    .totals-row.total-gst .label { color: #374151; }
    .amount-words {
      background: #fffbeb;
      border: 1px solid #fbbf24;
      border-radius: 4px;
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 8px;
    }
    .amount-words strong { color: #92400e; }
    .terms-section {
      margin-top: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .terms-header {
      background: #f1f5f9;
      padding: 5px 8px;
      font-size: 8px;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e2e8f0;
    }
    .terms-content {
      padding: 8px 10px;
      font-size: 8px;
      line-height: 1.4;
      color: #475569;
    }
    .terms-content ul, .terms-content ol { padding-left: 14px; margin: 3px 0; }
    .terms-content li { margin-bottom: 2px; }
    .remarks-section {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 6px 10px;
      margin-top: 8px;
      font-size: 8px;
    }
    .remarks-section strong { color: #92400e; }
    .signature-section {
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-box { text-align: center; min-width: 90px; }
    .signature-box .line {
      width: 80px;
      height: 1px;
      background: #94a3b8;
      margin: 25px auto 5px;
    }
    .signature-box .role { font-size: 7px; color: #64748b; font-weight: 500; }
    .signature-box .name { font-size: 8px; font-weight: 600; margin-bottom: 2px; }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 7px;
      color: #6366f1;
      font-weight: 600;
      padding: 6px;
      background: #f0f4ff;
      border-radius: 4px;
    }
    .note-line {
      font-size: 7px;
      color: #64748b;
      text-align: center;
      margin-top: 5px;
    }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="watermark">${watermarkText}</div>
  <div class="page-content">
    <div class="header-section">
      <div style="display:flex; align-items:center;">
        <div class="logo-box">
          <img src="/src/assets/images/sristi_logo.jpeg" alt="Logo" style="max-width:55px; max-height:55px; object-fit:contain;" />
        </div>
        <div class="company-info">
          <div class="company-name">${companyName}</div>
          <div class="company-details">
            ${[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ')}<br>
            ${[org?.city, org?.state].filter(Boolean).join(', ')}${org?.pincode ? ' - ' + org.pincode : ''}<br>
            ${org?.phone ? 'Tel: ' + org.phone + ' | ' : ''}${org?.email ? 'Email: ' + org.email : ''}<br>
            GSTIN: ${orgGstin || '-'} | PAN: ${org?.pan || '-'}${org?.cin ? ' | CIN: ' + org.cin : ''}
          </div>
        </div>
      </div>
      <div class="po-badge">
        <div class="po-label">Purchase Order</div>
        <div class="po-number">${poNumber}</div>
        <div class="po-status">${getStatusLabel(po.status)}</div>
      </div>
    </div>
    <div class="info-row">
      <div class="info-card">
        <div class="info-card-header">Supplier Details</div>
        <div class="info-card-body">
          <div class="name">${supplierName}</div>
          ${supplier?.address ? `<div class="detail">${supplier.address}</div>` : '<div class="detail">-</div>'}
          <div class="detail">${[supplier?.city, supplier?.state].filter(Boolean).join(', ')}${supplier?.pincode ? ' - ' + supplier.pincode : ''}</div>
          ${supplier?.phone ? `<div class="detail">Phone: ${supplier.phone}</div>` : ''}
          ${supplier?.email ? `<div class="detail">Email: ${supplier.email}</div>` : ''}
          <div style="margin-top: 4px;">
            ${supplierGstin ? `<span class="gstin">GSTIN: ${supplierGstin}</span>` : ''}
            ${supplier?.pan ? `<span class="pan-badge">PAN: ${supplier.pan}</span>` : ''}
            ${supplierStateCode ? `<span class="state-badge">State: ${supplierStateCode}${getStateName(supplierStateCode) ? ' - ' + getStateName(supplierStateCode) : (supplier?.state ? ' - ' + supplier.state : '')}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-header">Ship To</div>
        <div class="info-card-body">
          <div class="name">${companyName}</div>
          <div class="detail">${[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ') || '-'}</div>
          <div class="detail">${[org?.city, org?.state].filter(Boolean).join(', ')}${org?.pincode ? ' - ' + org.pincode : ''}</div>
          ${org?.phone ? `<div class="detail">Phone: ${org.phone}</div>` : ''}
          ${org?.email ? `<div class="detail">Email: ${org.email}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="po-details-grid">
      <div class="po-detail-item">
        <div class="label">PO Date</div>
        <div class="value">${formatDate(po.poDate)}</div>
      </div>
      <div class="po-detail-item">
        <div class="label">PO Type</div>
        <div class="value">${poType}</div>
      </div>
      <div class="po-detail-item">
        <div class="label">Delivery Date</div>
        <div class="value">${formatDate(po.deliveryDate || po.expectedDeliveryDate)}</div>
      </div>
      <div class="po-detail-item">
        <div class="label">Tax Type</div>
        <div class="value">${gst.isIgst ? 'IGST' : 'CGST + SGST'}</div>
      </div>
    </div>
    <div class="items-section">
      <div class="section-title">Order Items</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th class="desc-col">Description / Color</th>
            <th style="width:50px;">Rate</th>
            <th style="width:55px;">Qty</th>
            <th style="width:65px;">Base Value</th>
            ${gst.isIgst ? `
            <th style="width:35px;">IGST%</th>
            <th style="width:55px;">IGST</th>
            ` : `
            <th style="width:35px;">SGST%</th>
            <th style="width:35px;">CGST%</th>
            <th style="width:50px;">SGST</th>
            <th style="width:50px;">CGST</th>
            `}
            <th style="width:70px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>
    </div>
    <div class="summary-section">
      <div class="qty-summary">
        <div class="label">Total Quantity</div>
        <div class="value">${totalQtyDisplay}</div>
      </div>
      <div class="totals-box">
        <div class="totals-row">
          <span class="label">Subtotal</span>
          <span class="value">₹ ${formatCurrency(gst.subtotal)}</span>
        </div>
        <div class="gst-breakup-header">GST BREAKUP</div>
        ${gst.gstBreakup.map(item => {
          if (gst.isIgst) {
            return `
            <div class="gst-group-header">GST @ ${item.percent}%</div>
            <div class="totals-row gst-detail">
              <span class="label">IGST (${item.percent}%)</span>
              <span class="value">₹ ${formatCurrency(item.amount)}</span>
            </div>`;
          } else {
            const halfPercent = item.percent / 2;
            const halfAmount = item.amount / 2;
            return `
            <div class="gst-group-header">GST @ ${item.percent}%</div>
            <div class="totals-row gst-detail">
              <span class="label">SGST (${halfPercent}%)</span>
              <span class="value">₹ ${formatCurrency(halfAmount)}</span>
            </div>
            <div class="totals-row gst-detail">
              <span class="label">CGST (${halfPercent}%)</span>
              <span class="value">₹ ${formatCurrency(halfAmount)}</span>
            </div>`;
          }
        }).join('')}
        ${!gst.isIgst ? `
        <div class="totals-row total-gst">
          <span class="label">Total SGST</span>
          <span class="value">₹ ${formatCurrency(gst.totalSgst)}</span>
        </div>
        <div class="totals-row total-gst">
          <span class="label">Total CGST</span>
          <span class="value">₹ ${formatCurrency(gst.totalCgst)}</span>
        </div>
        ` : `
        <div class="totals-row total-gst">
          <span class="label">Total IGST</span>
          <span class="value">₹ ${formatCurrency(gst.totalIgst)}</span>
        </div>
        `}
        <div class="totals-row highlight">
          <span class="label">Grand Total</span>
          <span class="value">₹ ${formatCurrency(gst.grandTotal)}</span>
        </div>
      </div>
    </div>
    <div class="amount-words">
      <strong>Amount in Words:</strong> ${amountInWords}
    </div>
    ${termsContent ? `
    <div class="terms-section">
      <div class="terms-header">Terms & Conditions</div>
      <div class="terms-content">${termsContent}</div>
    </div>
    ` : ''}
    ${po.remarks ? `
    <div class="remarks-section">
      <strong>Remarks:</strong> ${po.remarks}
    </div>
    ` : ''}
    <div class="signature-section">
      <div class="signature-box">
        <div class="name">${po.createdByName || ''}</div>
        <div class="line"></div>
        <div class="role">Prepared By</div>
      </div>
      <div class="signature-box">
        <div class="name">${po.approvedByName || ''}</div>
        <div class="line"></div>
        <div class="role">Approved By</div>
      </div>
    </div>
    <div class="footer">
      THIS IS A COMPUTER GENERATED DOCUMENT - NO SIGNATURE REQUIRED
    </div>
    <div class="note-line">
      For any queries, please contact: ${org?.email || 'support@company.com'}
    </div>
  </div>
</body>
</html>`;
};

// ─── Main Export ────────────────────────────────────────────────────────────────

/**
 * Generate and print PO PDF.
 * Opens a new window with the formatted PO and triggers the browser's print dialog.
 *
 * @param {Object} poData - Full PO object (from getPurchaseOrderById)
 * @param {Object} [options] - Optional overrides
 * @param {Object} [options.organisation] - Pre-fetched org info (skips session lookup)
 * @param {string} [options.termsContent] - Pre-fetched T&C HTML content (skips API call)
 * @param {Object} [options.supplier] - Pre-fetched supplier info (skips API call)
 */
export const generatePOPdf = async (poData, options = {}) => {
  if (!poData) {
    console.error('PO data is required for PDF generation');
    return;
  }

  try {
    // Get organisation from session storage (cached after login)
    let org = options.organisation || getCachedOrganisation();
    
    // If not in session, try to fetch and cache it
    if (!org) {
      org = await fetchAndCacheOrganisation();
    }
    org = org || {};

    // Fetch supplier details if not provided
    let supplier = options.supplier || {};
    if (!options.supplier && poData.supplierId) {
      try {
        const supplierResult = await getSupplierById(poData.supplierId);
        supplier = supplierResult?.data || supplierResult || {};
      } catch (err) {
        console.warn('Failed to fetch supplier details:', err);
      }
    }

    // Fetch terms & conditions content if not provided
    let termsContent = options.termsContent || '';
    if (!termsContent && poData.termsConditionsId) {
      try {
        const tcResponse = await getTermsConditionsById(poData.termsConditionsId);
        const tcData = tcResponse?.data || tcResponse || {};
        termsContent = tcData.description || '';
      } catch (err) {
        console.warn('Failed to fetch terms & conditions:', err);
      }
    }

    // Build the HTML document
    const html = buildPOHtml(poData, org, termsContent, supplier);

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to render, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };

    // Fallback: trigger print after a timeout if onload doesn't fire
    setTimeout(() => {
      try {
        printWindow.print();
      } catch {
        // Window may have been closed
      }
    }, 2000);
  } catch (error) {
    console.error('Failed to generate PO PDF:', error);
    throw error;
  }
};

export default { generatePOPdf, numberToIndianWords };
