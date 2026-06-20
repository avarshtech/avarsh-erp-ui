import { getCachedOrganisation, fetchAndCacheOrganisation } from '../services/admin/organisationService';
import { PO_TYPE, PO_TYPE_META, getProcessLabel, getStatusLabel, computeVariancePercent } from './productionConstants';

/**
 * Production PO print document (Cutting PO / Work Order / Finishing PO).
 * Mirrors the HTML-window-print pattern of poPdfGenerator.js — no extra deps.
 * Planning-layer authorization document handed to the in-house unit or vendor.
 */

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');
const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

const matrixRows = (items = []) => items.map((it) => {
  const total = (it.plannedQty || 0) * (it.ratePerPiece || 0);
  return `<tr>
    <td>${esc(it.color)}</td><td>${esc(it.size)}</td>
    <td class="r">${num(it.orderQty)}</td><td class="r">${it.allowancePercent || 0}%</td>
    <td class="r">${num(it.plannedQty)}</td><td class="r">${money(it.ratePerPiece)}</td><td class="r">${money(total)}</td>
  </tr>`;
}).join('');

const totals = (items = []) => items.reduce((a, i) => ({
  orderQty: a.orderQty + (i.orderQty || 0),
  plannedQty: a.plannedQty + (i.plannedQty || 0),
  cost: a.cost + (i.plannedQty || 0) * (i.ratePerPiece || 0),
}), { orderQty: 0, plannedQty: 0, cost: 0 });

const processingBlock = (record, poType) => {
  if (poType === PO_TYPE.FINISHING) {
    return record.isOutsourced
      ? `Vendor: <b>${esc(record.vendorName)}</b>${record.vendorRate ? ` &nbsp;|&nbsp; Rate/Pc: ${money(record.vendorRate)}` : ''}`
      : 'Processing: <b>In-house</b>';
  }
  return `${record.processingUnitType === 'VENDOR' ? 'Vendor' : 'Factory Unit'}: <b>${esc(record.processingUnitName)}</b>`;
};

const datesBlock = (record, poType) => {
  if (poType === PO_TYPE.CUTTING) return `Cut Date: <b>${fmtDate(record.plannedCutDate)}</b> &nbsp;|&nbsp; Delivery: <b>${fmtDate(record.plannedDeliveryDate)}</b>`;
  if (poType === PO_TYPE.WORK_ORDER) return `Start: <b>${fmtDate(record.plannedStartDate)}</b> &nbsp;|&nbsp; End: <b>${fmtDate(record.plannedEndDate)}</b> &nbsp;|&nbsp; Delivery: <b>${fmtDate(record.plannedDeliveryDate)}</b>`;
  return `Start: <b>${fmtDate(record.plannedStartDate)}</b> &nbsp;|&nbsp; End: <b>${fmtDate(record.plannedEndDate)}</b>`;
};

const consumptionBlock = (record, poType) => {
  if (poType === PO_TYPE.FINISHING || record.bomConsumptionPerPc == null) return '';
  const v = computeVariancePercent(record.cadConsumptionPerPc, record.bomConsumptionPerPc);
  return `<div class="sec"><div class="sec-h">Fabric Consumption</div>
    <div class="kv">BOM /Pc: <b>${(record.bomConsumptionPerPc || 0).toFixed(3)}</b> &nbsp;|&nbsp; CAD /Pc: <b>${(record.cadConsumptionPerPc || 0).toFixed(3)}</b> &nbsp;|&nbsp; Variance: <b>${v >= 0 ? '+' : ''}${v.toFixed(2)}%</b>${record.markerEfficiency != null ? ` &nbsp;|&nbsp; Marker Eff.: <b>${record.markerEfficiency}%</b>` : ''}</div></div>`;
};

const processesBlock = (record, poType) => {
  if (poType !== PO_TYPE.FINISHING) return '';
  const tags = (record.processes || []).map((p) => `<span class="chip">${esc(getProcessLabel(p.processName))}</span>`).join(' ');
  return `<div class="sec"><div class="sec-h">Finishing Processes</div><div>${tags || '—'}</div></div>`;
};

