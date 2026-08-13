import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * Issue Slip PDF Generator — Fabric & Accessories issue / gate pass document.
 *
 * Usage:
 *   import { generateFabricIssueSlipPdf, generateAccessoriesIssueSlipPdf } from '../utils/issueSlipPdfGenerator';
 *   await generateFabricIssueSlipPdf(record);
 *   await generateAccessoriesIssueSlipPdf(record);
 */

// ─── Format helpers ──────────────────────────────────────────────────────────

const formatNumber = (val, digits = 2) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
const formatDateTime = (d) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '—');

const escapeHtml = (v) => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const valueOrDash = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return escapeHtml(v);
};

// ─── Totals aggregation (per UoM) ────────────────────────────────────────────

const aggregateByUom = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    const u = r.uom || '';
    const prev = map.get(u) || 0;
    map.set(u, prev + (Number(r.qty) || 0));
  });
  return Array.from(map.entries()).map(([uom, qty]) => ({ uom, qty }));
};

// ─── Fabric rows builder ─────────────────────────────────────────────────────

const buildFabricRows = (issue) => {
  const uom = issue.uom || 'kg';
  return (issue.rolls || []).map((r, i) => ({
    sl: i + 1,
    primary: issue.fabric || 'Fabric',
    rollNumber: r.rollNumber || '—',
    shadeLot: r.shadeLot || '—',
    hsn: r.hsn || r.hsnCode || '—',
    qty: Number(r.issuedQty) || 0,
    uom,
  }));
};

// ─── Accessory rows builder ──────────────────────────────────────────────────

const buildAccessoryRows = (issue) =>
  (issue.items || []).map((it, i) => ({
    sl: i + 1,
    primary: it.variantName || it.description || it.variantCode || 'Item',
    itemCode: it.variantCode || '—',
    color: it.color || '',
    size: it.size || '',
    bomQty: Number(it.bomQty) || 0,
    qty: Number(it.issuedQty) || 0,
    uom: it.uom || '',
    lot: it.lot || it.lotNumber || '—',
    hsn: it.hsn || it.hsnCode || '—',
  }));

// ─── Items table HTML (fabric variant) ───────────────────────────────────────

const renderFabricItemsTable = (rows) => {
  const body = rows
    .map(
      (r) => `
    <tr>
      <td class="num">${r.sl}</td>
      <td class="desc">
        <div class="desc-main">${escapeHtml(r.primary)}</div>
        <div class="pill-row">
          <span class="pill">Roll ${escapeHtml(r.rollNumber)}</span>
          <span class="pill pill-muted">Shade · ${escapeHtml(r.shadeLot)}</span>
          ${r.hsn && r.hsn !== '—' ? `<span class="pill pill-muted">HSN ${escapeHtml(r.hsn)}</span>` : ''}
        </div>
      </td>
      <td class="num qty-cell">
        <span class="qty">${formatNumber(r.qty, 2)}</span>
        <span class="uom">${escapeHtml(r.uom)}</span>
      </td>
    </tr>`
    )
    .join('');

  return `
  <table class="items">
    <thead>
      <tr>
        <th style="width:42px">#</th>
        <th>Item Description</th>
        <th style="width:140px" class="num">Issued</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
};

// ─── Items table HTML (accessories variant) ──────────────────────────────────

const renderAccessoryItemsTable = (rows) => {
  const body = rows
    .map(
      (r) => `
    <tr>
      <td class="num">${r.sl}</td>
      <td class="desc">
        <div class="desc-main">${escapeHtml(r.primary)}</div>
        <div class="pill-row">
          <span class="pill">${escapeHtml(r.itemCode)}</span>
          ${r.color ? `<span class="pill pill-muted">Color · ${escapeHtml(r.color)}</span>` : ''}
          ${r.size ? `<span class="pill pill-muted">Size · ${escapeHtml(r.size)}</span>` : ''}
          ${r.lot && r.lot !== '—' ? `<span class="pill pill-muted">Lot · ${escapeHtml(r.lot)}</span>` : ''}
          ${r.hsn && r.hsn !== '—' ? `<span class="pill pill-muted">HSN ${escapeHtml(r.hsn)}</span>` : ''}
        </div>
      </td>
      <td class="num">${formatNumber(r.bomQty, 0)}</td>
      <td class="num qty-cell">
        <span class="qty">${formatNumber(r.qty, r.uom === 'cones' || r.uom === 'pcs' ? 0 : 2)}</span>
        <span class="uom">${escapeHtml(r.uom)}</span>
      </td>
    </tr>`
    )
    .join('');

  return `
  <table class="items">
    <thead>
      <tr>
        <th style="width:42px">#</th>
        <th>Item Description</th>
        <th style="width:100px" class="num">BOM Qty</th>
        <th style="width:150px" class="num">Issued</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
};

