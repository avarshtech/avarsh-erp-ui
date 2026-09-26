import dayjs from 'dayjs';
import sristiLogo from '../assets/images/sristi_logo.jpeg';
import { esc, escAttr, documentShell } from './printDoc';
import { getWorkOrderPrint } from '../services/po/production/workOrderService';
import { getFilesByEntity, downloadFileAsBlob } from '../services/core/fileService';

/**
 * Work Order print — the house WORK ORDER sheet handed to the sewing unit:
 * order details beside the style sketch, the CMT cost, the cutting block (fabrics,
 * unit, ship date, garment processes and the size grid) and the accessories list
 * with each item's ordered / in-house status, then the four signatures.
 *
 * The data comes from one API call (GET /work-order/{id}/print) so the sheet needs
 * no permission beyond the work order's own.
 */

const MIN_SIZE_COLS = 6;
// 30/Mar/16, as the sheet has always read (the en-GB locale would print "Sept")
const fmtDate = (d) => (d ? dayjs(d).format('DD/MMM/YY') : '');
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
// 220.000000 → 220, 1.450000 → 1.45
const qty = (n) => (n == null ? '' : String(Number(Number(n).toFixed(3))));
const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The style sketch as a data URL, or null — a missing image never blocks the print. */
const styleImage = async (styleId) => {
  if (!styleId) return null;
  try {
    const files = await getFilesByEntity('STYLE', styleId);
    const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
    if (!img) return null;
    const blob = await downloadFileAsBlob(img.fileId);
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const cmtCost = (d) => {
  if (d.rateFrom == null) return '';
  return d.rateTo != null && Number(d.rateTo) !== Number(d.rateFrom)
    ? `${money(d.rateFrom)} – ${money(d.rateTo)}` : money(d.rateFrom);
};

const fabricLines = (fabrics) => fabrics.map((f, i) => {
  const parts = [f.particulars, f.spec].filter(Boolean).join(' - ');
  return `Fab${i + 1}: ${esc(parts)}${f.perGarment != null ? ` - ${esc(qty(f.perGarment))}${esc(f.uom || '')}` : ''}`;
}).join('<br/>');

/** Sizes in the order the matrix holds them; one row per colour; planned (cutting) qty. */
const sizeGrid = (items) => {
  const sizes = [...new Set(items.map((i) => i.size))];
  const colours = [...new Set(items.map((i) => i.color))];
  const cols = [...sizes, ...Array(Math.max(0, MIN_SIZE_COLS - sizes.length)).fill('')];
  const q = (colour, size) => items.filter((i) => i.color === colour && i.size === size)
    .reduce((s, i) => s + (i.plannedQty || 0), 0);
  const rows = colours.map((c) => {
    const cells = cols.map((s) => `<td class="c">${s ? num(q(c, s)) : ''}</td>`).join('');
    const total = sizes.reduce((s, sz) => s + q(c, sz), 0);
    return `<tr><td class="c b">${colours.length > 1 ? esc(c) : 'Qty'}</td>${cells}<td class="c">${num(total)}</td></tr>`;
  }).join('');
  const sizeTotals = cols.map((s) => `<td class="c">${s ? num(colours.reduce((t, c) => t + q(c, s), 0)) : '0'}</td>`).join('');
  const grand = items.reduce((s, i) => s + (i.plannedQty || 0), 0);
  return `
    <tr class="grey"><td class="c b big">SIZE</td>${cols.map((s) => `<td class="c b big">${esc(s)}</td>`).join('')}<td class="c b big">TOTAL</td></tr>
    ${rows}
    <tr class="lav"><td class="c b big">QUANTITY</td>${sizeTotals}<td class="c b big">${num(grand)}</td></tr>`;
};

const accessoryRows = (fabrics, accessories) => {
  const rows = [];
  if (fabrics.length) {
    const ordered = fabrics.filter((f) => f.status === 'Ordered').length;
    rows.push({
      particulars: fabrics.map((f, i) => `Fabric${i + 1}`).join(', '), spec: '', required: 'See on top',
      status: ordered === fabrics.length ? 'Ordered' : ordered ? 'Part ordered' : 'IH', remarks: '',
    });
  }
  accessories.forEach((a) => rows.push({
    particulars: a.particulars, spec: a.spec,
    required: a.perGarment != null ? `${qty(a.perGarment)} ${a.uom || ''}`.trim() : '',
    status: a.status, remarks: a.remarks,
  }));
  return rows.map((r, i) => `<tr>
    <td class="c">${i + 1}</td><td class="b">${esc(r.particulars)}</td><td>${esc(r.spec)}</td>
    <td class="b">${esc(r.required)}</td><td class="b">${esc(r.status)}</td><td>${esc(r.remarks)}</td></tr>`).join('');
};

const CSS = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Calibri, Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 12px; }
  .logo { text-align: center; margin-bottom: 6px; } .logo img { max-height: 60px; }
  table { width: 100%; border-collapse: collapse; }
  td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .title { background: #d9d9d9; text-align: center; font-weight: 700; font-size: 16px; }
  .band { background: #ffff00; text-align: center; font-weight: 700; }
  .grey { background: #d9d9d9; } .lav { background: #ccc0da; }
  .b { font-weight: 700; } .c { text-align: center; } .big { font-size: 14px; }
  .lbl { font-weight: 700; width: 17%; } .red { color: #c00000; font-weight: 700; }
  .pono { font-size: 18px; font-weight: 700; text-align: center; }
  .img { text-align: center; vertical-align: middle; } .img img { max-width: 100%; max-height: 190px; }
  .note { font-weight: 700; font-size: 14px; }
  .plain td { border: none; } .cmt { font-weight: 700; font-size: 11px; padding: 6px 2px; }
  .sign { display: flex; justify-content: space-around; margin-top: 28px; font-weight: 700; }
`;

/** Build the sheet's HTML from the print payload and the (optional) style image. */
export const buildWorkOrderHtml = (d, imageUrl) => {
  const fabrics = d.fabrics || [];
  const accessories = d.accessories || [];
  const sizeCols = Math.max(MIN_SIZE_COLS, new Set((d.items || []).map((i) => i.size)).size);
  const detail = (label, value, cls = 'c') => `<td class="lbl">${esc(label)}</td><td class="${cls}">${esc(value)}</td>`;
  const body = `
    <div class="logo"><img src="${escAttr(sristiLogo)}" alt="Logo" /></div>
    <table>
      <tr><td class="title" colspan="5">WORK ORDER</td></tr>
      <tr><td class="band" colspan="4">ORDER DETAILS</td>
        <td class="img" rowspan="6" style="width:34%">
          ${imageUrl ? `<img src="${escAttr(imageUrl)}" alt="Style" />` : ''}
          ${d.remarks ? `<div class="note">${esc(d.remarks)}</div>` : ''}
        </td></tr>
      <tr>${detail('BUYER', d.buyerName, 'c b')}${detail('WORKORDER NO', d.workOrderNo, 'c b')}</tr>
      <tr>${detail('STYLE NAME / NO', d.styleNo, 'c red')}${detail('PO RCVD DATE', fmtDate(d.poReceivedDate))}</tr>
      <tr>${detail('COLOUR', (d.colours || []).join(', '))}${detail('DEL DATE', fmtDate(d.deliveryDate))}</tr>
      <tr>${detail('DESCRIPTION', d.description, 'c b')}${detail('PO QTY', num(d.poQty), 'c b')}</tr>
      <tr>${detail('ISSUED DT', fmtDate(d.issuedDate))}<td class="lbl">PO NO :</td><td class="pono">${esc(d.buyerPoNo || d.orderNo)}</td></tr>
    </table>
    <table class="plain"><tr><td class="cmt">CMT Cost - Rs. ${esc(cmtCost(d))} &nbsp; upto packing.</td></tr></table>
    <table>
      <tr><td class="band" colspan="${sizeCols + 2}">CUTTING QUANTITY DETAILS</td></tr>
      <tr><td class="lbl">FABRICS</td>
        <td class="b" colspan="${Math.ceil(sizeCols / 2)}">${fabricLines(fabrics) || '&mdash;'}</td>
        <td class="b big" colspan="${sizeCols - Math.ceil(sizeCols / 2) + 1}" style="vertical-align:top">
          UNIT: ${esc(d.processingUnitName)}<br/>Ship date: ${esc(fmtDate(d.shipDate))}<br/>
          Garment Process: ${esc((d.garmentProcesses || []).join(', '))}</td></tr>
      ${sizeGrid(d.items || [])}
    </table>
    <table style="margin-top:14px">
      <tr><td class="band" colspan="6">ACCESSORIES DETAILS</td></tr>
      <tr class="grey"><td class="c b" style="width:7%">S.NO</td><td class="c b" style="width:28%">PARTICULARS</td>
        <td class="c b" style="width:18%">SPEC</td><td class="c b" style="width:15%">REQUIRED QTY/GMT</td>
        <td class="c b" style="width:12%">Status</td><td class="c b">Remarks</td></tr>
      ${accessoryRows(fabrics, accessories)}
    </table>
    <div class="sign"><span>CONFIRMED BY</span><span>PASSED BY</span><span>CHECKED BY</span><span>ACCEPTED BY</span></div>`;
  return documentShell({
    title: d.workOrderNo || 'Work Order',
    bodyCss: CSS,
    // Only an approved work order goes to the floor as an original
    watermark: d.status === 'CANCELLED' ? 'CANCELLED' : d.status !== 'APPROVED' ? 'DRAFT' : undefined,
    body,
  });
};

/**
 * Print a work order. Resolves false when the pop-up was blocked, so the caller
 * can tell the user; throws when the work order could not be loaded.
 *
 * The window is opened on the click, before anything is awaited: a window opened
 * after a network round-trip is no longer tied to the user's gesture, and pop-up
 * blockers refuse it.
 */
export const printWorkOrder = async (workOrderId) => {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write('<p style="font-family:Arial,sans-serif;padding:24px">Preparing work order…</p>');
  try {
    const data = await getWorkOrderPrint(workOrderId);
    const imageUrl = await styleImage(data.styleId);
    win.document.open();
    win.document.write(buildWorkOrderHtml(data, imageUrl));
    win.document.close();
    setTimeout(() => { try { win.print(); } catch { /* the user can still print from the window */ } }, 500);
    return true;
  } catch (e) {
    win.close();
    throw e;
  }
};
