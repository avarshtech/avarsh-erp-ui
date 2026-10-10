/**
 * Export Documentation — document renderers.
 *
 * One builder per document, producing a self-contained HTML string. It has exactly
 * two consumers: the on-screen preview (an iframe srcDoc) and the print window.
 * They cannot diverge, because there is only one renderer — which is the whole
 * point, given the PRD's complaint that today's spreadsheets disagree with each
 * other (PRD §2).
 *
 * Layout comes from the buyer template: the same `columns` spec the workspace grid
 * uses, expanded against the same frozen size list. A column added to a template
 * appears on screen and on paper in the same place, or in neither.
 */
import exporterLogo from '../assets/images/sristi_logo.jpeg';
import { esc, escAttr, documentShell, pageCss } from './printDoc';
import { amountInWords } from './amountInWords';
import {
  expandColumns, expandColumnSpec, resolveBinding, formatBound,
} from './expDocTemplateSchema';
import {
  cartonCount, piecesPerCarton, piecesPerAssortment, totalPieces, cbmPerCarton, dimensionsLabel,
  sizeQtyPerCarton, formatRanges, sectionTotals, grandTotals, weightPerPiece,
} from './expDocCalc';
import {
  textBlocksHtml, groupedHeadRows, sheetSections, blocksOf, blockTitleOf, totalsListHtml,
  invoiceBoxPrinter, invoiceExtraFieldsHtml, templateInvoiceColumns, labelledValue, isTemplateBinding,
} from './expDocHtmlBlocks';
import {
  PACKING_TYPE_LABELS, SECTION_KEY, MIN_TEXT_PT, TEXT_ROLES, docFontStack, mainTextPt, textSizePt,
} from './expDocConstants';

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/*
 * The document's top band (see docHead): the exporter's logo and name on the left, the
 * document's title and reference on the right. No rule under it — the exporter and
 * buyer boxes below have borders of their own.
 */
const DOC_HEAD_CSS = `
  table.doc-head { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .doc-head td { border: none; padding: 0 0 6px; vertical-align: middle; }
  .doc-head .brand { white-space: nowrap; }
  .doc-head .brand img { width: 40px; height: 40px; object-fit: contain; vertical-align: middle; margin-right: 10px; }
  .doc-head .brand-text { display: inline-block; vertical-align: middle; white-space: normal; }
  .doc-head .co { font-size: 12px; font-weight: 700; letter-spacing: 0.3px; }
  .doc-head .co-sub { font-size: 8px; color: #555; max-width: 120mm; }
  .doc-head .co-sub .seg { white-space: nowrap; }
  .doc-head .doc-title { text-align: right; }
  .doc-head .doc-title.solo { text-align: left; }
  .doc-head .t { font-size: 14px; font-weight: 800; letter-spacing: 2px; }
  .doc-head .ref { font-size: 9px; color: #555; margin-top: 2px; }
`;

const PL_CSS = `
  ${DOC_HEAD_CSS}
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #111; padding: 8mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #333; padding: 3px 5px; }
  th { background: #f0f0f0; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
  td.n, th.n { text-align: right; }
  td.c, th.c { text-align: center; }
  tr.total td { font-weight: 700; background: #fafafa; }
  .hdr td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
  .hdr .lbl { font-size: 7.5px; color: #555; font-style: italic; }
  .hdr .val { font-size: 9.5px; }
  .section-title { font-size: 10px; font-weight: 700; margin: 10px 0 4px; }
  .note { font-size: 8px; color: #555; margin-top: 2px; }
  .summary td { border: 1px solid #333; padding: 4px 6px; font-size: 9px; }
  .grand { font-size: 10px; font-weight: 700; }
`;

/**
 * Whether the document prints the exporter's details in a section of its own: the
 * invoice's Exporter box (unless the buyer's form hides it), or a packing-list field or
 * block bound to the exporter.
 */
const hasExporterSection = (template) => {
  if (template?.docType === 'INVOICE') return !template?.invoiceHeader?.boxes?.exporter?.hidden;
  return [...(template?.addressBlocks || []), ...(template?.headerFields || [])]
    .some((f) => String(f?.binding || '').startsWith('exporter.'));
};

/**
 * The top of the document as one band: the exporter's logo and name on the left, what
 * the document is — its title and reference — on the right, level with each other. The
 * letterhead prints when the layout asks for it (`identity.showLogo`); buyers who supply
 * pre-printed stationery turn it off, and then only the title and reference print.
 *
 * The address, GSTIN and IEC print in the exporter's own section, so the band repeats
 * them only on a document that has no such section — where it is the one place saying
 * who shipped the goods. The reference is the document's own data (see `.v`).
 */