// ─── Derived labels / defaults ───────────────────────────────────────────────

const resolveTypeMeta = (type) => {
  if (type === 'fabric') {
    return {
      docTitle: 'Fabric Issue Slip',
      docSubtitle: 'Gate Pass · Delivery Note',
      accentLabel: 'Fabric',
      jobLabel: 'Cutting PO',
      processStage: 'Cutting',
      dispatchDept: 'Fabric Stores',
    };
  }
  return {
    docTitle: 'Accessories Issue Slip',
    docSubtitle: 'Gate Pass · Delivery Note',
    accentLabel: 'Trims & Accessories',
    jobLabel: 'Work Order',
    processStage: 'Production',
    dispatchDept: 'Trims Stores',
  };
};

// ─── Build full HTML document ────────────────────────────────────────────────

const buildHtml = (issue, type, rows, org) => {
  const meta = resolveTypeMeta(type);
  const isFabric = type === 'fabric';

  const companyName = org?.organisationName || 'Company Name';
  const cityState = [org?.city, org?.state].filter(Boolean).join(', ');
  const cityStatePin = cityState + (org?.pincode ? (cityState ? ' - ' : '') + org.pincode : '');
  const addressLine1 = [org?.addressLine1, org?.addressLine2].filter(Boolean).join(', ');
  const companyPhone = org?.phone || '';
  const companyEmail = org?.email || '';
  const orgGstin = org?.gstin || '';
  const orgPan = org?.pan || '';

  const jobNumber = isFabric ? issue.cuttingPO : issue.workOrder;
  const orderReference = issue.cuttingPOLine || issue.orderReference || issue.orderRef || '';
  const buyerPO = issue.buyerPO || issue.buyOrderNo || '';
  const garmentName = issue.garmentName || issue.garment || '';
  const dispatchedVia = issue.sendThrough || issue.dispatchedVia || '';

  const itemsTable = isFabric
    ? renderFabricItemsTable(rows)
    : renderAccessoryItemsTable(rows);

  const totalsByUom = aggregateByUom(rows);
  const totalsBand = totalsByUom
    .map(
      (t) => `
      <div class="total-pill">
        <span class="total-value">${formatNumber(t.qty, t.uom === 'cones' || t.uom === 'pcs' ? 0 : 2)}</span>
        <span class="total-uom">${escapeHtml(t.uom || 'units')}</span>
      </div>`
    )
    .join('');

  const watermark = companyName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(meta.docTitle)} — ${escapeHtml(issue.issueNumber || '')}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
    font-size: 10.5px;
    color: #3d4655;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Palette (mild / pastel) ──────────────────────────────────────── */
  /* accent      : #8ba3c7  slate blue                                   */
  /* accent soft : #e8eef5  pale cornflower                              */
  /* sage        : #9ab09c  muted sage                                   */
  /* sage soft   : #eef4ec  pale sage                                    */
  /* cream       : #faf4e4  warm cream                                   */
  /* cream text  : #8a6d2a  olive gold                                   */
  /* border      : #dde3ea  hairline neutral                             */
  /* text pri    : #3d4655  muted navy                                   */
  /* text sec    : #6b7385  warm gray                                    */

  .watermark {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 92px;
    color: rgba(139, 163, 199, 0.07);
    font-weight: 800;
    letter-spacing: 10px;
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

  /* ── Header ───────────────────────────────────────────────────────── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid #dde3ea;
    margin-bottom: 6px;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -1px;
    height: 2px;
    background: linear-gradient(90deg, #8ba3c7 0%, #9ab09c 55%, transparent 100%);
    border-radius: 2px;
  }

  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .brand img {
    width: 56px; height: 56px;
    object-fit: contain;
    border-radius: 6px;
    background: #faf7ef;
    padding: 4px;
    border: 1px solid #ece7dc;
  }
  .brand h1 {
    font-size: 17px;
    font-weight: 700;
    color: #3d4655;
    letter-spacing: -0.2px;
    line-height: 1.15;
  }
  .brand .addr {
    font-size: 9.5px;
    color: #6b7385;
    margin-top: 3px;
    max-width: 320px;
    line-height: 1.45;
  }
  .brand .ids {
    margin-top: 4px;
    font-size: 9px;
    color: #6b7385;
  }
  .brand .ids strong { color: #3d4655; font-weight: 600; }
  .brand .ids .sep { margin: 0 6px; color: #c7cfda; }

  .doc-meta { text-align: right; min-width: 230px; }
  .doc-eyebrow {
    font-size: 8.5px;
    letter-spacing: 2px;
    font-weight: 600;
    color: #8ba3c7;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .doc-title {
    font-size: 16px;
    font-weight: 700;
    color: #3d4655;
    letter-spacing: -0.2px;
    line-height: 1.15;
  }
  .doc-sub {
    font-size: 9px;
    color: #8a93a4;
    margin-top: 3px;
  }
  .doc-serial {
    margin-top: 8px;
    display: inline-block;
    padding: 5px 11px;
    background: #e8eef5;
    border: 1px solid #c9d6e6;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    color: #3d4655;
    letter-spacing: 0.3px;
  }
  .doc-serial .lbl { color: #6b7385; font-weight: 500; margin-right: 6px; }

  /* ── Summary ribbon ──────────────────────────────────────────────── */
  .ribbon {
    display: flex;
    gap: 18px;
    padding: 9px 14px;
    margin: 14px 0;
    background: linear-gradient(90deg, #faf7ef 0%, #f4f0e3 100%);
    border: 1px solid #ece7dc;
    border-radius: 6px;
  }
  .ribbon .rib-item { flex: 1; }
  .ribbon .rib-label {
    font-size: 8.5px;
    letter-spacing: 0.6px;
    color: #a07d2b;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .ribbon .rib-value {
    font-size: 11px;
    color: #3d4655;
    font-weight: 600;
  }

  /* ── Meta grid ───────────────────────────────────────────────────── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }
  .meta-card {
    border: 1px solid #dde3ea;
    border-radius: 6px;
    padding: 11px 13px 9px;
    background: #fcfcfd;
    position: relative;
  }
  .meta-card::before {
    content: '';
    position: absolute;
    left: 0; top: 10px; bottom: 10px;
    width: 3px;
    background: #8ba3c7;
    border-radius: 2px;
  }
  .meta-card.recipient::before { background: #9ab09c; }
  .meta-card h3 {
    font-size: 8.5px;
    font-weight: 700;
    color: #6b7385;
    text-transform: uppercase;
    letter-spacing: 1.1px;
    margin-bottom: 7px;
    margin-left: 6px;
  }
  .meta-card .row {
    display: flex;
    padding: 3px 0 3px 6px;
    font-size: 9.8px;
    border-bottom: 1px dashed #eef1f5;
  }
  .meta-card .row:last-child { border-bottom: none; }
  .meta-card .row .label {
    width: 115px;
    color: #8a93a4;
    flex-shrink: 0;
    font-weight: 500;
  }
  .meta-card .row .value {
    color: #3d4655;
    font-weight: 600;
    flex: 1;
  }
  .meta-card .row .value.mono {
    font-family: 'Courier New', monospace;
    font-size: 9.5px;
    letter-spacing: 0.2px;
  }
  .meta-card .addr-block {
    padding: 4px 0 2px 6px;
    font-size: 9.8px;
    color: #3d4655;
    line-height: 1.55;
  }
  .meta-card .addr-block .name { font-weight: 700; color: #3d4655; }
  .meta-card .addr-block .line { color: #6b7385; }
  .meta-card .addr-block .ids {
    margin-top: 4px;
    font-size: 9px;
    color: #8a93a4;
  }
  .meta-card .addr-block .ids strong { color: #6b7385; font-weight: 600; }

  /* ── Items table ─────────────────────────────────────────────────── */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 10px;
  }
  table.items th {
    background: #f1f4f9;
    color: #3d4655;
    padding: 9px 10px;
    text-align: left;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    border-bottom: 1.5px solid #c9d6e6;
    border-top: 1px solid #dde3ea;
  }
  table.items th.num { text-align: right; }
  table.items td {
    padding: 10px;
    border-bottom: 1px solid #eef1f5;
    vertical-align: top;
  }
  table.items tbody tr:nth-child(even) td { background: #fbfcfd; }
  table.items tbody tr:last-child td { border-bottom: 1.5px solid #dde3ea; }

  table.items td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #3d4655;
  }

  .desc-main {
    font-weight: 600;
    color: #3d4655;
    font-size: 10.5px;
    line-height: 1.35;
  }
  .pill-row { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
  .pill {
    display: inline-block;
    padding: 2px 8px;
    background: #e8eef5;
    color: #4d617e;
    font-size: 8.5px;
    font-weight: 600;
    border-radius: 999px;
    letter-spacing: 0.2px;
  }
  .pill.pill-muted {
    background: #f4f6f9;
    color: #6b7385;
    font-weight: 500;
  }

  .qty-cell { white-space: nowrap; }
  .qty-cell .qty { font-weight: 700; color: #3d4655; }
  .qty-cell .uom {
    display: inline-block;
    margin-left: 4px;
    font-size: 9px;
    color: #8a93a4;
    font-weight: 500;
  }

  /* ── Totals band ─────────────────────────────────────────────────── */
  .totals-band {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(90deg, #eef4ec 0%, #e4ece3 100%);
    border: 1px solid #d3decf;
    border-radius: 6px;
    margin-bottom: 14px;
  }
  .totals-band .tb-label {
    font-size: 9px;
    font-weight: 700;
    color: #4a6b4d;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .totals-band .tb-sub {
    font-size: 9px;
    color: #6b7385;
    margin-top: 2px;
    font-weight: 500;
  }
  .totals-band .totals-pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .total-pill {
    padding: 6px 14px;
    background: #fff;
    border: 1px solid #d3decf;
    border-radius: 999px;
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }
  .total-pill .total-value {
    font-size: 13px;
    font-weight: 700;
    color: #4a6b4d;
    font-variant-numeric: tabular-nums;
  }
  .total-pill .total-uom {
    font-size: 9px;
    color: #8a93a4;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 600;
  }

  /* ── Remarks + notice ────────────────────────────────────────────── */
  .notice-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 12px;
    margin-bottom: 18px;
  }
  .remarks {
    border: 1px solid #dde3ea;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fcfcfd;
  }
  .remarks .rem-label {
    font-size: 8.5px;
    letter-spacing: 0.9px;
    color: #8a93a4;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .remarks .rem-text {
    font-size: 10px;
    color: #3d4655;
    line-height: 1.5;
  }
  .notice {
    border: 1px solid #ece7dc;
    border-radius: 6px;
    padding: 10px 12px;
    background: #faf4e4;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .notice .notice-title {
    font-size: 10.5px;
    font-weight: 700;
    color: #8a6d2a;
    letter-spacing: 0.5px;
  }
  .notice .notice-sub {
    font-size: 9px;
    color: #a07d2b;
    margin-top: 3px;
    font-weight: 500;
  }

  /* ── Signatures ──────────────────────────────────────────────────── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
    margin-top: 26px;
  }
  .sig-block {
    text-align: center;
    padding-top: 46px;
    position: relative;
  }
  .sig-block::before {
    content: '';
    position: absolute;
    top: 38px;
    left: 10%; right: 10%;
    border-top: 1px dashed #b8c2d1;
  }
  .sig-block .sig-title {
    font-size: 10px;
    font-weight: 700;
    color: #3d4655;
  }
  .sig-block .sig-sub {
    font-size: 8.5px;
    color: #8a93a4;
    margin-top: 2px;
    letter-spacing: 0.3px;
  }

  /* ── Footer ──────────────────────────────────────────────────────── */
  .footer {
    margin-top: 22px;
    padding-top: 8px;
    border-top: 1px solid #eef1f5;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #a8b0bd;
  }
  .footer .fl-accent { color: #8ba3c7; font-weight: 600; }

  @media print {
    body { background: #fff; }
    .watermark { color: rgba(139, 163, 199, 0.06); }
  }
</style>
</head>
<body>
  <div class="watermark">${escapeHtml(watermark)}</div>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="brand">
        <img src="${sristiLogo}" alt="Logo" onerror="this.style.display='none'">
        <div>
          <h1>${escapeHtml(companyName)}</h1>
          ${addressLine1 ? `<div class="addr">${escapeHtml(addressLine1)}</div>` : ''}
          ${cityStatePin ? `<div class="addr">${escapeHtml(cityStatePin)}</div>` : ''}
          <div class="ids">
            ${orgGstin ? `<strong>GSTIN</strong> ${escapeHtml(orgGstin)}` : ''}
            ${orgGstin && orgPan ? '<span class="sep">·</span>' : ''}
            ${orgPan ? `<strong>PAN</strong> ${escapeHtml(orgPan)}` : ''}
            ${companyPhone ? `<span class="sep">·</span><strong>Tel</strong> ${escapeHtml(companyPhone)}` : ''}
            ${companyEmail ? `<span class="sep">·</span><strong>Email</strong> ${escapeHtml(companyEmail)}` : ''}
          </div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-eyebrow">${escapeHtml(meta.accentLabel)}</div>
        <div class="doc-title">${escapeHtml(meta.docTitle)}</div>
        <div class="doc-sub">${escapeHtml(meta.docSubtitle)}</div>
        <div class="doc-serial">
          <span class="lbl">No.</span>${escapeHtml(issue.issueNumber || '—')}
        </div>
      </div>
    </div>

    <!-- Summary ribbon -->
    <div class="ribbon">
      <div class="rib-item">
        <div class="rib-label">Style</div>
        <div class="rib-value">${valueOrDash(issue.style)}</div>
      </div>
      <div class="rib-item">
        <div class="rib-label">${escapeHtml(meta.jobLabel)}</div>
        <div class="rib-value">${valueOrDash(jobNumber)}</div>
      </div>
      <div class="rib-item">
        <div class="rib-label">Issue Date</div>
        <div class="rib-value">${formatDate(issue.issueDate)}</div>
      </div>
    </div>

    <!-- Meta grid -->
    <div class="meta-grid">
      <div class="meta-card">
        <h3>Issue Details</h3>
        <div class="row">
          <div class="label">Issue Slip No</div>
          <div class="value mono">${valueOrDash(issue.issueNumber)}</div>
        </div>
        ${orderReference ? `
        <div class="row">
          <div class="label">Order Reference</div>
          <div class="value mono">${escapeHtml(orderReference)}</div>
        </div>` : ''}
        ${buyerPO ? `
        <div class="row">
          <div class="label">Buyer PO</div>
          <div class="value mono">${escapeHtml(buyerPO)}</div>
        </div>` : ''}
        ${garmentName ? `
        <div class="row">
          <div class="label">Garment</div>
          <div class="value">${escapeHtml(garmentName)}</div>
        </div>` : ''}
        ${isFabric && issue.fabric ? `
        <div class="row">
          <div class="label">Fabric</div>
          <div class="value">${escapeHtml(issue.fabric)}</div>
        </div>` : ''}
        <div class="row">
          <div class="label">Production Unit</div>
          <div class="value">${valueOrDash(issue.productionUnit)}</div>
        </div>
        ${dispatchedVia ? `
        <div class="row">
          <div class="label">Dispatched Via</div>
          <div class="value">${escapeHtml(dispatchedVia)}</div>
        </div>` : ''}
      </div>

      <div class="meta-card recipient">
        <h3>Handover</h3>
        <div class="row">
          <div class="label">Process Stage</div>
          <div class="value">${escapeHtml(meta.processStage)}</div>
        </div>
        <div class="row">
          <div class="label">Delivery Date</div>
          <div class="value">${formatDate(issue.deliveryDate || issue.issueDate)}</div>
        </div>
        <div class="row">
          <div class="label">Prepared By</div>
          <div class="value">${valueOrDash(issue.issuedBy)}</div>
        </div>
        <div class="row">
          <div class="label">Received By</div>
          <div class="value">${valueOrDash(issue.receivedBy)}</div>
        </div>
      </div>
    </div>

    <!-- Items table -->
    ${itemsTable}

    <!-- Totals band -->
    <div class="totals-band">
      <div>
        <div class="tb-label">Total Issued</div>
        <div class="tb-sub">${rows.length} line${rows.length === 1 ? '' : 's'} · ${isFabric ? 'Fabric rolls' : 'Trim items'}</div>
      </div>
      <div class="totals-pills">
        ${totalsBand || '<div class="tb-sub">No items</div>'}
      </div>
    </div>

    <!-- Remarks + Notice -->
    <div class="notice-row">
      <div class="remarks">
        <div class="rem-label">Remarks</div>
        <div class="rem-text">${issue.remarks ? escapeHtml(issue.remarks) : '—'}</div>
      </div>
      <div class="notice">
        <div class="notice-title">Not for Sale</div>
        <div class="notice-sub">Job Work Only · Internal Transfer</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>Computer-generated document · <span class="fl-accent">${escapeHtml(meta.docTitle)}</span></div>
      <div>Printed ${formatDateTime(new Date())}</div>
    </div>

  </div>
</body>
</html>`;
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const generateIssueSlipPdf = async (issueData, type, options = {}) => {
  if (!issueData) {
    console.error('Issue data is required for PDF generation');
    return;
  }
  const issueType = type === 'fabric' ? 'fabric' : 'accessories';

  try {
    let org = options.organisation || getCachedOrganisation();
    if (!org) {
      org = await fetchAndCacheOrganisation();
    }
    org = org || {};

    const rows = issueType === 'fabric'
      ? buildFabricRows(issueData)
      : buildAccessoryRows(issueData);

    const html = buildHtml(issueData, issueType, rows, org);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Please allow pop-ups to print the issue slip.');
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
    console.error('Failed to generate issue slip PDF:', error);
    throw error;
  }
};

export const generateFabricIssueSlipPdf = (data, options) =>
  generateIssueSlipPdf(data, 'fabric', options);

export const generateAccessoriesIssueSlipPdf = (data, options) =>
  generateIssueSlipPdf(data, 'accessories', options);

export default {
  generateIssueSlipPdf,
  generateFabricIssueSlipPdf,
  generateAccessoriesIssueSlipPdf,
};
