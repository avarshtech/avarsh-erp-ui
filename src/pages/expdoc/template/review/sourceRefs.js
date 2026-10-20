/**
 * The reader's citations: "PACKING LIST!B12" for a spreadsheet cell, "p2" for a PDF
 * page, and "A1:D1" merged ranges — parsed to zero-based row / column indexes.
 */
const colIndex = (letters) => letters.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

export const colName = (index) => {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const parseCellRef = (ref) => {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(String(ref || '').trim().toUpperCase());
  return m ? { col: colIndex(m[1]), row: Number(m[2]) - 1 } : null;
};

export const parseRange = (range) => {
  const [a, b] = String(range || '').split(':');
  const start = parseCellRef(a);
  const end = parseCellRef(b || a);
  return start && end ? { r1: start.row, c1: start.col, r2: end.row, c2: end.col } : null;
};

/** `{page}` for a PDF citation, `{sheet, row, col}` for a cell, or null. */
export const parseEvidence = (evidence) => {
  const text = String(evidence || '').trim();
  const page = /^p(\d+)$/i.exec(text);
  if (page) return { page: Number(page[1]) };
  const bang = text.lastIndexOf('!');
  if (bang < 0) return null;
  const cell = parseCellRef(text.slice(bang + 1).split(':')[0]);
  return cell ? { sheet: text.slice(0, bang).replace(/^'|'$/g, ''), ...cell } : null;
};
