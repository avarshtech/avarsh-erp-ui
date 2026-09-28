/**
 * The printed Cut Panel Requirement statement and its CSV export (PRD §8.4, report 2).
 * Handed to cutting and the job-work coordinator — it carries NO vendor, rate or
 * value (AC-18). DRAFT watermark until the requirement is submitted.
 */
import { esc, documentShell, openPrintWindow, documentFileName } from './printDoc';
import { downloadCsv } from './download';
import { lineTotal, processLabel, buildColourSummary, buildProcessRollup, cprTotals } from './cutPanelCalc';
import { NO_PROCESS_LABEL } from './cutPanelConstants';
import { getRequirementStatusLabel } from './requirementStatus';
import { formatDate } from './formatters';

const n = (v) => Number(v || 0).toLocaleString('en-IN');

const sortedLines = (lines) => [...lines].sort((a, b) =>
  a.fabricName.localeCompare(b.fabricName) || a.colorName.localeCompare(b.colorName)
  || a.panelName.localeCompare(b.panelName) || a.sequenceNo - b.sequenceNo);

const CSS = `
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 18px; }
  h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 16px 0 6px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 16px; margin: 10px 0; }
  .meta b { display: block; font-size: 9px; color: #666; text-transform: uppercase; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #bbb; padding: 3px 5px; }
  th { background: #f0f0f0; } td.num, th.num { text-align: right; } tfoot td { font-weight: bold; }
  .muted { color: #777; font-style: italic; }
`;

export const printCprStatement = (cpr, order) => {
  const lines = sortedLines(cpr.lines);
  const totals = cprTotals(lines, order.sizes);
  const meta = [
    ['CPR No.', cpr.cprNo || 'Not saved'], ['Status', getRequirementStatusLabel(cpr.status)],
    ['Order No.', cpr.orderNo], ['Buyer', cpr.buyer], ['Style', cpr.styleNo],
    ['Garment', order.garmentDescription], ['BOM Version', cpr.bomVersion], ['Delivery', formatDate(order.deliveryDate)],
  ].map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('');
  const sizeHead = order.sizes.map((s) => `<th class="num">${esc(s)}</th>`).join('');
  const rows = lines.map((l) => `<tr><td>${esc(l.fabricName)}</td><td>${esc(l.colorName)}</td><td>${esc(l.panelName)}</td>
    <td>${esc(processLabel(l))}</td><td class="num">${l.sequenceNo}</td><td class="num">${Number(l.allowancePct).toFixed(2)}</td>
    ${order.sizes.map((s) => `<td class="num">${n(l.sizes[s]?.requiredQty)}</td>`).join('')}<td class="num">${n(lineTotal(l))}</td></tr>`).join('');
  const foot = `<tr><td colspan="6">Total</td>${order.sizes.map((s) => `<td class="num">${n(totals.bySize[s])}</td>`).join('')}<td class="num">${n(totals.totalQty)}</td></tr>`;
  const colours = buildColourSummary(lines, order).map(({ color, panels }) => `<tr><td>${esc(color.name)}</td><td>${panels.length
    ? panels.map((p) => `${esc(p.panelName)} (${esc(p.fabricName)}): ${p.chain.map((c) => `${esc(c.process)} [${n(c.qty)}]`).join(' → ')}`).join('<br/>')
    : `<span class="muted">${NO_PROCESS_LABEL}</span>`}</td></tr>`).join('');
  const rollup = buildProcessRollup(lines).map((r) => `<tr><td>${esc(r.process)}</td><td>${esc(r.colors.join(', '))}</td>
    <td>${esc(r.panels.join(', '))}</td><td class="num">${n(r.totalQty)}</td></tr>`).join('');

  const body = `<h1>Cut Panel Requirement</h1><div class="meta">${meta}</div>
    <h2>Requirement lines</h2><table><thead><tr><th>Fabric</th><th>Colour</th><th>Panel</th><th>Process</th><th class="num">Seq</th><th class="num">Allow %</th>${sizeHead}<th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${foot}</tfoot></table>
    <h2>Colour-wise summary</h2><table><thead><tr><th>Colour</th><th>Panels and process chain [pcs]</th></tr></thead><tbody>${colours}</tbody></table>
    <h2>Process-wise roll-up</h2><table><thead><tr><th>Process</th><th>Colours</th><th>Panels</th><th class="num">Total pcs</th></tr></thead><tbody>${rollup}</tbody></table>`;
  const title = documentFileName({ docType: 'CutPanelRequirement', buyer: cpr.buyer, docNo: cpr.cprNo || 'draft' }).replace(/\.pdf$/, '');
  return openPrintWindow(documentShell({ title, bodyCss: CSS, draft: cpr.status === 'DRAFT', body }));
};

export const exportCprCsv = (cpr, order) => {
  const head = ['CPR No.', 'Order No.', 'Style', 'Fabric', 'Colour', 'Panel', 'Process', 'Seq', 'Allowance %', ...order.sizes, 'Total'];
  const rows = sortedLines(cpr.lines).map((l) => [
    cpr.cprNo || '', cpr.orderNo, cpr.styleNo, l.fabricName, l.colorName, l.panelName, processLabel(l),
    l.sequenceNo, Number(l.allowancePct).toFixed(2), ...order.sizes.map((s) => l.sizes[s]?.requiredQty ?? 0), lineTotal(l),
  ]);
  downloadCsv([head, ...rows], `${cpr.cprNo || 'cut-panel-requirement-draft'}.csv`);
};
