import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { getAccessoriesGRN } from '../services/inventory/inventoryService';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * Trims / Accessories QC PDF Generator — "Trims Checking Record"
 *
 * Matches the factory's manual TCR form layout: metadata + criteria
 * checklist + size-wise inspection table. Opens in a new window ready
 * to print.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatNum = (val, digits = 0) => {
  const n = parseFloat(val);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
const formatDateTime = (d) => (d ? dayjs(d).format('DD-MMM-YYYY HH:mm:ss') : '—');

const escapeHtml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

const buildTrimsQCHtml = (qc, grn, org) => {
  const companyName = org?.organisationName || 'Company Name';
  const criteriaRows = qc.criteriaRows || qc.criteriaChecks || [];
  const sizeRows = qc.sizeInspectionRows || [];

  // Metadata
  const poNumber = grn?.poNumber || '—';
  const buyer = grn?.buyerName || '—';
  const style = grn?.styleNumber || '—';
  const supplier = grn?.supplier || '—';

  // Line item
  const grnLineItem = (grn?.lineItems || grn?.items || []).find((li) => li.poLineItemId === qc.poLineItemId)
    || (grn?.lineItems || grn?.items || [])[0]
    || {};
  const trimName = grnLineItem.description || grnLineItem.itemDescription || '—';

  const dcNumber = grn?.challanNo || '—';
  const dcDate = grn?.deliveryChallanDate;

  // Qty fields
  const qtyOrdered = qc.qtyOrdered || grnLineItem.poQty || 0;
  const qtyReceived = qc.qtyReceived || grnLineItem.receivingQty || 0;
  const qtyChecked = qc.qtyChecked || 0;

  // Build criteria rows
  let criteriaHtml = '';
  criteriaRows.forEach((c, i) => {
    const okMark = c.ok ? '✓' : '';
    const notOkMark = c.notOk ? '✓' : '';
    criteriaHtml += `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(c.criteria || c.criterionName || '—')}</td>
        <td class="center ok">${okMark}</td>
        <td class="center notok">${notOkMark}</td>
        <td>${escapeHtml(c.remarks || '')}</td>
      </tr>
    `;
  });
  if (criteriaRows.length === 0) {
    criteriaHtml = `<tr><td colspan="5" class="empty">No criteria checked for this inspection.</td></tr>`;
  }

  // Build size rows
  let sizeHtml = '';
  let totalExpected = 0;
  let totalChecked = 0;
  sizeRows.forEach((r, i) => {
    const exp = Number(r.expectedQty) || 0;
    const chk = Number(r.checkedQty) || 0;
    totalExpected += exp;
    totalChecked += chk;
    const short = Math.max(0, exp - chk);
    const badge = chk === 0 && exp === 0
      ? '—'
      : chk === exp
      ? '<span class="badge ok">OK</span>'
      : `<span class="badge err">Short ${short}</span>`;
    sizeHtml += `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="center">${escapeHtml(r.size || '—')}</td>
        <td class="num">${formatNum(exp)}</td>
        <td class="num">${formatNum(chk)}</td>
        <td class="center">${badge}</td>
      </tr>
    `;
  });
  if (sizeRows.length === 0) {
    sizeHtml = `<tr><td colspan="5" class="empty">No size-wise rows captured for this inspection.</td></tr>`;
  }

  const totalMatch = totalExpected > 0 && totalChecked === totalExpected;
  const totalBadge = totalMatch
    ? '<span class="badge ok">Matched</span>'
    : `<span class="badge err">Short ${Math.max(0, totalExpected - totalChecked)}</span>`;

  // Overall status banner
  const okCount = criteriaRows.filter((c) => c.ok).length;
  const notOkCount = criteriaRows.filter((c) => c.notOk).length;
  const overallStatus = notOkCount > 0 ? 'FAIL' : okCount > 0 ? 'PASS' : 'PENDING';
  const statusColor = overallStatus === 'PASS' ? '#16a34a' : overallStatus === 'FAIL' ? '#dc2626' : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Trims QC ${escapeHtml(qc.qcNumber || '')}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10px;
    color: #1f2937;
    background: #fff;
  }
  .page { max-width: 190mm; margin: 0 auto; position: relative; }

  /* ─── Header ─── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 10px;
    border-bottom: 3px solid #7c3aed;
    margin-bottom: 12px;
  }
  .header .brand { display: flex; gap: 12px; align-items: flex-start; }
  .header .brand img { width: 54px; height: 54px; object-fit: contain; }
  .header .brand .company-info h1 {
    font-size: 17px;
    font-weight: 700;
    color: #5b21b6;
    margin-bottom: 2px;
  }
  .header .brand .company-info .tagline {
    font-size: 11.5px;
    color: #4b5563;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header .doc-meta { text-align: right; }
  .header .doc-meta .date { font-size: 10px; color: #6b7280; }
  .header .doc-meta .report-no {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #5b21b6;
    margin-top: 2px;
  }
  .header .doc-meta .ref {
    font-size: 9px;
    color: #9ca3af;
    letter-spacing: 1px;
    margin-top: 2px;
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
    padding: 9px 11px;
    background: #fafafa;
  }
  .meta-card .row { display: flex; padding: 2px 0; font-size: 9.5px; }
  .meta-card .row .label {
    width: 110px;
    color: #6b7280;
    flex-shrink: 0;
  }
  .meta-card .row .value {
    color: #1f2937;
    font-weight: 600;
    flex: 1;
  }
  .meta-card .row .value.mono { font-family: 'Courier New', monospace; }

  /* ─── Section title ─── */
  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: #5b21b6;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 12px 0 6px;
    padding-bottom: 4px;
    border-bottom: 2px solid #ede9fe;
  }

  /* ─── Tables ─── */
  table.data {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    margin-bottom: 10px;
  }
  table.data th {
    background: #5b21b6;
    color: #fff;
    padding: 7px 8px;
    text-align: left;
    font-weight: 600;
    border: 1px solid #5b21b6;
  }
  table.data td {
    padding: 7px 8px;
    border: 1px solid #e5e7eb;
  }
  table.data td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.data td.center { text-align: center; }
  table.data td.ok { color: #16a34a; font-weight: 700; font-size: 12px; }
  table.data td.notok { color: #dc2626; font-weight: 700; font-size: 12px; }
  table.data td.empty { text-align: center; padding: 20px; color: #9ca3af; font-style: italic; }
  table.data tr:nth-child(even) td { background: #faf5ff; }
  table.data tfoot td {
    background: #ede9fe;
    font-weight: 700;
    color: #5b21b6;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    font-size: 9px;
    font-weight: 600;
    border-radius: 10px;
  }
  .badge.ok { background: #dcfce7; color: #15803d; }
  .badge.err { background: #fee2e2; color: #b91c1c; }

  /* ─── Status banner ─── */
  .status-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: ${statusColor};
    color: #fff;
    border-radius: 4px;
    margin: 10px 0 14px;
  }
  .status-banner .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.9;
  }
  .status-banner .value {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 2px;
  }
  .status-banner .summary {
    text-align: right;
    font-size: 10px;
    opacity: 0.95;
  }

  /* ─── Signatures ─── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 24px;
  }
  .sig-block {
    text-align: center;
    padding-top: 36px;
    border-top: 1px solid #9ca3af;
  }
  .sig-block .sig-title { font-size: 9.5px; font-weight: 600; color: #374151; }
  .sig-block .sig-sub { font-size: 8px; color: #9ca3af; margin-top: 2px; }

  .footer {
    margin-top: 16px;
    padding-top: 6px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    font-size: 8px;
    color: #9ca3af;
  }
</style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="brand">
        <img src="${sristiLogo}" alt="Logo" onerror="this.style.display='none'">
        <div class="company-info">
          <h1>${escapeHtml(companyName)}</h1>
          <div class="tagline">Trims Checking Record</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="date">Date: ${formatDate(qc.inspectionDate)}</div>
        <div class="report-no">${escapeHtml(qc.qcNumber || '—')}</div>
        <div class="ref">SRI/QMS/TCR</div>
      </div>
    </div>

    <!-- Metadata grid -->
    <div class="meta-grid">
      <div class="meta-card">
        <div class="row"><div class="label">PO #</div><div class="value mono">${escapeHtml(poNumber)}</div></div>
        <div class="row"><div class="label">Buyer</div><div class="value">${escapeHtml(buyer)}</div></div>
        <div class="row"><div class="label">Style</div><div class="value mono">${escapeHtml(style)}</div></div>
        <div class="row"><div class="label">Trim Name</div><div class="value">${escapeHtml(trimName)}</div></div>
      </div>
      <div class="meta-card">
        <div class="row"><div class="label">Supplier</div><div class="value">${escapeHtml(supplier)}</div></div>
        <div class="row"><div class="label">DC # / Date</div><div class="value mono">${escapeHtml(dcNumber)} / ${formatDate(dcDate)}</div></div>
        <div class="row"><div class="label">Qty Ordered</div><div class="value">${formatNum(qtyOrdered)}</div></div>
        <div class="row"><div class="label">Qty Received</div><div class="value">${formatNum(qtyReceived)}</div></div>
        <div class="row"><div class="label">Qty Checked (AQL)</div><div class="value">${formatNum(qtyChecked)}</div></div>
      </div>
    </div>

    <!-- Criteria checking -->
    <div class="section-title">Criteria Checking</div>
    <table class="data">
      <thead>
        <tr>
          <th style="width:36px">S.No</th>
          <th>Criteria Checked</th>
          <th style="width:60px" class="center">OK</th>
          <th style="width:60px" class="center">Not OK</th>
          <th style="width:220px">Remark</th>
        </tr>
      </thead>
      <tbody>
        ${criteriaHtml}
      </tbody>
    </table>

    <!-- Size-wise inspection -->
    <div class="section-title">Size-wise Inspection</div>
    <table class="data">
      <thead>
        <tr>
          <th style="width:36px">S.No</th>
          <th class="center" style="width:120px">Size</th>
          <th style="width:120px" class="center">Expected Qty</th>
          <th style="width:120px" class="center">Checked Qty</th>
          <th class="center" style="width:120px">Match</th>
        </tr>
      </thead>
      <tbody>
        ${sizeHtml}
      </tbody>
      ${sizeRows.length > 0 ? `
      <tfoot>
        <tr>
          <td colspan="2" class="center">TOTAL</td>
          <td class="num">${formatNum(totalExpected)}</td>
          <td class="num">${formatNum(totalChecked)}</td>
          <td class="center">${totalBadge}</td>
        </tr>
      </tfoot>
      ` : ''}
    </table>

    <!-- Overall status banner -->
    <div class="status-banner">
      <div>
        <div class="label">Overall Result</div>
        <div class="value">${overallStatus}</div>
      </div>
      <div class="summary">
        <div>Criteria: ${okCount} OK / ${notOkCount} Not OK</div>
        <div>Sizes: ${sizeRows.length} rows, ${formatNum(totalChecked)} pcs checked</div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-title">Prepared By</div>
        <div class="sig-sub">${escapeHtml(qc.inspector || '')}</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Approved By</div>
        <div class="sig-sub">Quality Manager</div>
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

export const generateTrimsQCPdf = async (qcData, options = {}) => {
  if (!qcData) {
    console.error('QC data is required for PDF generation');
    return;
  }
  try {
    let org = options.organisation || getCachedOrganisation();
    if (!org) {
      org = await fetchAndCacheOrganisation();
    }
    org = org || {};

    let grn = options.grn || null;
    if (!grn && qcData.grnId) {
      try { grn = await getAccessoriesGRN(qcData.grnId); } catch { /* ignore */ }
    }

    const html = buildTrimsQCHtml(qcData, grn, org);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Please allow pop-ups to print the Trims QC report.');
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
    console.error('Failed to generate Trims QC PDF:', error);
    throw error;
  }
};

export default { generateTrimsQCPdf };
