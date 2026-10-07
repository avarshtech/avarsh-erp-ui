/**
 * Printable inward job-work documents (UI mock round 2): our return challan to the principal, the
 * shortage and defect report on their Material In, and the status report they get. Built on the shared
 * print helpers; every value passes through esc().
 */
import { cell, documentShell, esc } from '../printDoc';
import { formatDate } from '../formatters';

const qty = (n) => Number(n || 0).toLocaleString('en-IN');
const CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 18px; font-size: 11px; }
  h1 { font-size: 16px; margin: 0; letter-spacing: 1px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .co { font-size: 14px; font-weight: 700; } .muted { color: #555; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .grid td { border: 1px solid #333; }
  .lines th, .lines td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  .lines th { background: #f1f1f1; font-size: 10px; } .num { text-align: right !important; }
  .note { border: 1px dashed #999; padding: 6px 8px; margin: 8px 0; font-size: 10px; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; font-size: 10px; }
  .sign div { width: 30%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
`;
const header = (branch, title, no, date) => `
  <div class="head">
    <div><div class="co">${esc(branch.name)}</div><div class="muted">${esc(branch.address)}<br/>GSTIN: ${esc(branch.gstin)}</div></div>
    <div style="text-align:right"><h1>${esc(title)}</h1><div><b>${esc(no)}</b></div><div class="muted">Date: ${esc(formatDate(date))}</div></div>
  </div>`;
const party = (p) => `${p.name}\n${p.address}${p.pincode ? ` ${p.pincode}` : ''}\nGSTIN: ${p.gstin || 'Unregistered'}`;
const table = (heads, rows) => `<table class="lines"><thead><tr>${heads.map((h) => `<th class="${h.num ? 'num' : ''}">${esc(h.t)}</th>`).join('')}</tr></thead>
  <tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td class="${heads[i].num ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">—</td></tr>`}</tbody></table>`;

/** Our challan returning garments, leftovers and waste after job work. */
export const buildReturnChallanHtml = ({ ret, jobOrder, principal, branch, lotLines, settles }) => {
  const lines = [
    ...ret.garments.map((g) => [`${jobOrder.styleNo} ${jobOrder.styleName} — ${g.colour} ${g.size} (finished, good)`, qty(g.qty), 'pcs']),
    ...ret.rejects.map((g) => [`${jobOrder.styleNo} — ${g.colour} ${g.size} (rejected, no job charge)`, qty(g.qty), 'pcs']),
    ...lotLines.map((l) => [`Your material returned: ${l.itemName}${l.lot.size ? ` ${l.lot.size}` : ''} — lot ${l.lot.lotNo} (your challan ${l.theirDcNo})`, qty(l.qty), l.lot.uom]),
    ...(ret.wasteKg ? [['Cutting waste from your fabric', qty(ret.wasteKg), 'kg']] : []),
  ].map((r, i) => [i + 1, ...r]);
  const body = `${header(branch, 'JOB WORK RETURN CHALLAN', ret.ourChallanNo, ret.date)}
    <table class="grid"><tr>${cell('To (principal)', party(principal), { bold: true })}${cell('Ship to', ret.shipTo ? `${ret.shipTo.name}\n${ret.shipTo.address}\nTheir invoice: ${ret.shipTo.principalInvoiceNo}` : 'As addressed')}</tr>
    <tr>${cell('Your order / our job order', `${jobOrder.principalRef} / ${jobOrder.orderNo}`)}${cell('Your challans settled', (settles || []).join(', '))}</tr>
    <tr>${cell('Our reference', ret.returnNo)}${cell('Vehicle / e-way bill', `${ret.vehicleNo || '—'} / ${ret.ewayBillNo || '—'}`)}</tr></table>
    ${table([{ t: '#' }, { t: 'Description' }, { t: 'Qty', num: true }, { t: 'Unit' }], lines)}
    <div class="note">Goods returned after job work. Job charges are invoiced separately.</div>
    <div class="sign"><div>Prepared by</div><div>Received by (principal)</div><div>For ${esc(branch.name)}</div></div>`;
  return documentShell({ title: `Return challan ${ret.ourChallanNo}`, bodyCss: CSS, watermark: ret.status === 'CANCELLED' ? 'CANCELLED' : undefined, body });
};

/** What arrived short against the principal's challan, and what was defective. */
export const buildShortageReportHtml = ({ doc, jobOrder, principal, branch, lines }) => {
  const rows = lines.map((l, i) => [i + 1, `${l.itemName}${l.size ? ` ${l.size}` : ''}`, l.lotNo, `${qty(l.challanQty)} ${l.uom}`, `${qty(l.receivedQty)} ${l.uom}`, l.short ? `${qty(l.short)} ${l.uom}` : '—', l.defectiveQty ? `${qty(l.defectiveQty)} ${l.uom}` : '—']);
  const body = `${header(branch, 'SHORTAGE & DEFECT REPORT', doc.inwardNo, doc.date)}
    <table class="grid"><tr>${cell('To', party(principal), { bold: true })}${cell('Your challan', `${doc.theirDcNo} of ${formatDate(doc.theirDcDate)}\nFrom: ${doc.dispatchedFrom}`)}</tr>
    <tr>${cell('Your order / our job order', `${jobOrder.principalRef} / ${jobOrder.orderNo} — ${jobOrder.styleNo}`)}${cell('Weight tolerance', `${principal.weightTolerancePct}% on fabric`)}</tr></table>
    ${table([{ t: '#' }, { t: 'Material' }, { t: 'Our lot' }, { t: 'Your challan', num: true }, { t: 'Received', num: true }, { t: 'Short', num: true }, { t: 'Defective', num: true }], rows)}
    ${doc.defects.length ? `<div class="note"><b>Defects noted:</b><br/>${doc.defects.map((d) => esc(d.text)).join('<br/>')}</div>` : ''}
    <div class="sign"><div>Checked by (stores)</div><div>Acknowledged by (principal)</div><div>For ${esc(branch.name)}</div></div>`;
  return documentShell({ title: `Shortage report ${doc.inwardNo}`, bodyCss: CSS, body });
};

/** Progress of one job order for the principal: per colour, stitched for the order, day by day. */
export const buildStatusReportHtml = ({ asOf, jobOrder, principal, branch, row, progress, shortLines, stitchedNote }) => {
  const colourRows = progress.byColour.map((c) => [c.colour, qty(c.orderQty), jobOrder.scope === 'CMT' ? qty(c.cut) : '—', qty(c.packed), qty(c.returned + c.rejectsReturned), qty(Math.max(0, c.orderQty - c.returned - c.rejectsReturned))]);
  const dayRows = progress.days.map((d) => [formatDate(d.date), qty(d.cut), qty(d.stitched), qty(d.packed), qty(d.returned)]);
  const body = `${header(branch, 'JOB WORK STATUS REPORT', jobOrder.orderNo, asOf)}
    <table class="grid"><tr>${cell('For', party(principal), { bold: true })}${cell('Your order', `${jobOrder.principalRef} — ${jobOrder.styleNo} ${jobOrder.styleName}`)}</tr>
    <tr>${cell('Due', formatDate(jobOrder.dueDate))}${cell('Expected finish at the current pace', row.projectedDate ? formatDate(row.projectedDate) : 'Not enough packing yet to project')}</tr></table>
    ${table([{ t: 'Colour' }, { t: 'Order', num: true }, { t: 'Cut', num: true }, { t: 'Packed', num: true }, { t: 'Returned', num: true }, { t: 'Balance', num: true }], colourRows)}
    <div class="note">Stitched so far: <b>${qty(progress.stitched)}</b>. ${esc(stitchedNote)}</div>
    ${shortLines.length ? `<div class="note"><b>Waiting on your material:</b><br/>${shortLines.map((m) => `${esc(m.itemName)}: ${esc(qty(m.short))} ${esc(m.uom)} short`).join('<br/>')}</div>` : ''}
    <h3 style="font-size:12px">Day by day</h3>
    ${table([{ t: 'Date' }, { t: 'Cut', num: true }, { t: 'Stitched', num: true }, { t: 'Packed', num: true }, { t: 'Returned', num: true }], dayRows)}`;
  return documentShell({ title: `Status ${jobOrder.orderNo}`, bodyCss: CSS, body });
};
