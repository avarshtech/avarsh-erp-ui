import dayjs from 'dayjs';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { getFabricGRN } from '../services/inventory/inventoryService';
import sristiLogo from '../assets/images/sristi_logo.jpeg';

/**
 * Fabric QC PDF Generator — "Fabric Inspection Report"
 *
 * Opens a new window with a clean, modern HTML version of the factory's
 * manual fabric inspection ledger. Defects are pivoted into a matrix
 * (rolls as rows, defect types as columns) for parity with the paper form.
 *
 * Usage:
 *   import { generateFabricQCPdf } from '../utils/fabricQCPdfGenerator';
 *   await generateFabricQCPdf(qc);
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatNum = (val, digits = 2) => {
  const n = parseFloat(val);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatInt = (val) => {
  const n = parseInt(val, 10);
  if (!isFinite(n)) return '—';
  return n.toString();
};

const formatDate = (d) => {
  if (!d) return '—';
  return dayjs(d).format('DD-MMM-YYYY');
};

const formatDateTime = (d) => {
  if (!d) return '—';
  return dayjs(d).format('DD-MMM-YYYY HH:mm:ss');
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

// ─── Pivot defects into (roll × defectType) matrix ────────────────────────────

const pivotDefects = (rolls, defects) => {
  // Extract unique defect types (preserving order of first occurrence)
  const typeOrder = [];
  const typeSet = new Set();
  defects.forEach((d) => {
    const name = d.defectTypeName || 'Other';
    if (!typeSet.has(name)) {
      typeSet.add(name);
      typeOrder.push(name);
    }
  });

  // Build lookup: rollNumber → { typeName: count }
  const byRoll = new Map();
  defects.forEach((d) => {
    const rn = d.rollNumber;
    if (!rn) return;
    if (!byRoll.has(rn)) byRoll.set(rn, {});
    const entry = byRoll.get(rn);
    const name = d.defectTypeName || 'Other';
    entry[name] = (entry[name] || 0) + (Number(d.count) || 0);
  });

  // For each roll, build { rollNumber, itemCode, counts[], total }
  const rows = rolls.map((r) => {
    const rollCounts = byRoll.get(r.rollNumber) || {};
    const counts = typeOrder.map((t) => rollCounts[t] || 0);
    const total = counts.reduce((s, c) => s + c, 0);
    return {
      rollNumber: r.rollNumber,
      itemCode: r.itemCode || '',
      qty: Number(r.qty) || 0,
      uom: r.uom || '',
      width: r.width ?? r.stdWidth,
      gsm: r.gsm ?? r.stdGsm,
      actualWidth: r.actualWidth,
      actualGsm: r.actualGsm,
      counts,
      total,
    };
  });

  return { typeOrder, rows };
};

// ─── Build HTML document ──────────────────────────────────────────────────────

const buildFabricQCHtml = (qc, grn, org) => {
  const companyName = org?.organisationName || 'Company Name';
  const orgAddress = [org?.addressLine1, org?.addressLine2, org?.city, org?.state, org?.pincode]
    .filter(Boolean).join(', ');
  const orgGstin = org?.gstin || '';
  const orgPan = org?.pan || '';
  const orgPhone = org?.phone || '';
  const orgEmail = org?.email || '';
  const rolls = qc.rolls || [];
  const defects = qc.defects || [];
  const { typeOrder, rows } = pivotDefects(rolls, defects);

  // Header metadata
  const reportNo = qc.qcNumber || '—';
  const fabricDesc = qc.fabricDescription || rolls[0]?.description || '—';
  const buyer = grn?.buyerName || '—';
  const style = grn?.styleNumber || '—';
  const poNumber = grn?.poNumber || '—';

  // Color — pulled from linked GRN line item if available
  const grnLineItem = (grn?.lineItems || []).find((li) => li.poLineItemId === qc.poLineItemId)
    || (grn?.lineItems || [])[0]
    || {};
  const color = grnLineItem.color || '—';

  // Qty metrics
  const poQty = grnLineItem.poQty || 0;
  const rcvdQty = rolls.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const rcvdRolls = rolls.length;
  const rcvdOn = grn?.grnDate;
  const checkedQty = rolls
    .filter((r) => r.actualWidth != null && r.actualGsm != null)
    .reduce((s, r) => s + (Number(r.qty) || 0), 0);

  // PO Width/GSM from first roll
  const poWidth = rolls[0]?.width ?? rolls[0]?.stdWidth ?? '—';
  const poGsm = rolls[0]?.gsm ?? rolls[0]?.stdGsm ?? '—';

  // 4-point totals
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);
  const totalYards = rows.reduce((s, r) => s + r.qty, 0);
  // Formula: (total points × 36 × 100) / (usable yards × usable width)
  // We fall back to 1 when values are missing to avoid NaN, and suppress display.
  const avgPointsNum = totalYards > 0 && poWidth !== '—'
    ? (totalPoints * 36 * 100) / (totalYards * Number(poWidth))
    : null;
  const avgPointsDisplay = avgPointsNum != null ? avgPointsNum.toFixed(2) : '—';
  const limitPoints = 28;
  const overallPass = qc.overallResult === 'Pass' || (avgPointsNum != null && avgPointsNum <= limitPoints);
  // Conditional Pass status overrides the pass/fail label — the approver signed off
  // with qualifications, and the PDF must surface that distinctly from a plain Pass.
  const isConditionalPass = qc.status === 'Conditional_Pass';
  const overallLabel = isConditionalPass
    ? 'CONDITIONAL PASS'
    : qc.overallResult || (avgPointsNum != null ? (overallPass ? 'PASS' : 'FAIL') : 'PENDING');

  // Build defect matrix header
  const defectHeaderCols = typeOrder
    .map((t) => `<th class="def-col" title="${escapeHtml(t)}">${escapeHtml(t)}</th>`)
    .join('');

  // Build defect matrix body rows
  let matrixRows = '';
  rows.forEach((row) => {
    const countCells = row.counts.map((c) => `<td class="num">${c > 0 ? c : ''}</td>`).join('');
    matrixRows += `
      <tr>
        <td class="num">${escapeHtml(row.rollNumber)}</td>
        <td class="num mono">${escapeHtml(row.itemCode || '—')}</td>
        <td class="num">${formatNum(row.qty, 3)}</td>
        <td class="num">${row.width ?? '—'}</td>
        <td class="num">${row.gsm ?? '—'}</td>
        <td class="num">${row.actualWidth != null ? formatNum(row.actualWidth, 2) : '—'}</td>
        <td class="num">${row.actualGsm != null ? formatNum(row.actualGsm, 2) : '—'}</td>
        ${countCells}
        <td class="num total">${row.total}</td>
      </tr>
    `;
  });

  if (rows.length === 0) {
    matrixRows = `<tr><td colspan="${8 + typeOrder.length}" class="empty">No roll data captured for this inspection.</td></tr>`;
  }

  // Status colour
  const statusColor = isConditionalPass ? '#13c2c2'
    : overallLabel === 'PASS' ? '#16a34a'
    : overallLabel === 'FAIL' ? '#dc2626'
    : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fabric QC ${escapeHtml(reportNo)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5px;
    color: #1f2937;
    background: #fff;
  }
  .page { max-width: 270mm; margin: 0 auto; position: relative; }

  /* ─── Header ─── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 10px;
    border-bottom: 3px solid #1e40af;
    margin-bottom: 12px;
  }
  .header .brand { display: flex; gap: 12px; align-items: flex-start; }
  .header .brand img { width: 54px; height: 54px; object-fit: contain; }
  .header .brand .company-info h1 {
    font-size: 17px;
    font-weight: 700;
    color: #1e3a8a;
    letter-spacing: -0.3px;
    margin-bottom: 2px;
  }
  .header .brand .company-info .tagline {
    font-size: 11.5px;
    color: #4b5563;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header .brand .company-info .org-addr {
    font-size: 8.5px;
    color: #6b7280;
    margin-top: 3px;
    max-width: 340px;
    line-height: 1.45;
  }
  .header .brand .company-info .org-ids {
    font-size: 8.5px;
    color: #6b7280;
    margin-top: 2px;
  }
  .header .brand .company-info .org-ids strong { color: #374151; }
  .header .brand .company-info .org-ids .sep { margin: 0 5px; color: #c7cfda; }
  .header .doc-meta { text-align: right; }
  .header .doc-meta .date { font-size: 10px; color: #6b7280; }
  .header .doc-meta .report-no {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #1e40af;
    margin-top: 2px;
  }

  /* ─── Metadata grid ─── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .meta-card {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px 10px;
    background: #fafafa;
  }
  .meta-card .row { display: flex; padding: 2px 0; font-size: 9.5px; }
  .meta-card .row .label {
    width: 82px;
    color: #6b7280;
    flex-shrink: 0;
  }
  .meta-card .row .value {
    color: #1f2937;
    font-weight: 600;
    flex: 1;
  }
  .meta-card .row .value.mono { font-family: 'Courier New', monospace; }

  /* ─── Defect matrix table ─── */
  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: #1e40af;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 8px 0 6px;
    padding-bottom: 4px;
    border-bottom: 2px solid #dbeafe;
  }
  table.matrix {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5px;
  }
  table.matrix th {
    background: #1e3a8a;
    color: #fff;
    padding: 6px 3px;
    text-align: center;
    font-weight: 600;
    border: 1px solid #1e3a8a;
    white-space: nowrap;
  }
  table.matrix th.def-col {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 7.5px;
    padding: 4px 2px;
    min-width: 18px;
    max-width: 18px;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  table.matrix td {
    padding: 4px 3px;
    border: 1px solid #e5e7eb;
    vertical-align: middle;
    text-align: center;
  }
  table.matrix td.num { font-variant-numeric: tabular-nums; }
  table.matrix td.mono { font-family: 'Courier New', monospace; font-size: 8px; }
  table.matrix td.total { font-weight: 700; color: #1e40af; background: #eff6ff; }
  table.matrix td.empty {
    text-align: center;
    padding: 20px;
    color: #9ca3af;
    font-style: italic;
  }
  table.matrix tr:nth-child(even) td { background: #f9fafb; }

  /* ─── Formula + status banner ─── */
  .summary-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
  }
  .formula-box, .metric-box, .status-box {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 10px 12px;
    background: #fafafa;
  }
  .formula-box .label, .metric-box .label, .status-box .label {
    font-size: 8.5px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .formula-box .formula {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #1f2937;
    line-height: 1.6;
  }
  .metric-box .metric-value {
    font-size: 22px;
    font-weight: 700;
    color: #1e40af;
    font-variant-numeric: tabular-nums;
  }
  .metric-box .metric-unit { font-size: 9px; color: #6b7280; margin-left: 4px; }
  .status-box {
    text-align: center;
    background: ${statusColor};
    color: #fff;
    border: 1px solid ${statusColor};
  }
  .status-box .label { color: rgba(255,255,255,0.85); }
  .status-box .status-value {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  /* ─── Inspection summary (passed/failed) ─── */
  .inspect-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 10px;
  }
  .stat-card {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px 10px;
    background: #fff;
    text-align: center;
  }
  .stat-card .lbl { font-size: 8.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card .val { font-size: 16px; font-weight: 700; color: #1e40af; margin-top: 2px; }
  .stat-card.pass .val { color: #16a34a; }
  .stat-card.fail .val { color: #dc2626; }

  /* ─── Signatures ─── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 40px;
    margin-top: 24px;
    padding-top: 12px;
  }
  .sig-block {
    text-align: center;
    padding-top: 36px;
    border-top: 1px solid #9ca3af;
  }
  .sig-block .sig-title { font-size: 9.5px; font-weight: 600; color: #374151; }
  .sig-block .sig-sub { font-size: 8px; color: #9ca3af; margin-top: 2px; }

  /* ─── Footer ─── */
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
          <div class="tagline">Fabric Inspection Report</div>
          ${orgAddress ? `<div class="org-addr">${escapeHtml(orgAddress)}</div>` : ''}
          <div class="org-ids">
            ${orgGstin ? `<strong>GSTIN</strong> ${escapeHtml(orgGstin)}` : ''}
            ${orgGstin && orgPan ? '<span class="sep">·</span>' : ''}
            ${orgPan ? `<strong>PAN</strong> ${escapeHtml(orgPan)}` : ''}
            ${orgPhone ? `<span class="sep">·</span><strong>Tel</strong> ${escapeHtml(orgPhone)}` : ''}
            ${orgEmail ? `<span class="sep">·</span><strong>Email</strong> ${escapeHtml(orgEmail)}` : ''}
          </div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="date">Date: ${formatDate(qc.inspectionDate)}</div>
        <div class="report-no">REPORT # ${escapeHtml(reportNo)}</div>
      </div>
    </div>

    <!-- Metadata grid -->
    <div class="meta-grid">
      <div class="meta-card">
        <div class="row"><div class="label">Fabric</div><div class="value">${escapeHtml(fabricDesc)}</div></div>
        <div class="row"><div class="label">Buyer</div><div class="value">${escapeHtml(buyer)}</div></div>
        <div class="row"><div class="label">Style #</div><div class="value mono">${escapeHtml(style)}</div></div>
        <div class="row"><div class="label">Color</div><div class="value">${escapeHtml(color)}</div></div>
      </div>
      <div class="meta-card">
        <div class="row"><div class="label">PO #</div><div class="value mono">${escapeHtml(poNumber)}</div></div>
        <div class="row"><div class="label">PO Qty</div><div class="value">${formatNum(poQty, 3)}</div></div>
        <div class="row"><div class="label">Recd Qty</div><div class="value">${formatNum(rcvdQty, 3)}</div></div>
        <div class="row"><div class="label">Checked Qty</div><div class="value">${formatNum(checkedQty, 3)}</div></div>
      </div>
      <div class="meta-card">
        <div class="row"><div class="label">PO Width</div><div class="value">${poWidth}"</div></div>
        <div class="row"><div class="label">PO GSM</div><div class="value">${poGsm}</div></div>
        <div class="row"><div class="label">Recd Rolls</div><div class="value">${rcvdRolls}</div></div>
        <div class="row"><div class="label">Recd On</div><div class="value">${formatDate(rcvdOn)}</div></div>
      </div>
    </div>

    <!-- Defect classification matrix -->
    <div class="section-title">Defect Classification</div>
    <table class="matrix">
      <thead>
        <tr>
          <th rowspan="1">Roll #</th>
          <th rowspan="1">Item<br>Code</th>
          <th rowspan="1">Yards /<br>Kg / Mtr</th>
          <th rowspan="1">PO<br>Width</th>
          <th rowspan="1">PO<br>GSM</th>
          <th rowspan="1">Actual<br>Width</th>
          <th rowspan="1">Actual<br>GSM</th>
          ${defectHeaderCols || '<th>No Defects</th>'}
          <th rowspan="1">Total<br>Points</th>
        </tr>
      </thead>
      <tbody>
        ${matrixRows}
        ${rows.length > 0 ? `
        <tr>
          <td class="num total" colspan="2">Total</td>
          <td class="num total">${formatNum(totalYards, 3)}</td>
          <td colspan="4"></td>
          ${typeOrder.map(() => '<td></td>').join('')}
          <td class="num total">${totalPoints}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Summary row: formula + avg points + pass/fail -->
    <div class="summary-row">
      <div class="formula-box">
        <div class="label">Formula (4-point system)</div>
        <div class="formula">
          Avg Points = (Total Points × 36 × 100) / (Usable Yards × Usable Width)<br>
          = (${totalPoints} × 36 × 100) / (${formatNum(totalYards, 3)} × ${poWidth})
        </div>
      </div>
      <div class="metric-box">
        <div class="label">Avg Points / 10 sq yd</div>
        <div><span class="metric-value">${avgPointsDisplay}</span><span class="metric-unit">pts</span></div>
        <div class="label" style="margin-top: 4px">Limit: ${limitPoints} pts</div>
      </div>
      <div class="status-box">
        <div class="label">Overall Result</div>
        <div class="status-value">${escapeHtml(overallLabel)}</div>
      </div>
    </div>

    <!-- Inspection summary stats -->
    <div class="inspect-summary">
      <div class="stat-card">
        <div class="lbl">Rolls Inspected</div>
        <div class="val">${rolls.length}</div>
      </div>
      <div class="stat-card pass">
        <div class="lbl">Rolls Passed</div>
        <div class="val">${qc.rollsPassed ?? '—'}</div>
      </div>
      <div class="stat-card fail">
        <div class="lbl">Rolls Failed</div>
        <div class="val">${qc.rollsFailed ?? '—'}</div>
      </div>
      <div class="stat-card">
        <div class="lbl">Defects Logged</div>
        <div class="val">${defects.length}</div>
      </div>
    </div>

    ${qc.approvalReason || isConditionalPass ? `
    <!-- Approver notes -->
    <div class="approver-note" style="
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 4px;
      border: 1px solid ${isConditionalPass ? '#13c2c2' : '#e5e7eb'};
      border-left: 4px solid ${isConditionalPass ? '#13c2c2' : '#16a34a'};
      background: ${isConditionalPass ? 'rgba(19, 194, 194, 0.06)' : '#f9fafb'};
    ">
      <div style="font-size: 8.5px; font-weight: 700; color: ${isConditionalPass ? '#0e9999' : '#16a34a'}; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px;">
        ${isConditionalPass ? 'Conditional Pass — Approver Note' : 'Approval Note'}
      </div>
      <div style="font-size: 9.5px; color: #1f2937; line-height: 1.5;">
        ${escapeHtml(qc.approvalReason || '')}
      </div>
    </div>` : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-title">Inspected By</div>
        <div class="sig-sub">${escapeHtml(qc.inspector || '')}</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">${isConditionalPass ? 'Conditional Pass By' : 'Approved By'}</div>
        <div class="sig-sub">${escapeHtml(qc.approver || 'Quality Manager')}</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Received By</div>
        <div class="sig-sub">Store Keeper</div>
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

export const generateFabricQCPdf = async (qcData, options = {}) => {
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

    // Fetch linked GRN for buyer/style/PO metadata
    let grn = options.grn || null;
    if (!grn && qcData.grnId) {
      try { grn = await getFabricGRN(qcData.grnId); } catch { /* ignore */ }
    }

    const html = buildFabricQCHtml(qcData, grn, org);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Pop-up blocked. Please allow pop-ups to print the Fabric QC report.');
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
    console.error('Failed to generate Fabric QC PDF:', error);
    throw error;
  }
};

export default { generateFabricQCPdf };