const docHead = (template, ctx, title, reference) => {
  const brandOn = template?.identity?.showLogo !== false;
  const ex = ctx.exporter || {};
  // The block's first line is the name, printed on its own already. Each line stays
  // whole ("GSTIN: 27AAB…" never splits); the band wraps only after a separating dot.
  const lines = brandOn && !hasExporterSection(template)
    ? String(ex.block || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(1)
    : [];
  const details = lines.map((l, i) => `<span class="seg">${esc(l)}${i < lines.length - 1 ? '&nbsp;&middot;' : ''}</span>`).join(' ');
  const brand = brandOn ? `<td class="brand"><img src="${escAttr(exporterLogo)}" alt="" /><div class="brand-text">
      <div class="co">${esc(ex.name || '')}</div>${details ? `<div class="co-sub">${details}</div>` : ''}</div></td>` : '';
  return `<table class="doc-head"><tr>${brand}<td class="doc-title${brandOn ? '' : ' solo'}">
      <div class="t">${esc(title)}</div>${reference ? `<div class="ref v">${esc(reference)}</div>` : ''}</td></tr></table>`;
};

/**
 * Header grid: the template's header fields, three to a row, each label and value on
 * one line. A labelled field with no data source still prints — its label with an
 * empty value, as the buyer's form has it.
 */
const headerGrid = (template, ctx) => {
  const fields = (template?.headerFields || []).filter((f) => f.binding || f.fixedValue || f.label);
  if (!fields.length) return '';
  const rows = [];
  for (let i = 0; i < fields.length; i += 3) rows.push(fields.slice(i, i + 3));
  return `<table class="hdr">${rows.map((row) => `<tr>${row
    .map((f) => {
      const raw = f.fixedValue ?? resolveBinding(f.binding, ctx);
      const data = f.fixedValue == null && !isTemplateBinding(f.binding);
      return `<td style="width:33.3%">${labelledValue(f.label, formatBound(raw, { emptyText: '—' }), { data })}</td>`;
    })
    .join('')}${row.length < 3 ? '<td></td>'.repeat(3 - row.length) : ''}</tr>`).join('')}</table>`;
};

/** Address blocks the template asks for, side by side. */
const addressBlocks = (template, ctx) => {
  const blocks = template?.addressBlocks || [];
  if (!blocks.length) return '';
  return `<table class="hdr"><tr>${blocks
    .map((b) => `<td style="width:${(100 / blocks.length).toFixed(1)}%"><div class="lbl">${esc(b.label)}</div><div class="${
      isTemplateBinding(b.binding) ? 'val' : 'val v'}">${esc(resolveBinding(b.binding, ctx) || '—')}</div></td>`)
    .join('')}</tr></table>`;
};

/** One cell of the carton grid — the same derivations the screen performs. */
const cellValue = (col, row) => {
  switch (col.binding) {
    case 'row.cartonRange': return formatRanges([{ from: row.cartonFrom, to: row.cartonTo }]);
    case 'row.cartonCount': return num(cartonCount(row));
    case 'row.packingType': return PACKING_TYPE_LABELS[row.packingType] || row.packingType;
    case 'calc.piecesPerCarton': return num(piecesPerCarton(row));
    case 'calc.totalPieces': return num(totalPieces(row));
    case 'calc.cbm': return num(cbmPerCarton(row), 3);
    case 'calc.dimensions': return dimensionsLabel(row) || '—';
    // Per-row totals — the carton value times the cartons in the row.
    case 'calc.totalNetWeightKg': return num((Number(row.netWeightKg) || 0) * cartonCount(row), 3);
    case 'calc.totalGrossWeightKg': return num((Number(row.grossWeightKg) || 0) * cartonCount(row), 3);
    case 'calc.totalCbm': return num(cbmPerCarton(row) * cartonCount(row), 3);
    case 'calc.piecesPerAssortment': return num(piecesPerAssortment(row));
    default: break;
  }
  if (col.isSizeColumn) {
    // A ratio pack's size cells print the assortment ratio when the layout says so.
    const q = col.sizeValue === 'RATIO' && row.ratio ? row.ratio[col.size] : sizeQtyPerCarton(row)[col.size];
    return q ? num(q) : '—';
  }
  return formatBound(resolveBinding(col.binding, { row, calc: {} }, { decimals: col.decimals }), {
    decimals: col.decimals,
    prefix: col.prefix,
    suffix: col.suffix,
  });
};

const alignClass = (col) => (col.align === 'right' ? ' class="n"' : col.align === 'center' ? ' class="c"' : '');

/** A data cell's classes: its alignment, and `v` unless the column prints the template's own text. */
const valueClass = (col) => {
  const names = [col.align === 'right' ? 'n' : (col.align === 'center' ? 'c' : ''), isTemplateBinding(col.binding) ? '' : 'v'];
  const joined = names.filter(Boolean).join(' ');
  return joined ? ` class="${joined}"` : '';
};

/** One carton row, and a mixed carton's colour sub-row. */
const rowHtml = (row, spec) => {
  const main = `<tr>${spec.map((c) => `<td${valueClass(c)}>${esc(cellValue(c, row))}</td>`).join('')}</tr>`;
  // A mixed carton's colours cannot fit one line, so they follow as a sub-row —
  // the same shape the buyer's own workbook uses.
  if (!row.mixedRows?.length) return main;
  const colours = row.mixedRows
    .map((mr) => {
      const sizes = Object.entries(mr.sizeQty || {}).filter(([, q]) => Number(q))
        .map(([s, q]) => `${s}: ${q}`).join('   ');
      return `${mr.colorName || '—'} — ${sizes}`;
    })
    .join(' | ');
  return `${main}<tr><td colspan="${spec.length}" class="colours v" style="color:#444;padding-left:14px;">${esc(colours)}</td></tr>`;
};

/**
 * A total row. When the layout has a per-row total column ("TTL NT.WT"), the weight
 * or CBM total prints under it rather than under the per-carton column; a size column
 * that prints the assortment ratio has no meaningful sum.
 */
const totalRowHtml = (spec, totals, label) => {
  const has = (binding) => spec.some((c) => c.binding === binding);
  const n3 = (v) => `<td class="n v">${num(v, 3)}</td>`;
  return `<tr class="total">${spec.map((c, i) => {
    if (i === 0) return `<td>${label}</td>`;
    if (c.binding === 'row.cartonCount') return `<td class="n v">${num(totals.cartons)}</td>`;
    if (c.isSizeColumn) {
      if (c.sizeValue === 'RATIO') return '<td></td>';
      return `<td class="n v">${totals.sizeQty?.[c.size] ? num(totals.sizeQty[c.size]) : ''}</td>`;
    }
    if (c.binding === 'calc.totalPieces') return `<td class="n v">${num(totals.pieces)}</td>`;
    if (c.binding === 'row.netWeightKg') return has('calc.totalNetWeightKg') ? '<td></td>' : n3(totals.netWeightKg);
    if (c.binding === 'calc.totalNetWeightKg') return n3(totals.netWeightKg);
    if (c.binding === 'row.grossWeightKg') return has('calc.totalGrossWeightKg') ? '<td></td>' : n3(totals.grossWeightKg);
    if (c.binding === 'calc.totalGrossWeightKg') return n3(totals.grossWeightKg);
    if (c.binding === 'calc.cbm') return has('calc.totalCbm') ? '<td></td>' : n3(totals.cbm);
    if (c.binding === 'calc.totalCbm') return n3(totals.cbm);
    return '<td></td>';
  }).join('')}</tr>`;
};

/**
 * A packing section: header row(s), carton rows, and its own total row. A sheet that
 * blocks its rows by order / style prints a heading and a subtotal per block.
 */
const sectionTable = (section, spec, title, sheet = {}) => {
  const totals = sectionTotals(section.rows);
  // The template's column widths, honoured. A colgroup rather than per-cell widths
  // so a column that the layout does not size still shares what is left over.
  const cols = spec.some((c) => c.width)
    ? `<colgroup>${spec.map((c) => (c.width ? `<col style="width:${Number(c.width)}px" />` : '<col />')).join('')}</colgroup>`
    : '';
  const head = groupedHeadRows(spec, alignClass)
    || `<tr>${spec.map((c) => `<th${alignClass(c)}>${esc(c.label)}</th>`).join('')}</tr>`;

  const body = sheet.blockBy?.length
    ? blocksOf(section.rows, sheet.blockBy).map((rows) => `<tr><td colspan="${spec.length}" class="v" style="font-weight:700;background:#f7f7f7;">${
      esc(blockTitleOf(sheet, rows[0]))}</td></tr>${rows.map((row) => rowHtml(row, spec)).join('')}${
      sheet.blockTotals === false ? '' : totalRowHtml(spec, sectionTotals(rows), 'Subtotal')}`).join('')
    : (section.rows || []).map((row) => rowHtml(row, spec)).join('');

  const totalRow = totalRowHtml(spec, totals, 'Total');

  return `<div class="section-title">${esc(title)}</div>
    <table class="cols">${cols}${head}${body}${totalRow}</table>`;
};

/** A summary sheet with no `blocks` list is the original full summary. */
const ALL_SUMMARY_BLOCKS = ['GRAND_TOTAL', 'WEIGHT_PER_PIECE', 'ORDER_VS_SHIPPED'];

/**
 * Grand total, weight per piece, the order-vs-shipped summary (PRD §7.4) and the
 * footer totals list — whichever of them the summary sheet asks for.
 */
const summaryBlock = (pl, template, blocks) => {
  const want = new Set(blocks?.length ? blocks : ALL_SUMMARY_BLOCKS);
  const totals = grandTotals(pl.sections);
  const list = want.has('TOTALS_LIST') ? totalsListHtml(pl, totals) : '';
  if (!want.has('GRAND_TOTAL') && !want.has('WEIGHT_PER_PIECE') && !want.has('ORDER_VS_SHIPPED')) return list;
  const wpp = weightPerPiece(totals, {
    weightPerPieceDecimals: template?.formatting?.weightPerPieceDecimals ?? 5,
  });
  const dp = template?.formatting?.weightPerPieceDecimals ?? 5;

  const grand = !want.has('GRAND_TOTAL') && !want.has('WEIGHT_PER_PIECE') ? '' : `<table class="summary cols">
    <tr>
      <td>Total cartons</td><td class="grand v">${num(totals.cartons)}</td>
      <td>Total pieces</td><td class="grand v">${num(totals.pieces)}</td>
      <td>Carton numbers</td><td class="grand v">${esc(formatRanges((pl.sections || []).flatMap((s) => (s.rows || []).map((r) => ({ from: r.cartonFrom, to: r.cartonTo })))))}</td>
    </tr>
    <tr>
      <td>Net weight (kg)</td><td class="grand v">${num(totals.netWeightKg, 3)}</td>
      <td>Gross weight (kg)</td><td class="grand v">${num(totals.grossWeightKg, 3)}</td>
      <td>CBM</td><td class="grand v">${num(totals.cbm, 3)}</td>
    </tr>
    <tr>
      <td>Net / piece (kg)</td><td class="grand v">${wpp.netPerPiece.toFixed(dp)}</td>
      <td>Gross / piece (kg)</td><td class="grand v">${wpp.grossPerPiece.toFixed(dp)}</td>
      <td></td><td></td>
    </tr>
  </table>`;

  if (!want.has('ORDER_VS_SHIPPED')) return `${grand}${list}`;
  const variance = pl.orderVsPacked || [];
  if (!variance.length) {
    return `${grand}<div class="note">No ordered breakdown was captured for this packing list.</div>${list}`;
  }

  const rows = variance.map((v) => `<tr>
      <td class="v">${esc(v.styleNo)}</td><td class="v">${esc(v.colorName)}</td><td class="c v">${esc(v.size)}</td>
      <td class="n v">${num(v.orderQty)}</td><td class="n v">${num(v.shippedQty)}</td>
      <td class="n v">${v.variance ? (v.variance > 0 ? `+${num(v.variance)}` : num(v.variance)) : '—'}</td>
    </tr>`).join('');
  const tot = variance.reduce((a, v) => ({
    o: a.o + v.orderQty, s: a.s + v.shippedQty, d: a.d + v.variance,
  }), { o: 0, s: 0, d: 0 });

  return `${grand}
    <div class="section-title">Order vs shipped</div>
    <table class="cols">
      <tr><th>Style</th><th>Colour</th><th class="c">Size</th><th class="n">Order qty</th><th class="n">Shipped qty</th><th class="n">Excess / shortage</th></tr>
      ${rows}
      <tr class="total"><td colspan="3">Total</td><td class="n v">${num(tot.o)}</td><td class="n v">${num(tot.s)}</td><td class="n v">${tot.d > 0 ? `+${num(tot.d)}` : num(tot.d)}</td></tr>
    </table>${list}`;
};

/**
 * Render a packing list in its buyer's layout.
 *
 * An approved document renders from its APPROVAL SNAPSHOT, not from live data
 * (BR-08) — re-printing a year later must reproduce what was approved, even if the
 * exporter address or the template has changed since.
 */
/*
 * The band a document carries.
 *
 * A cancelled or superseded document HAS an approval snapshot, so "approved
 * therefore clean" would print a voided invoice as a valid one — the worst thing
 * this module could put in front of a customs broker. The band names the actual
 * state instead, and only a genuinely approved, current document prints clean.
 */
/** Page box in millimetres for a template's paper and orientation (§10.1, §18). */
const PAPER_MM = { A4: [210, 297], A3: [297, 420], LETTER: [216, 279] };

const pageBox = (identity, fallbackLandscape) => {
  const [w, h] = PAPER_MM[identity?.paper] || PAPER_MM.A4;
  const landscape = identity?.orientation
    ? identity.orientation === 'LANDSCAPE'
    : Boolean(fallbackLandscape);
  const m = Array.isArray(identity?.marginsMm) ? Number(identity.marginsMm[0]) || 0 : 0;
  return { widthMm: landscape ? h : w, heightMm: landscape ? w : h, marginMm: m };
};

/**
 * The page a packing-list or invoice template prints on, in millimetres — the same box
 * the builders below use, so a preview can show the page at its real proportions. A
 * packing list defaults to landscape, an invoice to portrait.
 */
export const templatePageMm = (template) => pageBox(template?.identity, template?.docType === 'PACKING_LIST');

/**
 * The template's own typography. A layout that could set a font and a size but
 * printed Arial 8.5px regardless made the builder's Formatting tab a decoration.
 * A font from the formatting list prints with its own fallbacks (a serif falls back
 * to a serif); any other name is cleaned and falls back to a sans-serif.
 */
const fontCss = (formatting, docType) => {
  const family = formatting?.font || 'Arial';
  const stack = docFontStack(family) || `${String(family).replace(/[^\w \-,]/g, '')}, Helvetica, sans-serif`;
  const pt = Math.max(MIN_TEXT_PT, mainTextPt(formatting, docType));
  return `body { font-family: ${stack}; font-size: ${pt}pt; }`;
};

/** Where each kind of text (TEXT_ROLES) sits in a printed packing list. */
const PL_TEXT = {
  title: '.doc-head .t',
  company: '.doc-head .co',
  section: '.doc-head .ref, .section-title, .summary td, .grand',
  heading: 'th',
  value: '.hdr .val',
  label: '.hdr .lbl',
  note: '.note, .doc-head .co-sub, td.colours',
};

/** Where each kind of text sits in a printed invoice. */
const INV_TEXT = {
  title: '.doc-head .t, .title span',
  company: '.doc-head .co',
  heading: 'th',
  value: '.val',
  label: '.lbl',
  note: '.muted, .doc-head .co-sub, td.foot',
};

/**
 * The cells of the column tables (`table.cols`) — packing-list sections and summary
 * sheets, the invoice's goods lines and annexes — are centred, headings, figures and
 * text alike, as the export team asked. The header and parties boxes keep their left
 * alignment, and so does the invoice's bank and declaration panel, which is running
 * text. Placed after the fixed stylesheet, so it wins over the column alignments.
 */
const COLUMN_CELLS_CSS = `
  table.cols th, table.cols td { text-align: center; vertical-align: middle; }
  table.cols td.foot { text-align: left; vertical-align: top; }
