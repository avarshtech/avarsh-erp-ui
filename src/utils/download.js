/**
 * Browser file downloads.
 *
 * `triggerBrowserDownload` saves a blob the browser already holds. It lived as two
 * identical copies in services/hr/attendanceService.js and
 * services/inventory/openingStockService.js; both now re-export this one.
 */
export const triggerBrowserDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Text starting with = + - @ (or a tab / CR) runs as a formula in Excel; a leading
// apostrophe keeps free text such as an "Other" process name inert. Numbers pass as they are.
const FORMULA_START = /^[=+\-@\t\r]/;

const csvCell = (value) => {
  const text = typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Download rows as a CSV file. `rows` is an array of arrays (the first is usually the
 * header). A UTF-8 BOM is prepended so Excel opens accented text correctly.
 */
export const downloadCsv = (rows, filename) => {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  triggerBrowserDownload(new Blob(['﻿', body, '\r\n'], { type: 'text/csv;charset=utf-8' }), filename);
};
