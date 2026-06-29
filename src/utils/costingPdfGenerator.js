import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { getCurrencySymbol } from './orderConstants';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * Costing Sheet PDF Generator - Garments Manufacturing Industry Format
 * Generates a professional, printable cost sheet document.
 *
 * Sections: Header, General Details, Fabric Breakup, Trims (Local + Imported),
 * Manufacturing, Overhead/Markup, Cost Summary, Per-Size Breakdown, Signatures.
 *
 * Usage:
 *   import { generateCostingPdf } from '../utils/costingPdfGenerator';
 *   generateCostingPdf(costSheetData);
 */

// ─── Format Helpers ────────────────────────────────────────────────────────────

const fmt = (val, currency = 'INR') => {
  const num = parseFloat(val) || 0;
  const sym = getCurrencySymbol(currency) || '';
  return `${sym} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val, decimals = 2) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD-MMM-YYYY');
};

const esc = (str) => {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const getStatusLabel = (status) => {
  const labels = { Draft: 'Draft', Final: 'Final', Approved: 'Approved' };
  return labels[status] || status || '';
};

const getStatusColor = (status) => {
  const colors = { Draft: '#64748b', Final: '#3b82f6', Approved: '#10b981' };
  return colors[status] || '#64748b';
};

// ─── Build HTML ────────────────────────────────────────────────────────────────

const buildCostingHtml = (cs, org) => {
  const companyName = org?.organisationName || 'Company Name';
  const costingId = cs.costingId || '';
  const currency = cs.currency || 'INR';
  const quoteCurrency = cs.quoteCurrency || 'USD';
  const statusColor = getStatusColor(cs.status);

  // ── Fabric rows ──
  const fabricRows = (cs.fabricRows || []);
  let fabricHtml = '';
  fabricRows.forEach((row, idx) => {
    fabricHtml += `<tr>
      <td class="center">${idx + 1}</td>
      <td>${esc(row.sizes) || '-'}</td>
      <td>${esc(row.fabricType)}</td>
      <td class="center">${esc(row.classification)}</td>
      <td>${esc(row.description) || '-'}</td>
      <td class="num">${row.consumption != null ? `${fmtNum(row.consumption, 4)} ${(row.uomSymbol || row.uom || row.uomName || '').toUpperCase()}`.trim() : '-'}</td>
      <td class="num">${fmtNum(row.fabricPrice)}</td>
      <td class="center">${row.fabricWidthStd || '-'}</td>
      <td class="center">${row.fabricWidthVendor || '-'}</td>
      <td>${esc(row.vendorName) || '-'}</td>
      <td class="num">${row.allowancePct || 0}%</td>
      <td class="num highlight-cell">${fmtNum(row.netCost)}</td>
    </tr>`;
  });

  // ── Local trims rows ──
  const localTrims = (cs.localTrims || []);
  let localTrimsHtml = '';
  localTrims.forEach((row, idx) => {
    localTrimsHtml += `<tr>
      <td class="center">${idx + 1}</td>
      <td>${esc(row.sizes) || '-'}</td>
      <td>${esc(row.item)}</td>
      <td>${esc(row.code) || '-'}</td>
      <td class="center">${esc(row.size) || '-'}</td>
      <td class="num">${row.consumption != null ? `${fmtNum(row.consumption)} ${(row.uom || '').toUpperCase()}`.trim() : '-'}</td>
      <td class="num">${fmtNum(row.cost)}</td>
      <td class="num highlight-cell">${fmtNum(row.price)}</td>
    </tr>`;
  });

  // ── Imported trims rows ──
  const importedTrims = (cs.importedTrims || []);
  let importedTrimsHtml = '';
  importedTrims.forEach((row, idx) => {
    importedTrimsHtml += `<tr>
      <td class="center">${idx + 1}</td>
      <td>${esc(row.sizes) || '-'}</td>
      <td>${esc(row.item)}</td>
      <td>${esc(row.code) || '-'}</td>
      <td class="center">${esc(row.size) || '-'}</td>
      <td class="num">${row.consumption != null ? `${fmtNum(row.consumption)} ${(row.uom || '').toUpperCase()}`.trim() : '-'}</td>
      <td class="num">${fmtNum(row.costUsd)}</td>
      <td class="num highlight-cell">${fmtNum(row.priceUsd)}</td>
    </tr>`;
  });

  // ── Manufacturing rows ──
  const mfgRows = (cs.manufacturingRows || []);
  let mfgHtml = '';
  mfgRows.forEach((row, idx) => {
    mfgHtml += `<tr>
      <td class="center">${idx + 1}</td>
      <td>${esc(row.sizes) || '-'}</td>
      <td>${esc(row.process)}</td>
      <td class="num highlight-cell">${fmtNum(row.cost)}</td>
      <td>${esc(row.comments) || '-'}</td>
    </tr>`;
  });

  // ── Overhead rows ──
  const overheadRows = (cs.overheadRows || []);
  let overheadHtml = '';
  overheadRows.forEach((row, idx) => {
    overheadHtml += `<tr>
      <td class="center">${idx + 1}</td>
      <td>${esc(row.sizes) || '-'}</td>
      <td>${esc(row.description)}</td>
      <td class="num highlight-cell">${fmtNum(row.cost)}</td>
      <td>${esc(row.comments) || '-'}</td>
    </tr>`;
  });

  // ── Per-size breakdown ──
  const sizeSummaries = cs.sizeSummaries || [];
  let perSizeHtml = '';
  if (sizeSummaries.length > 0) {
    const colWidth = Math.max(80, Math.floor(600 / sizeSummaries.length));
    perSizeHtml = `
    <div class="section-block" style="margin-top:10px;">
      <div class="section-title" style="background:#3b82f6;color:white;">Per-Size Breakdown</div>
      <table class="data-table" style="font-size:7.5px;">
        <thead>
          <tr>
            <th style="width:140px;text-align:left;">Cost Component</th>
            ${sizeSummaries.map(ss => `<th style="width:${colWidth}px;">${esc(ss.sizes)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Fabric Cost</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.totalFabricCost)}</td>`).join('')}
          </tr>
          <tr>
            <td>Accessories Cost</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.totalAccessoriesCost)}</td>`).join('')}
          </tr>
          <tr>
            <td>Manufacturing Cost</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.totalManufacturingCost)}</td>`).join('')}
          </tr>
          <tr>
            <td>Markup / Overhead</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.totalMarkupCost)}</td>`).join('')}
          </tr>
          <tr class="subtotal-row">
            <td><strong>Total Making Price</strong></td>
            ${sizeSummaries.map(ss => `<td class="num"><strong>${fmtNum(ss.totalMakingPrice)}</strong></td>`).join('')}
          </tr>
          <tr>
            <td>Agent Commission %</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.agentCommissionPct)}%</td>`).join('')}
          </tr>
          <tr>
            <td>Profit %</td>
            ${sizeSummaries.map(ss => `<td class="num">${fmtNum(ss.profitPct)}%</td>`).join('')}
          </tr>
          <tr class="subtotal-row">
            <td><strong>Total Price (${esc(currency)})</strong></td>
            ${sizeSummaries.map(ss => `<td class="num"><strong>${fmtNum(ss.totalPrice)}</strong></td>`).join('')}
          </tr>
          <tr class="grand-total-row">
            <td><strong>Final Price (USD)</strong></td>
            ${sizeSummaries.map(ss => `<td class="num"><strong>$ ${fmtNum(ss.finalPriceUsd)}</strong></td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>`;
  }

  // ── Final price display ──
  const finalPriceUsd = cs.finalPriceUsd || (cs.quoteCurrency === 'USD' ? cs.finalPrice : 0);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cost Sheet ${costingId} - ${esc(cs.buyerName)} - ${esc(cs.styleNo)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 8mm 6mm 10mm 6mm; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      font-size: 8.5px;
      color: #1a1a1a;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }

    /* Watermark */
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

    /* Header */
    .header-section {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      padding: 10px 14px;
      border-radius: 6px 6px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .company-info { flex: 1; }
    .company-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
    .company-details { font-size: 7.5px; opacity: 0.9; line-height: 1.4; }
    .logo-box {
      width: 60px; height: 60px;
      background: white; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      margin-right: 10px;
    }
    .logo-box img { max-width: 50px; max-height: 50px; object-fit: contain; }
    .cs-badge { text-align: right; padding-left: 16px; }
    .cs-badge .cs-label { font-size: 7px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
    .cs-badge .cs-number { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
    .cs-badge .cs-status {
      display: inline-block;
      background: ${statusColor};
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 8px;
      font-weight: 600;
      margin-top: 3px;
      color: white;
    }

    /* General Details Grid */
    .details-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 1px;
      background: #e2e8f0;
      border: 1px solid #e2e8f0;
      border-radius: 0 0 4px 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .detail-item { background: white; padding: 5px 8px; }
    .detail-item .label { font-size: 6.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
    .detail-item .value { font-size: 9px; font-weight: 600; color: #1e293b; margin-top: 1px; }
    .detail-item.span2 { grid-column: span 2; }

    /* Section blocks */
    .section-block { margin-bottom: 8px; }
    .section-title {
      font-size: 8.5px;
      font-weight: 700;
      color: white;
      padding: 4px 10px;
      border-radius: 4px 4px 0 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-title.fabric { background: #0ea5e9; }
    .section-title.local-trims { background: #8b5cf6; }
    .section-title.imported-trims { background: #a855f7; }
    .section-title.manufacturing { background: #f59e0b; }
    .section-title.overhead { background: #ef4444; }
    .section-title.summary { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }

    /* Data tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }
    .data-table th {
      background: #1e293b;
      color: white;
      padding: 4px 4px;
      text-align: center;
      font-weight: 600;
      font-size: 7px;
      white-space: nowrap;
    }
    .data-table th:first-child { text-align: center; }
    .data-table td {
      border: 1px solid #e2e8f0;
      padding: 3px 4px;
      vertical-align: top;
    }
    .data-table .center { text-align: center; }
    .data-table .num {
      text-align: right;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 8px;
    }
    .data-table .highlight-cell { background: #f0fdf4; font-weight: 600; }
    .data-table .total-row {
      background: #f1f5f9;
      font-weight: 700;
    }
    .data-table .total-row td { border-top: 2px solid #cbd5e1; }
    .data-table .subtotal-row { background: #f8fafc; }
    .data-table .subtotal-row td { border-top: 1px solid #94a3b8; }
    .data-table .grand-total-row {
      background: #6366f1;
      color: white;
    }
    .data-table .grand-total-row td { border-color: #6366f1; }
    .data-table .grand-total-row strong { color: white; }

    /* Summary section */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    .summary-left { }
    .summary-right { }

    .cost-breakdown-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }
    .cost-breakdown-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .cost-breakdown-table .cb-label { color: #475569; }
    .cost-breakdown-table .cb-value {
      text-align: right;
      font-weight: 600;
      font-family: monospace;
    }
    .cost-breakdown-table .cb-section {
      background: #f8fafc;
      font-weight: 700;
      color: #1e293b;
      border-top: 2px solid #cbd5e1;
    }
    .cost-breakdown-table .cb-highlight {
      background: #6366f1;
      color: white;
      font-weight: 700;
      font-size: 10px;
    }
    .cost-breakdown-table .cb-highlight td { color: white; border-color: #6366f1; }

    .final-prices {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .price-card {
      flex: 1;
      border: 2px solid;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    .price-card .pc-label { font-size: 8px; font-weight: 600; margin-bottom: 2px; }
    .price-card .pc-value { font-size: 20px; font-weight: 800; }
    .price-card.inr { border-color: #6366f1; }
    .price-card.inr .pc-label { color: #6366f1; }
    .price-card.inr .pc-value { color: #6366f1; }
    .price-card.quote { border-color: #10b981; }
    .price-card.quote .pc-label { color: #10b981; }
    .price-card.quote .pc-value { color: #10b981; }
    .price-card.usd { border-color: #3b82f6; }
    .price-card.usd .pc-label { color: #3b82f6; }
    .price-card.usd .pc-value { color: #3b82f6; }

    /* Signature */
    .signature-section {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-box { text-align: center; min-width: 120px; }
    .signature-box .line { width: 100px; height: 1px; background: #94a3b8; margin: 30px auto 5px; }
    .signature-box .role { font-size: 7px; color: #64748b; font-weight: 500; }

    /* Footer */
    .footer {
      margin-top: 8px;
      text-align: center;
      font-size: 7px;
      color: #6366f1;
      font-weight: 600;
      padding: 5px;
      background: #f0f4ff;
      border-radius: 4px;
    }
    .note-line {
      font-size: 7px;
      color: #64748b;
      text-align: center;
      margin-top: 4px;
    }

    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="watermark">${esc(companyName)}</div>
  <div class="page-content">

    <!-- ═══ HEADER ═══ -->
    <div class="header-section">
      <div style="display:flex;align-items:center;">
        <div class="logo-box">
          <img src="${sristiLogo}" alt="Logo" />
        </div>
        <div class="company-info">
          <div class="company-name">${esc(companyName)}</div>
          <div class="company-details">
            ${[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ')}<br>
            ${[org?.city, org?.state].filter(Boolean).join(', ')}${org?.pincode ? ' - ' + org.pincode : ''}<br>
            ${org?.phone ? 'Tel: ' + org.phone + ' | ' : ''}${org?.email ? 'Email: ' + org.email : ''}<br>
            ${org?.gstin ? 'GSTIN: ' + org.gstin : ''}${org?.pan ? ' | PAN: ' + org.pan : ''}${org?.cin ? ' | CIN: ' + org.cin : ''}
          </div>
        </div>
      </div>
      <div class="cs-badge">
        <div class="cs-label">Cost Sheet</div>
        <div class="cs-number">${esc(costingId)}</div>
        <div class="cs-status">${getStatusLabel(cs.status)}</div>
      </div>
    </div>

    <!-- ═══ GENERAL DETAILS ═══ -->
    <div class="details-grid">
      <div class="detail-item">
        <div class="label">Date</div>
        <div class="value">${fmtDate(cs.date)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Buyer</div>
        <div class="value">${esc(cs.buyerName)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Style #</div>
        <div class="value">${esc(cs.styleNo)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Garment Name</div>
        <div class="value">${esc(cs.garmentName)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Season</div>
        <div class="value">${esc(cs.season) || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="label">Sizes</div>
        <div class="value">${(cs.sizes || []).join(', ') || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="label">Costing Currency</div>
        <div class="value">${esc(currency)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Quote Currency</div>
        <div class="value">${esc(quoteCurrency)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Actual Rate</div>
        <div class="value">${cs.actualRate || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="label">Today's Rate</div>
        <div class="value">${cs.todaysRate || '-'}</div>
      </div>
      <div class="detail-item span2">
        <div class="label">USD to INR Rate</div>
        <div class="value">${cs.usdToInrRate || '83.80'}</div>
      </div>
    </div>

    <!-- ═══ SECTION A: FABRIC COST BREAKUP ═══ -->
    ${fabricRows.length > 0 ? `
    <div class="section-block">
      <div class="section-title fabric">Section A &mdash; Fabric Cost Breakup</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th>Sizes</th>
            <th>Fabric Type</th>
            <th>Class</th>
            <th>Description</th>
            <th style="width:80px;">Consumption</th>
            <th style="width:55px;">Price (${getCurrencySymbol(currency)})</th>
            <th style="width:42px;">Width Std</th>
            <th style="width:48px;">Width Vend</th>
            <th>Vendor</th>
            <th style="width:42px;">Allow %</th>
            <th style="width:65px;">Net Cost (${getCurrencySymbol(currency)})</th>
          </tr>
        </thead>
        <tbody>
          ${fabricHtml}
          <tr class="total-row">
            <td colspan="11" style="text-align:right;padding-right:8px;"><strong>Total Fabric Cost</strong></td>
            <td class="num"><strong>${fmtNum(cs.totalFabricCost)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- ═══ SECTION B: LOCAL TRIMS / ACCESSORIES ═══ -->
    ${localTrims.length > 0 ? `
    <div class="section-block">
      <div class="section-title local-trims">Section B &mdash; Local Trims / Accessories</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th>Sizes</th>
            <th>Item</th>
            <th>Code</th>
            <th style="width:50px;">Size</th>
            <th style="width:80px;">Consumption</th>
            <th style="width:60px;">Cost (${getCurrencySymbol(currency)})</th>
            <th style="width:65px;">Price (${getCurrencySymbol(currency)})</th>
          </tr>
        </thead>
        <tbody>
          ${localTrimsHtml}
          <tr class="total-row">
            <td colspan="7" style="text-align:right;padding-right:8px;"><strong>Total Local Trims</strong></td>
            <td class="num"><strong>${fmtNum(cs.totalLocalTrimsCost)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- ═══ SECTION C: IMPORTED TRIMS / ACCESSORIES ═══ -->
    ${importedTrims.length > 0 ? `
    <div class="section-block">
      <div class="section-title imported-trims">Section C &mdash; Imported Trims / Accessories (USD)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th>Sizes</th>
            <th>Item</th>
            <th>Code</th>
            <th style="width:50px;">Size</th>
            <th style="width:80px;">Consumption</th>
            <th style="width:60px;">Cost ($ USD)</th>
            <th style="width:65px;">Price ($ USD)</th>
          </tr>
        </thead>
        <tbody>
          ${importedTrimsHtml}
          <tr class="total-row">
            <td colspan="7" style="text-align:right;padding-right:8px;"><strong>Total Imported Trims (USD)</strong></td>
            <td class="num"><strong>$ ${fmtNum(cs.totalImportedTrimsCostUsd)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- ═══ SECTION D: MANUFACTURING COST ═══ -->
    ${mfgRows.length > 0 ? `
    <div class="section-block">
      <div class="section-title manufacturing">Section D &mdash; Manufacturing Cost</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th>Sizes</th>
            <th>Process</th>
            <th style="width:70px;">Cost (${getCurrencySymbol(currency)})</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${mfgHtml}
          <tr class="total-row">
            <td colspan="3" style="text-align:right;padding-right:8px;"><strong>Total Manufacturing Cost</strong></td>
            <td class="num"><strong>${fmtNum(cs.totalManufacturingCost)}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- ═══ SECTION E: OVERHEAD / MARKUP ═══ -->
    ${overheadRows.length > 0 ? `
    <div class="section-block">
      <div class="section-title overhead">Section E &mdash; Overhead / Markup</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:22px;">SN</th>
            <th>Sizes</th>
            <th>Description</th>
            <th style="width:70px;">Cost (${getCurrencySymbol(currency)})</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${overheadHtml}
          <tr class="total-row">
            <td colspan="3" style="text-align:right;padding-right:8px;"><strong>Total Markup Cost</strong></td>
            <td class="num"><strong>${fmtNum(cs.totalMarkupCost)}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- ═══ COST SUMMARY ═══ -->
    <div class="section-block">
      <div class="section-title summary">Cost Summary</div>
      <div class="summary-grid">
        <div class="summary-left">
          <table class="cost-breakdown-table" style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
            <tbody>
              <tr>
                <td class="cb-label" style="color:#0ea5e9;">Fabric Cost</td>
                <td class="cb-value">${fmt(cs.totalFabricCost, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label" style="color:#8b5cf6;">Trims / Accessories</td>
                <td class="cb-value">${fmt(cs.totalAccessoriesCost, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label" style="color:#f59e0b;">Manufacturing Cost</td>
                <td class="cb-value">${fmt(cs.totalManufacturingCost, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label" style="color:#ef4444;">Markup / Overhead Items</td>
                <td class="cb-value">${fmt(cs.totalMarkupCost, currency)}</td>
              </tr>
              <tr class="cb-section">
                <td>Total Making Price</td>
                <td class="cb-value">${fmt(cs.totalMakingPrice, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label">Agent Commission (${fmtNum(cs.agentCommissionPct)}%)</td>
                <td class="cb-value">${fmt((cs.agentCommissionPct / 100) * cs.totalMakingPrice, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label">Profit (${fmtNum(cs.profitPct)}%)</td>
                <td class="cb-value">${fmt((cs.profitPct / 100) * cs.totalMakingPrice, currency)}</td>
              </tr>
              <tr>
                <td class="cb-label">Total Overhead Charges</td>
                <td class="cb-value">${fmt(cs.totalOverheadCharges, currency)}</td>
              </tr>
              <tr class="cb-highlight">
                <td>Total Price</td>
                <td class="cb-value">${fmt(cs.totalPrice, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="summary-right">
          <div class="final-prices" style="flex-direction:column;">
            <div class="price-card inr">
              <div class="pc-label">Total Price (INR)</div>
              <div class="pc-value">${getCurrencySymbol('INR')} ${fmtNum(cs.totalPrice)}</div>
            </div>
            ${quoteCurrency !== 'INR' && quoteCurrency !== 'USD' ? `
            <div class="price-card quote">
              <div class="pc-label">Final Price (${esc(quoteCurrency)})</div>
              <div class="pc-value">${getCurrencySymbol(quoteCurrency)} ${fmtNum(cs.finalPrice)}</div>
            </div>` : ''}
            <div class="price-card usd">
              <div class="pc-label">Final Price (USD)</div>
              <div class="pc-value">$ ${fmtNum(finalPriceUsd)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ PER-SIZE BREAKDOWN ═══ -->
    ${perSizeHtml}

    <!-- ═══ SIGNATURES ═══ -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="line"></div>
        <div class="role">Prepared By</div>
      </div>
      <div class="signature-box">
        <div class="line"></div>
        <div class="role">Checked By</div>
      </div>
      <div class="signature-box">
        <div class="line"></div>
        <div class="role">Merchandiser</div>
      </div>
      <div class="signature-box">
        <div class="line"></div>
        <div class="role">Approved By</div>
      </div>
    </div>

    <!-- ═══ FOOTER ═══ -->
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
 * Generate and print Costing Sheet PDF.
 * Opens a new window with the formatted cost sheet and triggers the browser's print dialog.
 *
 * @param {Object} costSheetData - Full cost sheet object (from getCostSheetById)
 * @param {Object} [options] - Optional overrides
 * @param {Object} [options.organisation] - Pre-fetched org info (skips session lookup)
 */
export const generateCostingPdf = async (costSheetData, options = {}) => {
  if (!costSheetData) {
    console.error('Cost sheet data is required for PDF generation');
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

    // Build the HTML document
    const html = buildCostingHtml(costSheetData, org);

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
    console.error('Failed to generate costing PDF:', error);
    throw error;
  }
};

export { buildCostingHtml };
export default { generateCostingPdf, buildCostingHtml };
