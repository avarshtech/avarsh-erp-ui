import dayjs from 'dayjs';
import { documentShell, esc, openPrintWindow } from '../../../utils/printDoc';

const CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; margin: 0; }
  h1 { font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 0.4px; }
  .co { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .meta { font-size: 8px; color: #444; margin: 3px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #555; padding: 2px 4px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 8px; text-transform: uppercase; }
  /* A group heading or sub-total: the row that is not an asset. */
  tr.group td { background: #f4f4f4; font-weight: 700; }
  thead { display: table-header-group; }
  tr, td, th { page-break-inside: avoid; }
  .foot { margin-top: 8px; font-size: 8px; color: #444; }
`;

const cell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  // A date arrives as an ISO string; a report is read by people, not parsers.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return dayjs(value).format('DD-MM-YYYY');
  }
  return esc(value);
};

/**
 * The report as it stands, printed.
 *
 * Printing is the browser's own job - this prints the table the screen is
 * already showing, which is why it needs no endpoint. Excel and PDF are
 * re-run on the server, because a download is a fresh question; a print is
 * a copy of what the reader is looking at.
 */
export const printAssetReport = ({ title, columns, rows, companyName, filterSummary }) => {
  const head = columns.map((c) => `<th>${esc(c.displayName)}</th>`).join('');
  const body = rows.map((row) => {
    const first = row[columns[0]?.fieldCode];
    // Group headings and sub-totals carry their label in the first column and
    // nothing in the rest; tinting them is what makes a grouped report readable.
    const isGroup = typeof first === 'string'
      && (first.startsWith('Sub-total') || columns.slice(1).every((c) => !row[c.fieldCode]));
    return `<tr${isGroup ? ' class="group"' : ''}>${
      columns.map((c) => `<td>${cell(row[c.fieldCode])}</td>`).join('')}</tr>`;
  }).join('');

  return openPrintWindow(documentShell({
    title: String(title).replace(/[^\w-]+/g, '_'),
    bodyCss: CSS,
    body: `
      ${companyName ? `<div class="co">${esc(companyName)}</div>` : ''}
      <h1>${esc(title)}</h1>
      <div class="meta">
        ${filterSummary ? `${esc(filterSummary)} &middot; ` : ''}
        ${rows.length} row${rows.length === 1 ? '' : 's'} &middot;
        printed ${dayjs().format('DD-MM-YYYY HH:mm')}
      </div>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="foot">Computer-generated from the asset register.</div>`,
  }));
};