export const generateProductionPoPdf = async (record, poType) => {
  if (!record) return;
  const meta = PO_TYPE_META[poType] || {};
  let org = getCachedOrganisation();
  if (!org) { try { org = await fetchAndCacheOrganisation(); } catch { org = null; } }

  const company = org?.organisationName || 'Avarsh Apparels';
  const addr = [[org?.addressLine1, org?.addressLine2].filter(Boolean).join(', '), [org?.city, org?.state].filter(Boolean).join(', ') + (org?.pincode ? ' - ' + org.pincode : '')].filter(Boolean).join('<br>');
  const t = totals(record.items);
  const poNo = record[meta.noField] || '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(poNo)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:28px;font-size:12px}
    .hd{display:flex;justify-content:space-between;border-bottom:2px solid #1677ff;padding-bottom:12px;margin-bottom:14px}
    .co{font-size:18px;font-weight:700;color:#1677ff} .addr{color:#555;font-size:11px;margin-top:4px}
    .doc{text-align:right} .doc .t{font-size:16px;font-weight:700} .doc .n{font-size:13px;margin-top:2px}
    .badge{display:inline-block;padding:2px 10px;border:1px solid #d9d9d9;border-radius:10px;font-size:11px;margin-top:4px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:12px 0;font-size:12px}
    .sec{margin:14px 0} .sec-h{font-weight:700;border-left:3px solid #1677ff;padding-left:8px;margin-bottom:6px}
    .kv{font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #e5e7eb;padding:5px 8px;font-size:11px}
    th{background:#f3f4f6;text-align:left} td.r,th.r{text-align:right} tfoot td{font-weight:700;background:#fafafa}
    .chip{display:inline-block;background:#e6f4ff;color:#1677ff;border-radius:10px;padding:2px 10px;margin:2px;font-size:11px}
    .sign{margin-top:40px;display:flex;justify-content:space-between} .sign div{width:30%;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:11px;color:#555}
    .ft{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:8px;color:#888;font-size:10px;text-align:center}
    @media print{body{padding:0}}
  </style></head><body>
    <div class="hd">
      <div><div class="co">${esc(company)}</div><div class="addr">${addr || ''}${org?.gstin ? '<br>GSTIN: ' + esc(org.gstin) : ''}</div></div>
      <div class="doc"><div class="t">${esc(meta.label || 'Production PO')}</div><div class="n">${esc(poNo)}</div><div class="badge">${esc(getStatusLabel(record.status))}</div></div>
    </div>
    <div class="meta">
      <div>Order: <b>${esc(record.orderNo)}</b></div>
      <div>Style: <b>${esc(record.styleNo)}</b></div>
      <div>Buyer: <b>${esc(record.buyer)}</b></div>
      <div>BOM: <b>${esc(record.bomNo)}</b></div>
      ${poType === PO_TYPE.WORK_ORDER && record.cuttingPoNo ? `<div>Cutting PO: <b>${esc(record.cuttingPoNo)}</b></div>` : ''}
      ${poType === PO_TYPE.FINISHING && record.workOrderNo ? `<div>Work Order: <b>${esc(record.workOrderNo)}</b></div>` : ''}
      <div>${processingBlock(record, poType)}</div>
      <div>${datesBlock(record, poType)}</div>
      <div>Allowance: <b>${record.allowancePercent || 0}%</b></div>
    </div>
    ${processesBlock(record, poType)}
    <div class="sec"><div class="sec-h">Size-Colour Matrix</div>
      <table>
        <thead><tr><th>Colour</th><th>Size</th><th class="r">Order Qty</th><th class="r">Allow.</th><th class="r">Planned</th><th class="r">Rate/Pc</th><th class="r">Total</th></tr></thead>
        <tbody>${matrixRows(record.items)}</tbody>
        <tfoot><tr><td colspan="2">Grand Total</td><td class="r">${num(t.orderQty)}</td><td></td><td class="r">${num(t.plannedQty)}</td><td></td><td class="r">${money(t.cost)}</td></tr></tfoot>
      </table>
    </div>
    ${consumptionBlock(record, poType)}
    ${record.remarks ? `<div class="sec"><div class="sec-h">Remarks</div><div>${esc(record.remarks)}</div></div>` : ''}
    <div class="sign"><div>Prepared By</div><div>Approved By${record.approvedBy ? '<br>' + esc(record.approvedBy) : ''}</div><div>Received By (Unit/Vendor)</div></div>
    <div class="ft">This is a planning/authorization document and does not record actual production. Generated ${new Date().toLocaleString('en-GB')}.</div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { try { w.print(); } catch { /* user can print manually */ } };
};
