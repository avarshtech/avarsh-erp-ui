import dayjs from 'dayjs';
import { getActiveOrganisation } from '../services/organisationService';
import { getTermsConditionsById } from '../services/termsConditionsService';
import { getSupplierById } from '../services/supplierService';
import { getItemsByIds } from '../services/itemService';

/**
 * PO PDF Generator
 * Generates a printable PO document in a new window using system print dialog.
 * The browser's print-to-PDF feature handles the actual PDF creation.
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

  const gstGroups = {};

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
      if (!gstGroups[gstPercent]) {
        gstGroups[gstPercent] = { sgst: 0, cgst: 0, igst: 0 };
      }
      if (isIgst) {
        totalIgst += gstAmount;
        gstGroups[gstPercent].igst += gstAmount;
      } else {
        totalSgst += gstAmount / 2;
        totalCgst += gstAmount / 2;
        gstGroups[gstPercent].sgst += gstAmount / 2;
        gstGroups[gstPercent].cgst += gstAmount / 2;
      }
    }
  });

  const grandTotal = po.grandTotal || (subtotal + totalSgst + totalCgst + totalIgst);

  return { subtotal, totalSgst, totalCgst, totalIgst, grandTotal, gstGroups, isIgst };
};

// ─── Build HTML Document ───────────────────────────────────────────────────────

const buildPOHtml = (po, org, termsContent, supplier, poCategory) => {
  const gst = computeGSTDetails(po);
  const items = po.lineItems || [];
  const amountInWords = numberToIndianWords(gst.grandTotal);
  const poNumber = po.poNumber || po.poNo || '';
  const supplierName = po.supplierName || supplier?.name || '';
  const companyName = org?.organisationName || 'Company Name';
  const watermarkText = companyName;

  // Determine PO type from category
  const poType = poCategory || 'Combined';

  // Build line items rows with GST detail sub-rows
  let lineItemsHtml = '';
  items.forEach((item, idx) => {
    const qty = parseFloat(item.quantity || item.qty || 0);
    const price = parseFloat(item.unitPrice || 0);
    const base = qty * price;

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
    if (item.itemName) descParts.push(item.itemName);
    if (item.description) descParts.push(item.description);
    if (item.itemCode) descParts.push(`Code: ${item.itemCode}`);
    // Variant attributes
    if (item.variantAttributes && typeof item.variantAttributes === 'object') {
      Object.entries(item.variantAttributes).forEach(([k, v]) => {
        descParts.push(`${k}: ${v}`);
      });
    }

    const uom = item.uomName || item.uom || 'Units';

    // Main item row
    lineItemsHtml += `
      <tr>
        <td style="text-align:center; vertical-align:top; border:1px solid #999; padding:6px;">${idx + 1}</td>
        <td style="border:1px solid #999; padding:6px; vertical-align:top;">
          <div>${descParts.join('<br>')}</div>
        </td>
        <td style="text-align:right; border:1px solid #999; padding:6px; vertical-align:top;">${formatCurrency(price)}</td>
        <td style="text-align:center; border:1px solid #999; padding:6px; vertical-align:top;">${qty}<br><span style="font-size:10px;color:#666;">${uom}</span></td>
        <td style="text-align:center; border:1px solid #999; padding:6px; vertical-align:top;"></td>
        <td style="text-align:center; border:1px solid #999; padding:6px; vertical-align:top;"></td>
        <td style="text-align:right; border:1px solid #999; padding:6px; vertical-align:top;">${formatCurrency(base)}</td>
        <td style="text-align:right; border:1px solid #999; padding:6px; vertical-align:top; font-weight:600;">${formatCurrency(totalWithTax)}</td>
      </tr>`;

    // GST detail sub-rows
    if (gstPercent > 0) {
      if (gst.isIgst) {
        const igstAmt = (base * gstPercent) / 100;
        lineItemsHtml += `
          <tr style="background:#fafafa; font-size:11px;">
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">IGST</td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">${gstPercent.toFixed(4)}%</td>
            <td style="text-align:right; border:1px solid #999; padding:4px;">${formatCurrency(igstAmt)}</td>
            <td style="border:1px solid #999;"></td>
          </tr>`;
      } else {
        const halfPercent = gstPercent / 2;
        const halfAmt = (base * halfPercent) / 100;
        lineItemsHtml += `
          <tr style="background:#fafafa; font-size:11px;">
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">CGST</td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">${halfPercent.toFixed(4)}%</td>
            <td style="text-align:right; border:1px solid #999; padding:4px;">${formatCurrency(halfAmt)}</td>
            <td style="border:1px solid #999;"></td>
          </tr>
          <tr style="background:#fafafa; font-size:11px;">
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="border:1px solid #999;"></td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">SGST</td>
            <td style="text-align:center; border:1px solid #999; padding:4px;">${halfPercent.toFixed(4)}%</td>
            <td style="text-align:right; border:1px solid #999; padding:4px;">${formatCurrency(halfAmt)}</td>
            <td style="border:1px solid #999;"></td>
          </tr>`;
      }
    }
  });

  // Tax Breakup Summary
  let taxBreakupHtml = '';
  if (gst.isIgst) {
    taxBreakupHtml = `
      <tr><td colspan="6"></td><td style="border:1px solid #999; padding:4px; text-align:center; font-weight:600; font-size:12px;">IGST</td>
      <td style="border:1px solid #999; padding:4px; text-align:right; font-size:12px;">${formatCurrency(gst.totalIgst)}</td></tr>`;
  } else {
    taxBreakupHtml = `
      <tr><td colspan="6" style="text-align:right; padding:4px; font-weight:600; font-size:12px;">Tax Breakup Details</td>
        <td style="border:1px solid #999; padding:4px; text-align:center; font-size:12px; color:#c00;">CGST</td>
        <td style="border:1px solid #999; padding:4px; text-align:right; font-size:12px;">${formatCurrency(gst.totalCgst)}</td></tr>
      <tr><td colspan="6"></td>
        <td style="border:1px solid #999; padding:4px; text-align:center; font-size:12px; color:#c00;">SGST</td>
        <td style="border:1px solid #999; padding:4px; text-align:right; font-size:12px;">${formatCurrency(gst.totalSgst)}</td></tr>`;
  }

  // Total quantity summary per UOM
  const uomTotals = {};
  items.forEach((item) => {
    const uom = item.uomName || item.uom || 'Units';
    const qty = parseFloat(item.quantity || item.qty || 0);
    uomTotals[uom] = (uomTotals[uom] || 0) + qty;
  });
  const totalQtyHtml = Object.entries(uomTotals)
    .map(([uom, qty]) => `<strong>${formatCurrency(qty)}</strong> ${uom}`)
    .join(' &nbsp;|&nbsp; ');

  // Build state code from GSTIN
  const orgGstin = org?.gstin || '';
  const supplierGstin = supplier?.gstin || po.supplierGstin || '';
  const orgStateCode = orgGstin.substring(0, 2);
  const supplierStateCode = supplierGstin.substring(0, 2);

  // Determine PO type based on items (fabric/trims)
  const poTypeLabel = poType;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${poNumber} ${supplierName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: A4;
      margin: 12mm 10mm 15mm 10mm;
    }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #333;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 80px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.04);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 6px;
    }
    .page-content {
      position: relative;
      z-index: 1;
    }
    .header-table { width: 100%; border-collapse: collapse; border: 2px solid #333; }
    .header-table td { padding: 4px 8px; vertical-align: top; }
    .company-name { font-size: 16px; font-weight: 700; text-align: center; color: #1a1a1a; }
    .company-address { font-size: 10px; text-align: center; color: #555; line-height: 1.3; }
    .po-type-bar {
      display: flex;
      justify-content: space-between;
      border: 2px solid #333;
      border-top: none;
      font-weight: 700;
      font-size: 13px;
    }
    .po-type-bar > div { padding: 6px 12px; }
    .po-type-label { text-align: center; flex: 1; border-right: 1px solid #333; text-decoration: underline; }
    .po-status-label { text-align: center; flex: 1; color: #c00; }
    .details-row {
      display: flex;
      border: 2px solid #333;
      border-top: none;
    }
    .details-left, .details-right {
      flex: 1;
      padding: 8px 12px;
    }
    .details-left { border-right: 1px solid #333; }
    .detail-label { font-weight: 600; color: #555; font-size: 11px; }
    .detail-value { font-weight: 500; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .items-table th {
      background: #f0f0f0;
      border: 1px solid #999;
      padding: 6px 8px;
      font-size: 11px;
      text-align: center;
      font-weight: 600;
    }
    .grand-total-row {
      border: 2px solid #333;
      border-top: none;
      padding: 8px 12px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 24px;
      font-size: 14px;
      font-weight: 700;
      background: #f8f8f8;
    }
    .amount-words {
      padding: 8px 12px;
      border: 2px solid #333;
      border-top: none;
      font-size: 11px;
    }
    .terms-section {
      padding: 8px 12px;
      border: 2px solid #333;
      border-top: none;
    }
    .terms-section h4 {
      margin-bottom: 4px;
      font-size: 12px;
      text-decoration: underline;
    }
    .terms-content {
      font-size: 11px;
      line-height: 1.5;
    }
    .terms-content ul, .terms-content ol { padding-left: 20px; margin: 4px 0; }
    .terms-content li { margin-bottom: 2px; }
    .note-section {
      padding: 6px 12px;
      border: 2px solid #333;
      border-top: none;
      font-size: 10px;
      color: #555;
    }
    .signature-section {
      border: 2px solid #333;
      border-top: none;
      padding: 16px 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      min-height: 80px;
    }
    .signature-box {
      text-align: center;
      min-width: 120px;
      font-size: 11px;
    }
    .signature-box .name {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .signature-box .role {
      border-top: 1px solid #999;
      padding-top: 4px;
      font-weight: 600;
      font-size: 10px;
    }
    .for-company {
      text-align: right;
      font-weight: 600;
      font-size: 12px;
      padding: 6px 12px;
      border: 2px solid #333;
      border-top: none;
      border-bottom: none;
    }
    .footer-note {
      text-align: center;
      font-size: 10px;
      color: #c00;
      font-weight: 600;
      padding: 8px;
      border-top: 2px solid #333;
      margin-top: 0;
    }
    .page-info {
      text-align: right;
      font-size: 9px;
      color: #888;
      margin-bottom: 4px;
    }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Watermark -->
  <div class="watermark">${watermarkText}</div>

  <div class="page-content">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="width:100px; text-align:center; vertical-align:middle; border-right:1px solid #333;">
          <!-- Company Logo -->
          ${org?.logoUrl
            ? `<img src="${org.logoUrl}" style="width:80px; height:80px; object-fit:contain; border-radius:4px;" alt="Logo" crossorigin="anonymous" />`
            : `<div style="width:80px; height:80px; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center; margin:0 auto; border-radius:4px; color:#999; font-size:9px;">LOGO</div>`
          }
        </td>
        <td style="text-align:center; border-right:1px solid #333;">
          <div class="company-name">${companyName}</div>
          <div class="company-address">
            ${[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ')}<br>
            ${[org?.city, org?.state].filter(Boolean).join(', ')}${org?.pincode ? ' - ' + org.pincode : ''}<br>
            ${org?.email ? 'Email: ' + org.email : ''}
          </div>
        </td>
        <td style="width:200px; font-size:10px;">
          <div>${org?.phone ? 'Tel: ' + org.phone : ''}</div>
          <div>PAN No: ${org?.pan || '-'}</div>
          <div>GSTIN No: ${orgGstin || '-'}</div>
          ${org?.cin ? '<div>CIN: ' + org.cin + '</div>' : ''}
          <div>State Code/Name: ${orgStateCode || '-'} - ${org?.state || ''}</div>
        </td>
      </tr>
    </table>

    <!-- PO Type + Status Bar -->
    <div class="po-type-bar">
      <div class="po-type-label">${poTypeLabel} Purchase Order</div>
      <div class="po-status-label">${getStatusLabel(po.status)}</div>
    </div>

    <!-- Supplier + PO Details -->
    <div class="details-row">
      <div class="details-left">
        <div style="font-weight:700; margin-bottom:6px; font-size:12px;">TO : ${supplierName}</div>
        <div style="font-size:11px; line-height:1.5;">
          ${supplier?.address || ''}<br>
          ${[supplier?.city, supplier?.state].filter(Boolean).join(', ')}${supplier?.pincode ? ' - ' + supplier.pincode : ''}<br>
          ${supplier?.phone ? 'Phone: ' + supplier.phone : ''}
          ${supplier?.email ? '<br>Email: ' + supplier.email : ''}
        </div>
        <div style="margin-top:6px; font-size:11px;">
          ${supplierGstin ? '<div>GSTIN No: ' + supplierGstin + '</div>' : ''}
          ${supplier?.pan ? '<div>PAN NO: ' + supplier.pan + '</div>' : ''}
          ${supplierStateCode ? '<div>State Code/Name: ' + supplierStateCode + ' - ' + (supplier?.state || '') + '</div>' : ''}
        </div>
      </div>
      <div class="details-right">
        <table style="width:100%; font-size:11px;">
          <tr>
            <td style="padding:3px 0;"><strong>PO No</strong></td>
            <td style="padding:3px 0; font-weight:700; color:#1a1a1a;">${poNumber}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><strong>Date</strong></td>
            <td style="padding:3px 0;">${formatDate(po.poDate)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><strong>PO Type</strong></td>
            <td style="padding:3px 0;">${poTypeLabel}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;"><strong>Delivery Date</strong></td>
            <td style="padding:3px 0;">${formatDate(po.deliveryDate || po.expectedDeliveryDate)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding:8px 12px; border:2px solid #333; border-top:none; font-size:11px;">
      <div>Dear Sir / Madam,</div>
      <div>We are pleased to place the following order with you as per Terms and Conditions mentioned below</div>
    </div>

    <!-- Line Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:40px;">Sl.No</th>
          <th>Description</th>
          <th style="width:80px;">Price<br>(INR)</th>
          <th style="width:70px;">Quantity</th>
          <th style="width:70px;">Tax<br>Description</th>
          <th style="width:70px;">Tax %</th>
          <th style="width:90px;">Value</th>
          <th style="width:100px;">Amount Incl.<br>Tax (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
        <!-- Total Qty Row -->
        <tr style="font-weight:600; background:#f8f8f8;">
          <td colspan="3" style="border:1px solid #999; padding:6px; text-align:right; font-size:11px;">
            Total Qty:
          </td>
          <td colspan="1" style="border:1px solid #999; padding:6px; text-align:center; font-size:11px;">
            ${totalQtyHtml}
          </td>
          <td colspan="2" style="border:1px solid #999; padding:4px; text-align:right; font-weight:600; font-size:12px;">
            Tax Breakup Details
          </td>
          <td colspan="2" style="border:1px solid #999;"></td>
        </tr>
        ${taxBreakupHtml}
      </tbody>
    </table>

    <!-- Grand Total -->
    <div class="grand-total-row">
      <span>Grand Total (INR)</span>
      <span style="font-size:16px;">₹ ${formatCurrency(gst.grandTotal)}</span>
    </div>

    <!-- Amount in Words -->
    <div class="amount-words">
      <strong>Amount in Words :</strong> ${amountInWords}
    </div>

    <!-- Terms & Conditions -->
    ${termsContent ? `
    <div class="terms-section">
      <h4>TERMS & CONDITIONS :</h4>
      <div class="terms-content">${termsContent}</div>
    </div>
    ` : ''}

    <!-- Remarks -->
    ${po.remarks ? `
    <div class="note-section">
      <strong>Remarks:</strong> ${po.remarks}
    </div>
    ` : ''}

    <!-- Note -->
    <div class="note-section">
      NOTE: For any Grievance/Queries related, Please Email to ${org?.email || 'support@company.com'}
    </div>

    <!-- For Company -->
    <div class="for-company">For &nbsp;${companyName}</div>

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="name">${po.createdByName || ''}</div>
        <div class="role">Prepared By</div>
      </div>
      <div class="signature-box">
        <div class="name">&nbsp;</div>
        <div class="role">Checked By</div>
      </div>
      <div class="signature-box">
        <div class="name">&nbsp;</div>
        <div class="role">Approved By</div>
      </div>
      <div class="signature-box">
        <div class="name">&nbsp;</div>
        <div class="role">Authorised Signatory</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="footer-note">
      NOTE: THIS IS A COMPUTER GENERATED REPORT HENCE NO SIGNATURE IS REQUIRED.
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
 * @param {Object} [options.organisation] - Pre-fetched org info (skips API call)
 * @param {string} [options.termsContent] - Pre-fetched T&C HTML content (skips API call)
 * @param {Object} [options.supplier] - Pre-fetched supplier info (skips API call)
 * @param {string} [options.poCategory] - Pre-fetched PO category label (skips item lookup)
 */
