import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/organisationService';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * Order PDF Generator — Garment Export Order Confirmation
 * Clean, light-toned document design. Mild colors, ruled sections, no dark backgrounds.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val, decimals = 2) => {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');

const sym = (currency) => {
  const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'AED ', AUD: 'A$', CAD: 'C$', JPY: '¥' };
  return map[currency] || (currency ? currency + ' ' : '');
};

const fmtMoney = (val, currency) => `${sym(currency)}${fmt(val)}`;

const statusLabel = (s) => {
  const map = {
    DRAFT: 'Draft', CONFIRMED: 'Confirmed', REFERRED_BACK: 'Referred Back',
    IN_PRODUCTION: 'In Production', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  };
  return map[s] || (s || '').replace(/_/g, ' ');
};

const statusColors = (s) => {
  const map = {
    DRAFT:         { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
    CONFIRMED:     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    REFERRED_BACK: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
    IN_PRODUCTION: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
    COMPLETED:     { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' },
    CANCELLED:     { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  };
  return map[s] || map.DRAFT;
};

// ─── Field Row helper (label + value pairs in 2-col layout) ──────────────────

const fieldRow = (label, value) =>
  `<tr>
    <td class="fl">${label}</td>
    <td class="fv">${value || '—'}</td>
  </tr>`;

// ─── Size Matrix ──────────────────────────────────────────────────────────────

const buildSizeMatrix = (line, currency) => {
  const sizePrices = line.sizePrices || {};
  const colorRows  = line.colorRows  || [];
  const sizes      = Object.keys(sizePrices);

  if (sizes.length === 0)
    return '<p class="empty-note">No size data configured for this line.</p>';

  const colQty = {};
  const colVal = {};
  sizes.forEach((s) => { colQty[s] = 0; colVal[s] = 0; });
  colorRows.forEach((row) => {
    sizes.forEach((s) => {
      const q = row.quantities?.[s] || 0;
      colQty[s] += q;
      colVal[s] += q * (sizePrices[s] || 0);
    });
  });
  const grandQty = Object.values(colQty).reduce((a, b) => a + b, 0);
  const grandVal = Object.values(colVal).reduce((a, b) => a + b, 0);

  const headerCols = sizes.map((s) =>
    `<th class="m-sz">${s}</th>`
  ).join('');

  const priceRow = `
    <tr class="m-price-row">
      <td class="m-color-col"><span class="price-label">Unit Price</span><span class="price-ccy">${currency || ''}</span></td>
      ${sizes.map((s) => `<td class="m-sz-val m-price-val">${fmt(sizePrices[s] || 0)}</td>`).join('')}
      <td class="m-total-col"></td>
      <td class="m-value-col"></td>
    </tr>`;

  const colorHtml = colorRows.map((row, i) => `
    <tr class="${i % 2 === 0 ? 'm-row-a' : 'm-row-b'}">
      <td class="m-color-col">
        <span class="color-dot" style="background:${getColorHint(row.colorName)};"></span>
        ${row.colorName || '—'}
      </td>
      ${sizes.map((s) => {
        const q = row.quantities?.[s] || 0;
        return `<td class="m-sz-val">${q > 0 ? q : '<span class="m-zero">·</span>'}</td>`;
      }).join('')}
      <td class="m-total-col">${(row.total || 0).toLocaleString()}</td>
      <td class="m-value-col">${fmtMoney(row.rowValue || 0, currency)}</td>
    </tr>`).join('');

  const totalsRow = `
    <tr class="m-totals-row">
      <td class="m-color-col"><strong>Total Qty</strong></td>
      ${sizes.map((s) => `<td class="m-sz-val m-total-sz">${colQty[s] > 0 ? `<strong>${colQty[s]}</strong>` : '<span class="m-zero">·</span>'}</td>`).join('')}
      <td class="m-total-col m-grand-qty"><strong>${grandQty.toLocaleString()}</strong></td>
      <td class="m-value-col m-grand-val"><strong>${fmtMoney(grandVal, currency)}</strong></td>
    </tr>`;

  return `
    <div class="matrix-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="m-color-h">Color / Print</th>
            ${headerCols}
            <th class="m-total-h">Total Pcs</th>
            <th class="m-value-h">Value</th>
          </tr>
        </thead>
        <tbody>
          ${priceRow}
          ${colorHtml}
          ${totalsRow}
        </tbody>
      </table>
    </div>`;
};

// Derive a very light color hint from the color name (purely decorative dot)
const getColorHint = (name) => {
  if (!name) return '#e2e8f0';
  const n = name.toLowerCase();
  if (n.includes('red'))    return '#fca5a5';
  if (n.includes('blue'))   return '#93c5fd';
  if (n.includes('green'))  return '#86efac';
  if (n.includes('yellow') || n.includes('gold')) return '#fde68a';
  if (n.includes('orange')) return '#fdba74';
  if (n.includes('pink'))   return '#f9a8d4';
  if (n.includes('purple') || n.includes('violet')) return '#c4b5fd';
  if (n.includes('white'))  return '#f1f5f9';
  if (n.includes('black') || n.includes('navy')) return '#94a3b8';
  if (n.includes('grey') || n.includes('gray')) return '#cbd5e1';
  if (n.includes('brown') || n.includes('khaki')) return '#d6b896';
  return '#e2e8f0';
};

// ─── Order Lines ──────────────────────────────────────────────────────────────

const buildOrderLinesHtml = (orderLines, currency) => {
  if (!orderLines?.length)
    return '<p class="empty-note">No order lines.</p>';

  return orderLines.map((line, idx) => `
    <div class="line-card">
      <div class="line-card-header">
        <div class="line-index">Line ${idx + 1}</div>
        <div class="line-tags">
          ${line.buyerPoNo    ? `<span class="ltag ltag-po">PO: ${line.buyerPoNo}</span>` : ''}
          ${line.destination  ? `<span class="ltag ltag-dest">${line.destination}</span>` : ''}
          ${line.dispatchDate ? `<span class="ltag ltag-date">Dispatch: ${fmtDate(line.dispatchDate)}</span>` : ''}
          ${line.leadTime != null ? `<span class="ltag ltag-lead">Lead: ${line.leadTime} days</span>` : ''}
        </div>
        <div class="line-totals-chip">
          <span class="lchip-qty">${(line.lineQty || 0).toLocaleString()} pcs</span>
          <span class="lchip-sep">|</span>
          <span class="lchip-val">${fmtMoney(line.lineTotal || 0, currency)}</span>
        </div>
      </div>
      <div class="line-card-body">
        ${buildSizeMatrix(line, currency)}
      </div>
    </div>`).join('');
};

// ─── Full HTML ────────────────────────────────────────────────────────────────

const buildOrderHtml = (order, org) => {
  const companyName  = org?.organisationName || 'Company Name';
  const currency     = order.currency || '';
  const sc           = statusColors(order.status);
  const currSym      = sym(currency);

  // Assortment — one row per order line
  const assortRows = (order.orderLines || []).map((line, i) => {
    const qty   = line.lineQty   || 0;
    const value = line.lineTotal || 0;
    return `
    <tr class="${i % 2 === 0 ? 'ar-a' : 'ar-b'}">
      <td class="a-c" style="color:#64748b;">${i + 1}</td>
      <td class="a-po">${line.buyerPoNo || '—'}</td>
      <td class="a-dest">${line.destination || '—'}</td>
      <td class="a-r">${qty.toLocaleString()}</td>
      <td class="a-r">${qty > 0 ? fmtMoney(value / qty, currency) : '—'}</td>
      <td class="a-r a-val">${fmtMoney(value, currency)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order ${order.orderNo || ''}</title>
  <style>
    /* ── Reset & Base ── */
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size:A4; margin:10mm 10mm 12mm 10mm; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9px; color: #374151; line-height: 1.45;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Watermark ── */
    .wm {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%,-50%) rotate(-30deg);
      font-size: 80px; font-weight: 900;
      color: rgba(99,102,241,0.035);
      white-space: nowrap; pointer-events: none;
      z-index: 0; letter-spacing: 10px; text-transform: uppercase;
    }
    .pg { position: relative; z-index: 1; }

    /* ── Top accent bar ── */
    .top-bar {
      height: 4px;
      background: linear-gradient(90deg, #a5b4fc 0%, #6366f1 40%, #818cf8 70%, #c7d2fe 100%);
      border-radius: 2px 2px 0 0;
      margin-bottom: 0;
    }

    /* ── Document Header ── */
    .doc-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 14px 16px 12px;
      border: 1px solid #e2e8f0; border-top: none;
      background: #fff;
    }
    .dh-left { display: flex; align-items: flex-start; gap: 12px; }
    .logo-wrap {
      width: 56px; height: 56px; flex-shrink: 0;
      border: 1px solid #e2e8f0; border-radius: 6px;
      overflow: hidden; display: flex; align-items: center; justify-content: center;
      background: #f8fafc;
    }
    .logo-wrap img { max-width: 48px; max-height: 48px; object-fit: contain; }
    .co-name { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
    .co-detail { font-size: 7.5px; color: #64748b; line-height: 1.5; }
    .dh-right { text-align: right; }
    .doc-type-lbl {
      font-size: 7px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1.5px; color: #6366f1; margin-bottom: 4px;
    }
    .doc-no { font-size: 18px; font-weight: 800; color: #1e293b; letter-spacing: 0.3px; }
    .doc-status {
      display: inline-block; margin-top: 5px;
      padding: 2px 10px; border-radius: 20px;
      font-size: 8px; font-weight: 600; letter-spacing: 0.3px;
      background: ${sc.bg}; color: ${sc.text}; border: 1px solid ${sc.border};
    }
    .doc-date { font-size: 8px; color: #64748b; margin-top: 4px; }

    /* ── Section divider ── */
    .sec-rule {
      display: flex; align-items: center; gap: 8px;
      margin: 10px 0 6px;
    }
    .sec-rule .sec-label {
      font-size: 7.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: #6366f1; white-space: nowrap;
    }
    .sec-rule .sec-line {
      flex: 1; height: 1px; background: #e0e7ff;
    }

    /* ── Info grid (2-col field table) ── */
    .info-grid { display: flex; gap: 10px; }
    .info-panel {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 4px;
      overflow: hidden;
    }
    .info-panel-head {
      background: #f8fafc; padding: 4px 10px;
      font-size: 7px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: #6366f1; border-bottom: 1px solid #e2e8f0;
    }
    .field-table { width: 100%; border-collapse: collapse; }
    .field-table td { padding: 3px 10px; }
    .fl { color: #64748b; font-size: 7.5px; width: 36%; white-space: nowrap; }
    .fv { color: #1e293b; font-size: 8px; font-weight: 500; }
    .field-table tr + tr td { border-top: 1px solid #f1f5f9; }

    /* ── Specs strip ── */
    .specs-strip {
      display: flex; border: 1px solid #e2e8f0; border-radius: 4px;
      overflow: hidden; margin-top: 0;
    }
    .spec-cell {
      flex: 1; padding: 6px 8px; text-align: center;
      border-right: 1px solid #e2e8f0; background: #fafbff;
    }
    .spec-cell:last-child { border-right: none; }
    .spec-lbl { font-size: 6.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 2px; }
    .spec-val { font-size: 9px; font-weight: 600; color: #1e293b; }

    /* ── Components table ── */
    .comp-tbl { width: 100%; border-collapse: collapse; font-size: 8px; }
    .comp-tbl th {
      background: #f0f4ff; color: #4338ca;
      padding: 4px 8px; font-size: 7.5px; font-weight: 700;
      text-align: left; border-bottom: 1px solid #c7d2fe;
    }
    .comp-tbl td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
    .comp-tbl tbody tr:last-child td { border-bottom: none; }

    /* ── Assortment table ── */
    .assort-wrap { border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
    .assort-tbl { width: 100%; border-collapse: collapse; font-size: 8px; }
    .assort-tbl th {
      background: #f0f4ff; color: #4338ca;
      padding: 5px 8px; font-size: 7.5px; font-weight: 700;
      border-bottom: 1px solid #c7d2fe;
    }
    .assort-tbl td { padding: 4px 8px; }
    .assort-tbl .ar-a td { background: #fafafa; }
    .assort-tbl .ar-b td { background: #fff; }
    .assort-tbl .a-dest { color: #475569; }
    .assort-tbl .a-po  { color: #1e293b; font-weight: 600; font-family: monospace; font-size: 7.5px; }
    .a-c { text-align: center; }
    .a-r { text-align: right; font-family: monospace; }
    .a-val { color: #4338ca; font-weight: 600; }
    .assort-tbl tfoot td {
      background: #eef2ff; border-top: 1px solid #c7d2fe;
      font-weight: 700; font-size: 8.5px; color: #3730a3;
    }

    /* ── Order Line Cards ── */
    .line-card {
      border: 1px solid #e2e8f0; border-radius: 6px;
      margin-bottom: 8px; overflow: hidden;
      page-break-inside: avoid;
    }
    .line-card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; background: #fafbff;
      border-bottom: 1px solid #e2e8f0; flex-wrap: wrap;
    }
    .line-index {
      font-size: 7.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #6366f1;
      background: #eef2ff; padding: 2px 8px;
      border-radius: 20px; border: 1px solid #c7d2fe;
      white-space: nowrap; flex-shrink: 0;
    }
    .line-tags { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
    .ltag {
      font-size: 7.5px; padding: 2px 7px; border-radius: 3px;
      white-space: nowrap;
    }
    .ltag-po   { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .ltag-dest { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .ltag-date { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .ltag-lead { background: #fdf4ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .line-totals-chip {
      margin-left: auto; white-space: nowrap; flex-shrink: 0;
      font-size: 8.5px; display: flex; align-items: center; gap: 5px;
    }
    .lchip-qty  { color: #374151; font-weight: 600; }
    .lchip-sep  { color: #cbd5e1; }
    .lchip-val  { color: #4338ca; font-weight: 700; }
    .line-card-body { padding: 6px; background: #fff; }

    /* ── Size Matrix ── */
    .matrix-wrap { overflow-x: auto; }
    .matrix-table {
      width: 100%; border-collapse: collapse;
      font-size: 7.5px; min-width: 380px;
    }
    .matrix-table thead th {
      background: #f0f4ff; color: #4338ca;
      padding: 4px 5px; font-weight: 700;
      border: 1px solid #c7d2fe;
    }
    .m-color-h  { text-align: left; padding-left: 8px !important; min-width: 88px; }
    .m-sz       { text-align: center; min-width: 34px; }
    .m-total-h  { text-align: right; min-width: 52px; }
    .m-value-h  { text-align: right; min-width: 70px; }
    .matrix-table td { border: 1px solid #e9ecef; padding: 3px 5px; vertical-align: middle; }
    .m-color-col {
      text-align: left; padding-left: 8px !important;
      white-space: nowrap; display: flex; align-items: center; gap: 5px;
    }
    .color-dot {
      display: inline-block; width: 8px; height: 8px;
      border-radius: 50%; flex-shrink: 0;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .m-sz-val { text-align: center; font-family: monospace; }
    .m-total-col { text-align: right; font-family: monospace; }
    .m-value-col { text-align: right; font-family: monospace; }
    .m-price-row td { background: #f8fbff; }
    .price-label { color: #4338ca; font-weight: 600; margin-right: 4px; }
    .price-ccy   { color: #94a3b8; font-size: 7px; }
    .m-price-val { color: #1d4ed8; font-weight: 600; }
    .m-row-a td  { background: #fafafa; }
    .m-row-b td  { background: #fff; }
    .m-totals-row td { background: #f0fdf4; }
    .m-total-sz  { color: #374151; }
    .m-grand-qty { color: #15803d; }
    .m-grand-val { color: #15803d; }
    .m-zero      { color: #d1d5db; }

    /* ── Totals Row ── */
    .bottom-row { display: flex; gap: 10px; align-items: flex-start; margin-top: 0; }
    .totals-panel {
      width: 240px; flex-shrink: 0;
      border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;
    }
    .tot-row {
      display: flex; justify-content: space-between;
      padding: 5px 10px; font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .tot-row:last-child { border-bottom: none; }
    .tot-row .tl { color: #64748b; }
    .tot-row .tv { font-weight: 600; font-family: monospace; color: #1e293b; }
    .tot-grand {
      background: #eef2ff; border-top: 2px solid #c7d2fe !important;
    }
    .tot-grand .tl { color: #4338ca; font-weight: 700; font-size: 9px; }
    .tot-grand .tv { color: #3730a3; font-size: 10px; font-weight: 800; }

    /* ── Remarks / Refer-back ── */
    .remarks-panel {
      flex: 1; border: 1px solid #fde68a;
      border-radius: 4px; padding: 8px 10px;
      background: #fffdf0; font-size: 8px; line-height: 1.6; color: #713f12;
    }
    .remarks-panel .r-head {
      font-size: 7px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #b45309; margin-bottom: 4px;
    }
    .refer-back-panel {
      border: 1px solid #fdba74; border-radius: 4px;
      padding: 6px 10px; background: #fff7ed;
      font-size: 8px; color: #7c2d12; margin-top: 8px;
    }
    .refer-back-panel strong { color: #ea580c; }

    /* ── Signatures ── */
    .sig-row {
      display: flex; justify-content: space-between;
      margin-top: 16px; padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-space { height: 30px; }
    .sig-line {
      width: 90px; border-bottom: 1px solid #94a3b8;
      margin: 0 auto 4px;
    }
    .sig-role {
      font-size: 7px; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* ── Footer ── */
    .doc-foot {
      margin-top: 10px; padding: 6px;
      background: #fafbff; border: 1px solid #e0e7ff;
      border-radius: 4px; text-align: center;
      font-size: 7px; color: #6366f1; letter-spacing: 0.5px;
    }
    .doc-foot-note { font-size: 7px; color: #94a3b8; text-align: center; margin-top: 3px; }

    .empty-note { font-size: 8px; color: #94a3b8; font-style: italic; padding: 6px 4px; }

    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="wm">${companyName}</div>
  <div class="pg">

    <!-- ── Top accent bar ── -->
    <div class="top-bar"></div>

    <!-- ── Document Header ── -->
    <div class="doc-head">
      <div class="dh-left">
        <div class="logo-wrap">
          <img src="${sristiLogo}" alt="Logo" />
        </div>
        <div>
          <div class="co-name">${companyName}</div>
          <div class="co-detail">
            ${[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ') || ''}<br>
            ${[org?.city, org?.state].filter(Boolean).join(', ')}${org?.pincode ? ' – ' + org.pincode : ''}<br>
            ${org?.phone ? 'Tel: ' + org.phone : ''}${org?.email ? (org.phone ? ' &nbsp;|&nbsp; ' : '') + org.email : ''}
          </div>
        </div>
      </div>
      <div class="dh-right">
        <div class="doc-type-lbl">Order Confirmation</div>
        <div class="doc-no">${order.orderNo || ''}</div>
        <div><span class="doc-status">${statusLabel(order.status)}</span></div>
        <div class="doc-date">${fmtDate(order.orderDate)}</div>
      </div>
    </div>

    <!-- ── Buyer & Reference ── -->
    <div class="sec-rule"><span class="sec-label">Buyer &amp; Reference</span><span class="sec-line"></span></div>
    <div class="info-grid">
      <div class="info-panel">
        <div class="info-panel-head">Buyer</div>
        <table class="field-table">
          ${fieldRow('Name', `<strong>${order.buyerName || '—'}</strong>`)}
          ${fieldRow('Payment Terms', order.paymentTermsName)}
          ${fieldRow('Payment Days', order.paymentDays ? order.paymentDays + ' days' : null)}
        </table>
      </div>
      <div class="info-panel">
        <div class="info-panel-head">Reference</div>
        <table class="field-table">
          ${fieldRow('Costing Ref', order.costingId ? `<span style="font-family:monospace;color:#4338ca;">${order.costingId}</span>` : null)}
          ${fieldRow('Order Date', fmtDate(order.orderDate))}
          ${fieldRow('Total Lines', (order.orderLines || []).length)}
          ${fieldRow('Total Quantity', `<strong>${(order.totalOrderQty || 0).toLocaleString()} pcs</strong>`)}
        </table>
      </div>
    </div>

    <!-- ── Order Specs ── -->
    <div class="sec-rule" style="margin-top:8px;"><span class="sec-label">Order Specifications</span><span class="sec-line"></span></div>
    <div class="specs-strip">
      <div class="spec-cell"><div class="spec-lbl">Style No</div><div class="spec-val">${order.styleNo || '—'}</div></div>
      <div class="spec-cell"><div class="spec-lbl">Garment Type</div><div class="spec-val">${order.garmentType || '—'}</div></div>
      <div class="spec-cell"><div class="spec-lbl">Season</div><div class="spec-val">${order.season || '—'}</div></div>
      <div class="spec-cell"><div class="spec-lbl">Component</div><div class="spec-val">${order.component || '—'}</div></div>
      <div class="spec-cell"><div class="spec-lbl">Currency</div><div class="spec-val">${order.currency || '—'}</div></div>
    </div>

    ${order.component === 'Multiple' && order.components?.length ? `
    <!-- ── Components ── -->
    <div class="sec-rule" style="margin-top:8px;"><span class="sec-label">Components</span><span class="sec-line"></span></div>
    <table class="comp-tbl">
      <thead><tr><th>Component</th><th>Description</th><th style="width:80px;text-align:center;">Qty / Set</th></tr></thead>
      <tbody>
        ${order.components.map((c) => `
        <tr>
          <td><strong>${c.name || '—'}</strong></td>
          <td>${c.description || '—'}</td>
          <td style="text-align:center;">${c.qtyPerSet ?? c.qty ?? '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <!-- ── Assortment Summary ── -->
    <div class="sec-rule" style="margin-top:8px;"><span class="sec-label">Assortment Summary</span><span class="sec-line"></span></div>
    <div class="assort-wrap">
      <table class="assort-tbl">
        <thead>
          <tr>
            <th class="a-c" style="width:28px;">#</th>
            <th style="width:90px;text-align:left;">Buyer PO No</th>
            <th style="text-align:left;">Destination</th>
            <th class="a-r" style="width:80px;">Total Qty</th>
            <th class="a-r" style="width:80px;">Avg Price</th>
            <th class="a-r" style="width:90px;">Total Value</th>
          </tr>
        </thead>
        <tbody>${assortRows || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:8px;font-style:italic;">No lines</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="3"><strong>Grand Total</strong></td>
            <td class="a-r"><strong>${(order.totalOrderQty || 0).toLocaleString()} pcs</strong></td>
            <td class="a-r"></td>
            <td class="a-r"><strong>${fmtMoney(order.totalOrderValue || 0, currency)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ── Order Lines ── -->
    <div class="sec-rule" style="margin-top:8px;"><span class="sec-label">Order Lines &amp; Size Breakdown</span><span class="sec-line"></span></div>
    ${buildOrderLinesHtml(order.orderLines, currency)}

    <!-- ── Totals + Remarks ── -->
    <div class="sec-rule" style="margin-top:4px;"><span class="sec-label">Summary</span><span class="sec-line"></span></div>
    <div class="bottom-row">
      ${order.remarks ? `
      <div class="remarks-panel">
        <div class="r-head">Remarks</div>
        ${order.remarks}
      </div>` : '<div style="flex:1;"></div>'}
      <div class="totals-panel">
        <div class="tot-row">
          <span class="tl">Total Lines</span>
          <span class="tv">${(order.orderLines || []).length}</span>
        </div>
        <div class="tot-row">
          <span class="tl">Total Quantity</span>
          <span class="tv">${(order.totalOrderQty || 0).toLocaleString()} pcs</span>
        </div>
        <div class="tot-row tot-grand">
          <span class="tl">Order Value</span>
          <span class="tv">${fmtMoney(order.totalOrderValue || 0, currency)}</span>
        </div>
      </div>
    </div>

    ${order.referBackReason ? `
    <div class="refer-back-panel">
      <strong>Refer Back Reason: </strong>${order.referBackReason}
    </div>` : ''}

    <!-- ── Signatures ── -->
    <div class="sig-row">
      <div class="sig-box"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-role">Prepared By</div></div>
      <div class="sig-box"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-role">Merchandiser</div></div>
      <div class="sig-box"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-role">Authorised Signatory</div></div>
    </div>

    <!-- ── Footer ── -->
    <div class="doc-foot">COMPUTER GENERATED DOCUMENT — ${order.orderNo || ''} — ${fmtDate(order.orderDate)}</div>
    ${org?.email ? `<div class="doc-foot-note">For queries: ${org.email}</div>` : ''}

  </div>
</body>
</html>`;
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const generateOrderPdf = async (orderData) => {
  if (!orderData) return;
  try {
    let org = getCachedOrganisation();
    if (!org) org = await fetchAndCacheOrganisation();

    const html = buildOrderHtml(orderData, org || {});

    const w = window.open('', '_blank');
    if (!w) { console.error('Pop-up blocked'); return; }

    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 500);
    setTimeout(() => { try { w.print(); } catch { /* closed */ } }, 2000);
  } catch (err) {
    console.error('Order PDF generation failed:', err);
    throw err;
  }
};

export default { generateOrderPdf };