`;

/**
 * Every kind of text at the size the template gives it (see TEXT_ROLES) — after the
 * fixed stylesheet, so these win. Before this only the main text followed the
 * template, and labels, headings and notes stayed at 6pt or less on paper.
 */
const textCss = (formatting, docType, selectors) => TEXT_ROLES
  .filter((role) => selectors[role.key])
  .map((role) => `${selectors[role.key]} { font-size: ${textSizePt(formatting, role, docType)}pt; }`)
  .join('\n');

/**
 * A date in the template's configured format. Only the three tokens the seeded
 * templates use are supported; anything else prints the ISO date unchanged, which
 * is correct and readable rather than a guess.
 */
export const formatDocDate = (value, formatting) => {
  const iso = String(value ?? '');
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  switch (formatting?.dateFormat) {
    case 'DD-MMM-YYYY': return `${d}-${MONTHS[Number(mo) - 1]}-${y}`;
    case 'DD/MM/YYYY': return `${d}/${mo}/${y}`;
    case 'YYYY-MM-DD': return `${y}-${mo}-${d}`;
    default: return iso;
  }
};

const bandFor = (status, hasSnapshot, override) => {
  if (override !== undefined) return override ? 'DRAFT' : null;
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'SUPERSEDED') return 'SUPERSEDED';
  return hasSnapshot ? null : 'DRAFT';
};

export const buildPackingListHtml = (pl, options = {}) => {
  const snapshot = pl.finalSnapshot?.payload;
  const source = snapshot ? { ...pl, ...snapshot } : pl;
  const template = pl.template || {};
  const sizes = source.sizes || [];
  const spec = expandColumns(template, sizes);
  const band = bandFor(pl.status, Boolean(pl.finalSnapshot), options.draft);
  const draft = band === 'DRAFT';

  const ctx = {
    pl: source,
    exporter: options.exporter || {},
    buyer: { name: source.buyerName },
    shipment: options.shipment || {},
    style: {},
    row: {},
    calc: {},
    invoice: {},
  };

  /*
   * Each grid sheet prints the sections it includes — with its own column set when the
   * buyer's layout differs per section (solid packs vs ratio packs), and only the rows
   * of its packing types when it names any (see sheetSections). A sheet split by
   * packing type that ends up with no rows is left out rather than printed empty.
   */
  const gridSheets = (template.sheets || [{ key: 'MAIN', title: 'PACKING LIST', include: [SECTION_KEY.MAIN] }])
    .filter((sheet) => sheet.type !== 'SUMMARY');
  const bySheet = sheetSections(gridSheets, source.sections);
  const typed = gridSheets.some((sheet) => sheet.packingTypes?.length);
  const sheets = gridSheets
    .map((sheet, i) => bySheet[i]
      .filter((s) => !typed || (s.rows || []).length)
      .map((s) => sectionTable(s, sheet.columns?.length ? expandColumnSpec(sheet.columns, sizes) : spec, sheet.title || s.title, sheet))
      .join(''))
    .join('');

  const summarySheet = (template.sheets || []).find((s) => s.type === 'SUMMARY');
  const wantsSummary = Boolean(summarySheet);

  const reference = `${[source.plNo, source.buyerName, source.shipmentNo].filter(Boolean).join('  ·  ')}${
    source.revision ? `  ·  Revision ${source.revision}` : ''}`;
  const body = `
    ${docHead(template, ctx, template.identity?.titleText || 'PACKING LIST', reference)}${textBlocksHtml(template, 'HEADER')}
    ${addressBlocks(template, ctx)}
    ${headerGrid(template, ctx)}${textBlocksHtml(template, 'BEFORE_TABLE')}
    ${sheets}${textBlocksHtml(template, 'AFTER_TABLE')}
    ${wantsSummary ? summaryBlock(source, template, summarySheet.blocks) : ''}${textBlocksHtml(template, 'FOOTER')}
    <div class="note">${esc(
    band === 'DRAFT'
      ? 'DRAFT — not yet finalised.'
      : (band
        ? `${band} — this version is no longer valid.`
        : `Finalised ${pl.finalSnapshot?.at || ''} by ${pl.finalSnapshot?.by || ''}.`),
  )}</div>`;

  return documentShell({
    title: options.fileName || `${source.plNo} — Packing List`,
    bodyCss: `${pageCss(pageBox(template.identity, true))}${PL_CSS}${fontCss(template.formatting, 'PACKING_LIST')}${
      textCss(template.formatting, 'PACKING_LIST', PL_TEXT)}${COLUMN_CELLS_CSS}`,
    watermark: band,
    draft,
    body,
  });
};

/** Escaped attribute helper re-exported so callers building markup stay consistent. */
export { escAttr };

// ─── Commercial / export invoice (PRD §8) ───────────────────────────────────────

const INV_CSS = `
  ${DOC_HEAD_CSS}
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; padding: 8mm; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
  th { background: #f0f0f0; font-size: 9px; font-weight: 700; }
  .title { text-align: center; border: 1px solid #333; border-bottom: none; padding: 8px; }
  .title span { font-size: 14px; font-weight: 700; letter-spacing: 3px; }
  .n { text-align: right; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .muted { font-size: 8.5px; color: #555; }
  .lbl { font-size: 8px; color: #555; font-style: italic; }
  .val { font-size: 10px; white-space: pre-wrap; }
  .spacer { height: 6px; border: none; }
  .annexe { page-break-before: always; break-before: page; margin-top: 10px; }
`;

const money = (v, dp = 2) => (v === null || v === undefined || v === ''
  ? ''
  : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

const int = (v) => (Number(v) || 0).toLocaleString('en-IN');

/**
 * Line columns per §8.3 grain.
 *
 * Every grain is the same data at a different grain, so it is the same table with a
 * different column set — declared here rather than branching inside the renderer, so
 * a new buyer layout is a list of columns and nothing else.
 */
const INVOICE_COLUMNS = {
  PER_STYLE_SIZE_RANGE: [
    { key: 'marks', label: 'Marks &amp; Nos.', width: '68px', align: 'c', firstOnly: true, get: (l, c) => c.marksAndNos },
    { key: 'hs', label: 'HS Code', width: '66px', align: 'c', get: (l) => l.hsCode },
    { key: 'pkgs', label: 'No. &amp; Kind of Pkgs', width: '78px', align: 'c', firstOnly: true, get: (l, c) => c.packages },
    { key: 'desc', label: 'Description of Goods', get: (l) => l.description, strong: true, sub: (l) => l.composition },
    { key: 'range', label: 'Size Range', width: '64px', align: 'c', get: (l) => l.sizeRange },
  ],
  PER_SIZE: [
    { key: 'hs', label: 'HS Code', width: '66px', align: 'c', get: (l) => l.hsCode },
    { key: 'article', label: 'Article No.', width: '80px', align: 'c', get: (l) => l.articleNo },
    { key: 'desc', label: 'Description of Goods', get: (l) => l.description, strong: true, sub: (l) => l.composition },
    { key: 'colour', label: 'Colour', width: '78px', get: (l) => l.colorName },
    { key: 'size', label: 'Size', width: '52px', align: 'c', get: (l) => l.size },
  ],
  PER_PO_STYLE: [
    { key: 'po', label: 'PO No.', width: '84px', get: (l) => l.buyerPoNo },
    { key: 'style', label: 'Style', width: '92px', get: (l) => l.styleNo },
    { key: 'desc', label: 'Description of Goods', get: (l) => l.description, strong: true, sub: (l) => l.composition },
    { key: 'colour', label: 'Colours', width: '110px', get: (l) => l.colorName },
    { key: 'hs', label: 'HS Code', width: '66px', align: 'c', get: (l) => l.hsCode },
  ],
  PER_ORDER_LINE: [
    { key: 'order', label: 'Order No.', width: '84px', get: (l) => l.buyerPoNo || l.orderNo },
    { key: 'desc', label: 'Article / Description', get: (l) => l.description, strong: true, sub: (l) => l.composition },
    { key: 'colour', label: 'Colour', width: '78px', get: (l) => l.colorName },
    { key: 'range', label: 'Size Range', width: '64px', align: 'c', get: (l) => l.sizeRange },
    // Prénatal's with/without-hanger column. Present only when the template opts in.
    { key: 'pack', label: 'Packing', width: '78px', packaging: true, get: (l) => (l.packagingAttributes
      ? [l.packagingAttributes.packingCode, l.packagingAttributes.danNo].filter(Boolean).join(' · ')
      : '') },
    { key: 'hs', label: 'HS Code', width: '66px', align: 'c', get: (l) => l.hsCode },
  ],
  MATERIAL_ROWS: [
    { key: 'material', label: 'Material #', width: '86px', get: (l) => l.materialNo },
    { key: 'desc', label: 'Description', get: (l) => l.description, strong: true },
    { key: 'hs', label: 'HTS Code', width: '78px', align: 'c', get: (l) => l.hsCode },
  ],
};

/** Quantity / rate / amount close every grain, so they are appended once. */
const TAIL_COLUMNS = (currency, unit) => [
  { key: 'qty', label: `Quantity<br/>in ${esc(String(unit).toLowerCase())}`, width: '68px', align: 'n', get: (l) => int(l.quantity) },
  { key: 'rate', label: `Rate<br/>${esc(currency)}<br/>Per ${esc(unit)}`, width: '68px', align: 'n', get: (l) => money(l.rate, 2) },
  { key: 'amount', label: `Amount<br/>${esc(currency)}`, width: '84px', align: 'n', get: (l) => money(l.amount, 2) },
];

/**
 * The goods-table columns: the buyer's own (`invoiceColumns`) when the template has
 * them, else the grain's standard set. An annexe is the same data at another grain,
 * so it always uses that grain's standard columns.
 */
const invoiceColumns = (grainMode, template, currency, unit, { standard = false } = {}) => {
  const own = standard ? null : templateInvoiceColumns(template);
  if (own) return [...own, ...TAIL_COLUMNS(currency, unit)];
  const base = (INVOICE_COLUMNS[grainMode] || INVOICE_COLUMNS.PER_STYLE_SIZE_RANGE)
    .filter((c) => !c.packaging || template?.invoiceLineGrain?.showPackagingAttributes);
  return [...base, ...TAIL_COLUMNS(currency, unit)];
};

const lineRows = (lines, columns, ctx) => lines.map((line, i) => `<tr>${columns.map((col) => {
  // A per-document value (marks, package count) prints once, against the first line.
  if (col.firstOnly && i > 0) return `<td class="${col.align || ''}"></td>`;
  // A column the template fixes prints its own text; any other is the invoice's data (`v`).
  const cls = [col.align, col.fixed ? '' : 'v'].filter(Boolean).join(' ');
  const value = col.get(line, ctx);
  // A template whose descriptionTemplate already names the composition must not have
  // it repeated underneath — the JOMO layout does exactly that.
  const rawSub = col.sub ? col.sub(line) : null;
  const sub = rawSub && String(value ?? '').includes(rawSub) ? null : rawSub;
  const body = `${col.strong ? `<strong>${esc(value)}</strong>` : esc(value)}${
    sub ? `<br/><span class="muted">${esc(sub)}</span>` : ''}`;
  return `<td class="${cls}">${esc(value) === '' && !sub ? '' : body}</td>`;
}).join('')}</tr>`).join('');

/** A charge or discount, printed as its own line (§8.4). */
const chargeRow = (label, value, span, currency, negative = false) => (value
  ? `<tr>
      <td colspan="${span}" class="n">${esc(label)}</td>
      <td class="n v">${negative ? '-' : ''}${money(value, 2)}</td>
    </tr>`
  : '');

/**
 * Commercial / export invoice.
 *
 * Renders from the approval snapshot once approved (BR-08), so re-printing a
 * six-month-old invoice after the exporter's address changed still yields the
 * document the buyer received. Nothing time-varying appears in the body (§7.6), so
 * two prints of the same version are byte-identical.
 */
/**
 * The references an EDI shipping bill is filed against (`ediAccounts`).
 *
 * A buyer whose layout carries them expects them on the paper invoice too, because
 * the CHA files from that copy. Off by default — most layouts do not show them.
 */
const ediBlock = (template, exporter) => {
  if (!template?.ediAccounts) return '';
  const refs = [
    exporter.adCode ? `AD CODE: ${exporter.adCode}` : null,
    exporter.lutNumber ? `LUT/ARN: ${exporter.lutNumber}` : null,
    exporter.gstStateCode ? `GST STATE CODE: ${exporter.gstStateCode}` : null,
    exporter.swiftCode ? `SWIFT: ${exporter.swiftCode}` : null,
  ].filter(Boolean);
  if (!refs.length) return '';
  return `<em>EDI / Bank references</em><br/>${esc(refs.join('   ·   '))}<br/><br/>`;
};

export const buildExportInvoiceHtml = (inv, options = {}) => {
  const snapshot = inv.finalSnapshot?.payload;
  const source = snapshot ? { ...inv, ...snapshot } : inv;
  const template = inv.template || {};
  const exporter = options.exporter || {};
  const shipment = options.shipment || {};
  const band = bandFor(inv.status, Boolean(inv.finalSnapshot), options.draft);
  const draft = band === 'DRAFT';

  const currency = source.currency || 'USD';
  const lines = source.lines || [];
  const unit = lines[0]?.unit || 'PCS';
  const totals = source.totals || {};
  const plTotals = source.plTotals || {};
  const igst = source.igst;

  const grainMode = template.invoiceLineGrain?.mode || 'PER_STYLE_SIZE_RANGE';
  const columns = invoiceColumns(grainMode, template, currency, unit);
  const span = columns.length;

  // What a template's own header boxes, fields and columns bind against.
  const bindCtx = {
    invoice: { ...source, totals, plTotals, igst },
    exporter,
    shipment,
    buyer: { name: source.buyerName },
    pl: {},
  };
  const box = invoiceBoxPrinter(template, bindCtx);

  const ctx = {
    marksAndNos: source.marksAndNos || '',
    packages: plTotals.cartons ? `${int(plTotals.cartons)} CARTONS` : '',
    exporter,
    bind: bindCtx,
  };

  const headerTable = `
  <table>
    <tr>
      ${box('exporter', 'Exporter', exporter.block || '', { colspan: 2, bold: true })}
      ${box('invoiceNoDate', 'Invoice No. & Date', `${source.invoiceNo || source.provisionalNo || 'DRAFT'}   Dt. ${formatDocDate(source.invoiceDate, template.formatting)}`, { bold: true })}
      ${box('exporterRef', "Exporter's Ref. (IEC No.)", exporter.iecNumber || '')}
    </tr>
    <tr>
      ${box('consignee', 'Consignee', source.consignee?.block || '', { colspan: 2, bold: true })}
      ${box('buyerOrder', "Buyer's Order No. & Date", [source.buyerOrderNo, source.buyerOrderDate].filter(Boolean).join('   Dt. '))}
      ${box('buyerOther', 'Buyer (if other than Consignee)', source.consignee?.name && source.consignee.name === source.buyerName
    ? 'SAME AS CONSIGNEE'
    : source.buyerName || '')}
    </tr>
    <tr>
      ${box('otherRefs', 'Other References', [
    exporter.adCode ? `AD CODE: ${exporter.adCode}` : null,
    exporter.gstStateCode ? `GST STATE CODE: ${exporter.gstStateCode}` : null,
    exporter.panNumber ? `PAN: ${exporter.panNumber}` : null,
    exporter.lutNumber ? `LUT: ${exporter.lutNumber}` : null,
    exporter.aepcRegnNo ? `AEPC: ${exporter.aepcRegnNo}` : null,
    exporter.rexNumber ? `REX: ${exporter.rexNumber}` : null,
    exporter.starExportHouse || null,
  ].filter(Boolean).join('\n'), { colspan: 2 })}
      ${box('notify', 'Notify Party', source.notify?.block || '', { colspan: 2 })}
    </tr>
    <tr>
      ${box('preCarriage', 'Pre-Carriage by', shipment.preCarriageBy || 'N.A.')}
      ${box('placeOfReceipt', 'Place of Receipt by Pre-Carrier', shipment.placeOfReceipt || 'N.A.')}
      ${box('countryOfOrigin', 'Country of Origin of Goods', source.countryOfOrigin || 'INDIA', { bold: true })}
      ${box('countryOfDestination', 'Country of Final Destination', source.countryOfFinalDestination || '', { bold: true })}
    </tr>
    <tr>
      ${box('vessel', 'Vessel / Flight No.', shipment.vesselFlightNo || '')}
      ${box('portOfLoading', 'Port of Loading', shipment.portOfLoading || '')}
      ${box('terms', 'Terms of Delivery & Payment', [
    [source.incoterm, source.incotermPlace].filter(Boolean).join(' '),
    source.paymentTerms ? `PAYMENT: ${source.paymentTerms}` : null,
  ].filter(Boolean).join('\n'), { colspan: 2 })}
    </tr>
    <tr>
      ${box('portOfDischarge', 'Port of Discharge', shipment.portOfDischarge || '')}
      ${box('finalDestination', 'Final Destination', shipment.finalDestination || source.countryOfFinalDestination || '')}
      ${box('containerSeal', 'Container No(s).', (shipment.containerNos || []).join(', '), { colspan: 2 })}
    </tr>
  </table>`;

  // The IGST block prints only when the template enables it; a blank tax panel on a
  // document that carries no tax reads as a missing figure rather than an absent one.
  const igstBlockHtml = igst && template.igst?.enabled !== false ? `
    <tr>
      <td colspan="${span - 1}" class="n">Exchange rate (1 ${esc(currency)} = INR)</td>
      <td class="n v">${money(igst.fxRate, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span - 1}" class="n">Taxable value (INR)</td>
      <td class="n v">${money(igst.taxableInr, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span - 1}" class="n">${esc(`IGST @ ${igst.igstRatePct}%`)} (INR)</td>
      <td class="n v">${money(igst.igstValue, 2)}</td>
    </tr>
    <tr class="b">
      <td colspan="${span - 1}" class="n">Total taxable value (INR)</td>
      <td class="n v">${money(igst.totalTaxableInr, 2)}</td>
    </tr>` : '';

  const plBlock = `
    <tr>
      <td colspan="${span}" class="muted v">
        ${esc([
    `Cartons: ${int(plTotals.cartons)}`,
    `Total pieces: ${int(plTotals.pieces)}`,
    `Net weight: ${money(plTotals.netWeightKg, 3)} KG`,
    `Gross weight: ${money(plTotals.grossWeightKg, 3)} KG`,
    `CBM: ${money(plTotals.cbm, 3)}`,
  ].join('   ·   '))}
      </td>
    </tr>`;

  const declarations = (template.declarations || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((d) => `<div class="muted">${esc(d.text)}</div>`)
    .join('');

  /*
   * Annexe sheets (§8.3): the same data at a different grain, on their own page.
   * VGT's "BUYER" annexe is the invoice per size — it is a sheet of this document,
   * not a second document, so it prints after the main table with a page break.
   */
  const annexeHtml = (source.annexes || [])
    .filter((a) => (a.lines || []).length)
    .map((a) => {
      const cols = invoiceColumns(a.grainMode, template, currency, unit, { standard: true });
      // `num` in this file FORMATS; summing with it would concatenate strings.
      const qty = a.lines.filter((l) => !l.nonMerchandise).reduce((t, l) => t + (Number(l.quantity) || 0), 0);
      const amount = a.lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);
      return `
  <div class="annexe">
    <div class="title"><span>${esc(a.title)}</span></div>
    <table class="cols">
      <tr>${cols.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''} class="${c.align === 'n' ? 'n' : 'c'}">${c.label}</th>`).join('')}</tr>
      ${lineRows(a.lines, cols, ctx)}
      <tr class="b">
        <td colspan="${cols.length - 3}" class="n">Total</td>
        <td class="n v">${int(qty)} ${esc(unit)}</td>
        <td></td>
        <td class="n v">${money(amount, 2)}</td>
      </tr>
    </table>
  </div>`;
    })
    .join('');

  const body = `
  ${template.identity?.showLogo === false
    // Pre-printed stationery carries the letterhead: the title keeps its box on the grid.
    ? `<div class="title"><span>${esc(template.identity?.titleText || 'COMMERCIAL INVOICE')}</span></div>`
    : docHead(template, ctx, template.identity?.titleText || 'COMMERCIAL INVOICE', null)}${textBlocksHtml(template, 'HEADER')}
  ${headerTable}${invoiceExtraFieldsHtml(template, bindCtx)}${textBlocksHtml(template, 'BEFORE_TABLE')}
  <table class="cols">
    <tr>${columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''} class="${c.align === 'n' ? 'n' : 'c'}">${c.label}</th>`).join('')}</tr>
    ${lineRows(lines, columns, ctx)}
    <tr class="b">
      <td colspan="${span - 3}" class="n">Total</td>
      <td class="n v">${int(totals.quantity)} ${esc(unit)}</td>
      <td></td>
      <td class="n v">${money(totals.linesTotal, 2)}</td>
    </tr>
    ${chargeRow(totals.discountPercent ? `Less: Discount @ ${totals.discountPercent}%` : 'Less: Discount', totals.discount, span - 1, currency, true)}
    ${chargeRow('Add: Freight', totals.freight, span - 1, currency)}
    ${chargeRow('Add: Insurance', totals.insurance, span - 1, currency)}
    ${chargeRow('Add: Other charges', totals.other, span - 1, currency)}
    <tr class="b">
      <td colspan="${span - 1}" class="n">${esc(`Total ${currency}`)}</td>
      <td class="n v">${money(totals.netTotal, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span}" class="b v">AMOUNT ${esc(amountInWords(totals.netTotal, currency))}</td>
    </tr>
    ${igstBlockHtml}
    ${plBlock}
    <tr>
      <td colspan="${Math.max(1, span - 2)}" class="foot">
        ${template.bankBlock === false ? '' : `<em>Our Bankers</em><br/>${esc(exporter.bankBlock || '')}<br/><br/>`}
        ${ediBlock(template, exporter)}
        <strong>Declaration:</strong><br/>
        ${declarations || `<div class="muted">${esc(exporter.declarationText || '')}</div>`}
      </td>
      <td colspan="2" class="c">
        <em class="muted">Signature &amp; Date</em>
        <br/><br/><br/><br/><br/>${esc(exporter.signatory || 'Authorised Signatory')}
      </td>
    </tr>
  </table>${textBlocksHtml(template, 'AFTER_TABLE')}
  ${annexeHtml}${textBlocksHtml(template, 'FOOTER')}
  <div class="muted" style="margin-top:6px;">${esc(band === 'DRAFT'
    ? 'DRAFT — not yet finalised. This document has no allocated invoice number.'
    : (band
      ? `${band} — this version is no longer valid.`
      : `Finalised ${inv.finalSnapshot?.at || ''} by ${inv.finalSnapshot?.by || ''}.`))}</div>`;

  return documentShell({
    title: options.fileName || `${source.invoiceNo || source.provisionalNo || 'DRAFT'} — Commercial Invoice`,
    bodyCss: `${pageCss(pageBox(template.identity, false))}${INV_CSS}${fontCss(template.formatting, 'INVOICE')}${
      textCss(template.formatting, 'INVOICE', INV_TEXT)}${COLUMN_CELLS_CSS}`,
    watermark: band,
    draft,
    body,
  });
};