export const generatePOPdf = async (poData, options = {}) => {
  if (!poData) {
    console.error('PO data is required for PDF generation');
    return;
  }

  try {
    // Fetch organisation info, supplier details, and item categories in parallel
    const [orgResult, supplierResult, itemsResult] = await Promise.allSettled([
      // Organisation info
      options.organisation
        ? Promise.resolve(options.organisation)
        : getActiveOrganisation()
            .then((res) => res?.data || res || {})
            .catch((err) => { console.warn('Failed to fetch organisation info:', err); return {}; }),

      // Supplier details
      options.supplier
        ? Promise.resolve(options.supplier)
        : poData.supplierId
          ? getSupplierById(poData.supplierId)
              .then((res) => res?.data || res || {})
              .catch((err) => { console.warn('Failed to fetch supplier details:', err); return {}; })
          : Promise.resolve({}),

      // Item details for category
      options.poCategory
        ? Promise.resolve(null)
        : (() => {
            const itemIds = [...new Set((poData.lineItems || []).map((li) => li.itemId).filter(Boolean))];
            if (itemIds.length === 0) return Promise.resolve(null);
            return getItemsByIds(itemIds)
              .then((res) => res?.data || res || [])
              .catch((err) => { console.warn('Failed to fetch items for category:', err); return []; });
          })(),
    ]);

    const org = orgResult.status === 'fulfilled' ? orgResult.value : {};
    const supplier = supplierResult.status === 'fulfilled' ? supplierResult.value : {};

    // Determine PO category from items
    let poCategory = options.poCategory || '';
    if (!poCategory && itemsResult.status === 'fulfilled' && Array.isArray(itemsResult.value) && itemsResult.value.length > 0) {
      const categoryNames = [...new Set(itemsResult.value.map((item) => item.categoryName).filter(Boolean))];
      if (categoryNames.length === 1) {
        poCategory = categoryNames[0];
      } else if (categoryNames.length > 1) {
        poCategory = 'Combined';
      }
    }
    if (!poCategory) poCategory = 'Combined';

    // Fetch terms & conditions content
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
    const html = buildPOHtml(poData, org, termsContent, supplier, poCategory);

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
