/**
 * The printed Cut Panel Requirement statement and its CSV export (PRD §8.4, report 2).
 * Handed to cutting and the job-work coordinator — it carries NO vendor, rate or
 * value (AC-18). DRAFT watermark until the requirement is submitted. It wears the Supplier PO print's design
 * (utils/print/poPrintTheme) with its own sections; `org` (the cached organisation) heads it.
 */
import { esc, documentShell, openPrintWindow, documentFileName } from './printDoc';
import { downloadCsv } from './download';
import { lineTotal, processLabel, buildColourSummary, buildProcessRollup, cprTotals } from './cutPanelCalc';
import { NO_PROCESS_LABEL } from './cutPanelConstants';
import { getRequirementStatusLabel } from './requirementStatus';
import { formatDate } from './formatters';
import { PO_PRINT_CSS, companyWatermark, headerBand, detailsGrid, itemsSection, printFooter } from './print/poPrintTheme';

const n = (v) => Number(v || 0).toLocaleString('en-IN');

const sortedLines = (lines) => [...lines].sort((a, b) =>
  a.fabricName.localeCompare(b.fabricName) || a.colorName.localeCompare(b.colorName)
  || a.panelName.localeCompare(b.panelName) || a.sequenceNo - b.sequenceNo);

const CSS = `${PO_PRINT_CSS}
  .muted { color: #777; font-style: italic; }
`;

export const printCprStatement = (cpr, order, org = {}) => {
  const lines = sortedLines(cpr.lines);
  const totals = cprTotals(lines, order.sizes);
  const meta = [
    ['CPR No.', cpr.cprNo || 'Not saved'], ['Status', getRequirementStatusLabel(cpr.status)],
    ['Order No.', cpr.orderNo], ['Buyer', cpr.buyer], ['Style', cpr.styleNo],
    ['Garment', order.garmentDescription], ['BOM No.', cpr.bomNo || order.bomNo], ['Delivery', formatDate(order.deliveryDate)],
  ];
  const sizeHead = order.sizes.map((s) => `<th>${esc(s)}</th>`).join('');
  const rows = lines.map((l) => `<tr><td class="left">${esc(l.fabricName)}</td><td class="left">${esc(l.colorName)}</td><td class="left">${esc(l.panelName)}</td>
    <td class="left">${esc(processLabel(l))}</td><td class="num">${l.sequenceNo}</td><td class="num">${Number(l.allowancePct).toFixed(2)}</td>
    ${order.sizes.map((s) => `<td class="num">${n(l.sizes[s]?.requiredQty)}</td>`).join('')}<td class="num">${n(lineTotal(l))}</td></tr>`).join('');
  const foot = `<tr><td colspan="6" class="left">Total</td>${order.sizes.map((s) => `<td class="num">${n(totals.bySize[s])}</td>`).join('')}<td class="num">${n(totals.totalQty)}</td></tr>`;
  const colours = buildColourSummary(lines, order).map(({ color, panels }) => `<tr><td class="left">${esc(color.name)}</td><td class="left">${panels.length
    ? panels.map((p) => `${esc(p.panelName)} (${esc(p.fabricName)}): ${p.chain.map((c) => `${esc(c.process)} [${n(c.qty)}]`).join(' → ')}`).join('<br/>')
    : `<span class="muted">${NO_PROCESS_LABEL}</span>`}</td></tr>`).join('');
  const rollup = buildProcessRollup(lines).map((r) => `<tr><td class="left">${esc(r.process)}</td><td class="left">${esc(r.colors.join(', '))}</td>
    <td class="left">${esc(r.panels.join(', '))}</td><td class="num">${n(r.totalQty)}</td></tr>`).join('');

  const body = `${companyWatermark(org)}<div class="page-content">
    ${headerBand({ org, docLabel: 'Cut Panel Requirement', docNo: cpr.cprNo || 'Not saved', status: getRequirementStatusLabel(cpr.status) })}
    ${detailsGrid(meta)}
    ${itemsSection({ title: 'Requirement lines', body: rows, foot,
    head: `<th class="left">Fabric</th><th class="left">Colour</th><th class="left">Panel</th><th class="left">Process</th><th>Seq</th><th>Allow %</th>${sizeHead}<th>Total</th>` })}
    ${itemsSection({ title: 'Colour-wise summary', body: colours, head: '<th class="left">Colour</th><th class="left">Panels and process chain [pcs]</th>' })}
    ${itemsSection({ title: 'Process-wise roll-up', body: rollup, head: '<th class="left">Process</th><th class="left">Colours</th><th class="left">Panels</th><th>Total pcs</th>' })}
    ${printFooter(org)}
  </div>`;
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
