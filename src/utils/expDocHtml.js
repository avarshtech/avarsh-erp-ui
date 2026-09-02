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
import { esc, escAttr, cell, documentShell, pageCss } from './printDoc';
import { amountInWords } from './amountInWords';
import { expandColumns, resolveBinding, formatBound } from './expDocTemplateSchema';
import {
  cartonCount, piecesPerCarton, totalPieces, cbmPerCarton, dimensionsLabel,
  sizeQtyPerCarton, formatRanges, sectionTotals, grandTotals, weightPerPiece,
} from './expDocCalc';
import { PACKING_TYPE_LABELS, SECTION_KEY, PAPER_SPECS } from './expDocConstants';
import { barcodeSvg } from './barcode1d';

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const MASTHEAD_CSS = `
  .masthead { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .masthead td { border: none; padding: 0 8px 0 0; vertical-align: middle; }
  .masthead td.logo { width: 46px; }
  .masthead img { width: 42px; height: 42px; object-fit: contain; }
  .masthead .co { font-size: 12px; font-weight: 700; letter-spacing: 0.3px; }
  .masthead .co-sub { font-size: 8px; color: #555; }
`;

const PL_CSS = `
  ${MASTHEAD_CSS}
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #111; padding: 8mm; }
  h1 { font-size: 14px; margin: 0 0 2px; letter-spacing: 1px; }
  .sub { font-size: 9px; color: #555; margin-bottom: 8px; }
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
 * The exporter masthead, printed when the layout asks for it (`identity.showLogo`).
 *
 * Buyers who supply their own pre-printed stationery turn it off — which is why the
 * switch exists on the template rather than being a global setting.
 */
const masthead = (template, ctx) => {
  if (template?.identity?.showLogo === false) return '';
  const ex = ctx.exporter || {};
  const lines = String(ex.block || '').split(/\r?\n/).filter(Boolean).join('  ·  ');
  return `<table class="masthead"><tr>
    <td class="logo"><img src="${escAttr(exporterLogo)}" alt="" /></td>
    <td><div class="co">${esc(ex.name || '')}</div><div class="co-sub">${esc(lines)}</div></td>
  </tr></table>`;
};

/** Header grid: the template's header fields, three to a row. */
const headerGrid = (template, ctx) => {
  const fields = (template?.headerFields || []).filter((f) => f.binding || f.fixedValue);
  if (!fields.length) return '';
  const rows = [];
  for (let i = 0; i < fields.length; i += 3) rows.push(fields.slice(i, i + 3));
  return `<table class="hdr">${rows.map((row) => `<tr>${row
    .map((f) => {
      const raw = f.fixedValue ?? resolveBinding(f.binding, ctx);
      return `<td style="width:33.3%"><div class="lbl">${esc(f.label)}</div><div class="val">${esc(formatBound(raw, { emptyText: '—' }))}</div></td>`;
    })
    .join('')}${row.length < 3 ? '<td></td>'.repeat(3 - row.length) : ''}</tr>`).join('')}</table>`;
};

/** Address blocks the template asks for, side by side. */
const addressBlocks = (template, ctx) => {
  const blocks = template?.addressBlocks || [];
  if (!blocks.length) return '';
  return `<table class="hdr"><tr>${blocks
    .map((b) => `<td style="width:${(100 / blocks.length).toFixed(1)}%"><div class="lbl">${esc(b.label)}</div><div class="val">${esc(resolveBinding(b.binding, ctx) || '—')}</div></td>`)
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
    default: break;
  }
  if (col.isSizeColumn) {
    const q = sizeQtyPerCarton(row)[col.size];
    return q ? num(q) : '—';
  }
  return formatBound(resolveBinding(col.binding, { row, calc: {} }, { decimals: col.decimals }), {
    decimals: col.decimals,
    prefix: col.prefix,
    suffix: col.suffix,
  });
};

const alignClass = (col) => (col.align === 'right' ? ' class="n"' : col.align === 'center' ? ' class="c"' : '');

/** A packing section: header row, carton rows, and its own total row. */
const sectionTable = (section, spec, title) => {
  const totals = sectionTotals(section.rows);
  // The template's column widths, honoured. A colgroup rather than per-cell widths
  // so a column that the layout does not size still shares what is left over.
  const cols = spec.some((c) => c.width)
    ? `<colgroup>${spec.map((c) => (c.width ? `<col style="width:${Number(c.width)}px" />` : '<col />')).join('')}</colgroup>`
    : '';
  const head = `<tr>${spec.map((c) => `<th${alignClass(c)}>${esc(c.label)}</th>`).join('')}</tr>`;

  const body = (section.rows || []).map((row) => {
    const main = `<tr>${spec.map((c) => `<td${alignClass(c)}>${esc(cellValue(c, row))}</td>`).join('')}</tr>`;
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
    return `${main}<tr><td colspan="${spec.length}" style="font-size:8px;color:#444;padding-left:14px;">${esc(colours)}</td></tr>`;
  }).join('');

  const totalRow = `<tr class="total">${spec.map((c, i) => {
    if (i === 0) return `<td>Total</td>`;
    if (c.binding === 'row.cartonCount') return `<td class="n">${num(totals.cartons)}</td>`;
    if (c.isSizeColumn) return `<td class="n">${totals.sizeQty?.[c.size] ? num(totals.sizeQty[c.size]) : ''}</td>`;
    if (c.binding === 'calc.totalPieces') return `<td class="n">${num(totals.pieces)}</td>`;
    if (c.binding === 'row.netWeightKg') return `<td class="n">${num(totals.netWeightKg, 3)}</td>`;
    if (c.binding === 'row.grossWeightKg') return `<td class="n">${num(totals.grossWeightKg, 3)}</td>`;
    if (c.binding === 'calc.cbm') return `<td class="n">${num(totals.cbm, 3)}</td>`;
    return '<td></td>';
  }).join('')}</tr>`;

  return `<div class="section-title">${esc(title)}</div>
    <table>${cols}${head}${body}${totalRow}</table>`;
};

/** Grand total, weight per piece, and the order-vs-shipped summary (PRD §7.4). */
const summaryBlock = (pl, template) => {
  const totals = grandTotals(pl.sections);
  const wpp = weightPerPiece(totals, {
    weightPerPieceDecimals: template?.formatting?.weightPerPieceDecimals ?? 5,
  });
  const dp = template?.formatting?.weightPerPieceDecimals ?? 5;

  const grand = `<table class="summary">
    <tr>
      <td>Total cartons</td><td class="grand">${num(totals.cartons)}</td>
      <td>Total pieces</td><td class="grand">${num(totals.pieces)}</td>
      <td>Carton numbers</td><td class="grand">${esc(formatRanges((pl.sections || []).flatMap((s) => (s.rows || []).map((r) => ({ from: r.cartonFrom, to: r.cartonTo })))))}</td>
    </tr>
    <tr>
      <td>Net weight (kg)</td><td class="grand">${num(totals.netWeightKg, 3)}</td>
      <td>Gross weight (kg)</td><td class="grand">${num(totals.grossWeightKg, 3)}</td>
      <td>CBM</td><td class="grand">${num(totals.cbm, 3)}</td>
    </tr>
    <tr>
      <td>Net / piece (kg)</td><td class="grand">${wpp.netPerPiece.toFixed(dp)}</td>
      <td>Gross / piece (kg)</td><td class="grand">${wpp.grossPerPiece.toFixed(dp)}</td>
      <td></td><td></td>
    </tr>
  </table>`;

  const variance = pl.orderVsPacked || [];
  if (!variance.length) {
    return `${grand}<div class="note">No ordered breakdown was captured for this packing list.</div>`;
  }

  const rows = variance.map((v) => `<tr>
      <td>${esc(v.styleNo)}</td><td>${esc(v.colorName)}</td><td class="c">${esc(v.size)}</td>
      <td class="n">${num(v.orderQty)}</td><td class="n">${num(v.shippedQty)}</td>
      <td class="n">${v.variance ? (v.variance > 0 ? `+${num(v.variance)}` : num(v.variance)) : '—'}</td>
    </tr>`).join('');
  const tot = variance.reduce((a, v) => ({
    o: a.o + v.orderQty, s: a.s + v.shippedQty, d: a.d + v.variance,
  }), { o: 0, s: 0, d: 0 });

  return `${grand}
    <div class="section-title">Order vs shipped</div>
    <table>
      <tr><th>Style</th><th>Colour</th><th class="c">Size</th><th class="n">Order qty</th><th class="n">Shipped qty</th><th class="n">Excess / shortage</th></tr>
      ${rows}
      <tr class="total"><td colspan="3">Total</td><td class="n">${num(tot.o)}</td><td class="n">${num(tot.s)}</td><td class="n">${tot.d > 0 ? `+${num(tot.d)}` : num(tot.d)}</td></tr>
    </table>`;
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
 * The template's own typography. A layout that could set a font and a size but
 * printed Arial 8.5px regardless made the builder's Formatting tab a decoration.
 */
const fontCss = (formatting, defaultPt) => {
  const family = formatting?.font || 'Arial';
  const pt = Number(formatting?.baseFontPt) || defaultPt;
  return `body { font-family: ${String(family).replace(/[^\w \-,]/g, '')}, Helvetica, sans-serif; font-size: ${pt}pt; }`;
};

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
  const snapshot = pl.approvalSnapshot?.payload;
  const source = snapshot ? { ...pl, ...snapshot } : pl;
  const template = pl.template || {};
  const sizes = source.sizes || [];
  const spec = expandColumns(template, sizes);
  const band = bandFor(pl.status, Boolean(pl.approvalSnapshot), options.draft);
  const draft = band === 'DRAFT';

  const ctx = {
    pl: source,
    exporter: options.exporter || {},
    buyer: { name: source.buyerName, subClient: source.subClientCode },
    shipment: options.shipment || {},
    style: {},
    row: {},
    calc: {},
    invoice: {},
  };

  const sheets = (template.sheets || [{ key: 'MAIN', title: 'PACKING LIST', include: [SECTION_KEY.MAIN] }])
    .filter((sheet) => sheet.type !== 'SUMMARY')
    .map((sheet) => (source.sections || [])
      .filter((s) => (sheet.include || []).includes(s.key))
      .map((s) => sectionTable(s, spec, sheet.title || s.title))
      .join(''))
    .join('');

  const wantsSummary = (template.sheets || []).some((s) => s.type === 'SUMMARY');

  const body = `
    ${masthead(template, ctx)}
    <h1>${esc(template.identity?.titleText || 'PACKING LIST')}</h1>
    <div class="sub">${esc([source.plNo, source.buyerName, source.shipmentNo].filter(Boolean).join('  ·  '))}${
  source.revision ? esc(`  ·  Revision ${source.revision}`) : ''}</div>
    ${addressBlocks(template, ctx)}
    ${headerGrid(template, ctx)}
    ${sheets}
    ${wantsSummary ? summaryBlock(source, template) : ''}
    <div class="note">${esc(
    band === 'DRAFT'
      ? 'DRAFT — not yet approved.'
      : (band
        ? `${band} — this version is no longer valid.`
        : `Approved ${pl.approvalSnapshot?.at || ''} by ${pl.approvalSnapshot?.by || ''}.`),
  )}</div>`;

  return documentShell({
    title: options.fileName || `${source.plNo} — Packing List`,
    bodyCss: `${pageCss(pageBox(template.identity, true))}${PL_CSS}${fontCss(template.formatting, 8.5)}`,
    watermark: band,
    draft,
    body,
  });
};

/** Escaped attribute helper re-exported so callers building markup stay consistent. */
export { escAttr };

// ─── Carton stickers (PRD §9) ───────────────────────────────────────────────────

const STICKER_CSS = `
  .label { padding: 4mm; display: flex; flex-direction: column; justify-content: flex-start; }
  .label.box { border: 1.5pt solid #000; }
  .ln { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 1.2mm; }
  .ln .lbl { font-size: 8pt; color: #333; min-width: 22mm; letter-spacing: 0.4pt; }
  .ln .val { font-weight: 600; }
  .stack .center { justify-content: center; }
  .tbl { width: 100%; border-collapse: collapse; }
  .tbl td { border: 0.8pt solid #000; padding: 1mm 2mm; font-size: 9pt; }
  .tbl td.k { width: 34%; font-size: 7.5pt; color: #333; text-transform: uppercase; }
  .txtblk { font-family: 'Courier New', monospace; font-size: 11pt; line-height: 1.55; white-space: pre; }
  .face-logo { text-align: center; margin-bottom: 2mm; }
  .face-logo img { height: 12mm; object-fit: contain; }
  .grid { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .grid td, .grid th { border: 0.8pt solid #000; padding: 0.8mm; font-size: 8pt; text-align: center; }
  .bc { margin-top: 2mm; text-align: center; }
  .face-tag { position: absolute; top: 1mm; right: 2mm; font-size: 6pt; color: #999; letter-spacing: 1pt; }
`;

/** Resolve one configured line against a carton, honouring prefix/suffix/decimals. */
const lineValue = (line, ctx) => formatBound(
  resolveBinding(line.binding, ctx, { decimals: line.decimals }),
  { decimals: line.decimals, prefix: line.prefix, suffix: line.suffix, emptyText: '—' },
);

const lineStyle = (line) => [
  line.fontPt ? `font-size:${line.fontPt}pt` : '',
  line.bold ? 'font-weight:700' : '',
  line.caps ? 'text-transform:uppercase' : '',
].filter(Boolean).join(';');

/** Colour x size table, for the ratio-pack layouts that print one (PRD §9.2). */
const sizeGridHtml = (face, carton) => {
  const cfg = face.sizeGrid;
  if (!cfg?.enabled) return '';
  const rows = carton.mixedRows?.length
    ? carton.mixedRows.map((mr) => ({ label: mr.colorName, qty: mr.sizeQty || {} }))
    : [{ label: carton.colorName, qty: carton.sizeQty || {} }];
  const sizes = [...new Set(rows.flatMap((r) => Object.keys(r.qty)))];
  if (!sizes.length) return '';
  return `<table class="grid">
    <tr><th></th>${sizes.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr><td style="text-align:left">${esc(r.label || '')}</td>${
    sizes.map((s) => `<td>${r.qty[s] ? esc(String(r.qty[s])) : ''}</td>`).join('')}</tr>`).join('')}
  </table>`;
};

const barcodeHtml = (face, ctx) => {
  const cfg = face.barcode;
  if (!cfg?.enabled) return '';
  const value = resolveBinding(cfg.binding, ctx);
  const svg = barcodeSvg(cfg.type, value, { heightMm: cfg.heightMm || 12 });
  // A barcode that cannot encode must say so rather than leave a silent gap the
  // packer only discovers at the scanner.
  return `<div class="bc">${svg || `<span style="font-size:7pt;color:#a00">Barcode unavailable for "${esc(value ?? '')}"</span>`}</div>`;
};

/**
 * Render one sticker face.
 *
 * Three modes cover every layout in PRD §9.2:
 *   STACK       label/value rows      (JOMO AMG + SCA, Prénatal)
 *   TABLE       bordered key/value    (Vingino)
 *   TEXT_BLOCK  monospace lines       (Van Gennip's nine-line block)
 * A seventh buyer is a template row, not new code.
 */
export const renderStickerFace = (face, carton, ctx = {}) => {
  const full = { ...ctx, carton };
  const lines = face.lines || [];

  let inner;
  if (face.render === 'TABLE') {
    inner = `<table class="tbl">${lines.map((l) => `<tr><td class="k">${esc(l.label || '')}</td><td style="${lineStyle(l)}">${esc(lineValue(l, full))}</td></tr>`).join('')}</table>`;
  } else if (face.render === 'TEXT_BLOCK') {
    inner = `<div class="txtblk">${lines
      .map((l) => esc(`${l.label ? `${l.label}: ` : ''}${lineValue(l, full)}`))
      .join('<br/>')}</div>`;
  } else {
    inner = `<div class="stack">${lines.map((l) => `<div class="ln${l.align === 'CENTER' ? ' center' : ''}" style="${lineStyle(l)}">${
      l.label ? `<span class="lbl">${esc(l.label)}</span>` : ''}<span class="val">${esc(lineValue(l, full))}</span></div>`).join('')}</div>`;
  }

  const border = face.border?.style === 'solid' || face.render === 'TABLE' ? ' box' : '';
  // `identity.showLogo` is a template switch on every doc type, stickers included —
  // a face marked `logo` carries it, so the same setting means the same thing here
  // as it does on the packing list.
  const logo = ctx.showLogo && face.logo !== false
    ? `<div class="face-logo"><img src="${escAttr(exporterLogo)}" alt="" /></div>`
    : '';
  return `<div class="label${border}" style="position:relative">
    ${face.title ? `<span class="face-tag">${esc(face.title)}</span>` : ''}
    ${logo}
    ${inner}
    ${sizeGridHtml(face, carton)}
    ${barcodeHtml(face, full)}
  </div>`;
};

/**
 * Lay expanded cartons out as printable sheets.
 *
 * Every carton produces one label per configured face, in face order, so a JOMO
 * long side and short side land on consecutive labels — or on the same 2-up sheet,
 * which is what the packer actually wants.
 */
export const buildStickerSheetHtml = (cartons, options = {}) => {
  const { layout, paper = 'A4_1UP', faceKeys, ctx = {}, draft = true, title } = options;
  const spec = PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP;
  const faces = (layout?.faces || []).filter((f) => !faceKeys || faceKeys.includes(f.key));
  const perSheet = spec.cols * spec.rows;

  const labels = [];
  cartons.forEach((carton) => {
    faces.forEach((face) => labels.push(renderStickerFace(face, carton, ctx)));
  });

  const sheets = [];
  for (let i = 0; i < labels.length; i += perSheet) {
    sheets.push(`<div class="sheet">${labels.slice(i, i + perSheet).join('')}</div>`);
  }

  return documentShell({
    title: title || 'Carton stickers',
    bodyCss: `${pageCss({
      widthMm: spec.pageMm[0], heightMm: spec.pageMm[1], marginMm: 0,
      cols: spec.cols, rows: spec.rows,
    })}${STICKER_CSS}
      body { font-family: Arial, Helvetica, sans-serif; color: #000; }`,
    draft,
    body: sheets.join('') || '<div style="padding:10mm;font-family:Arial">No cartons selected.</div>',
  });
};

/** Labels a given scope will produce — shown before generating, and used to chunk. */
export const stickerCounts = (cartonCount, layout, paper, faceKeys) => {
  const spec = PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP;
  const faces = (layout?.faces || []).filter((f) => !faceKeys || faceKeys.includes(f.key)).length || 1;
  const labels = cartonCount * faces;
  return { faces, labels, sheets: Math.ceil(labels / (spec.cols * spec.rows)) };
};

// ─── Commercial / export invoice (PRD §8) ───────────────────────────────────────

const INV_CSS = `
  ${MASTHEAD_CSS}
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

const invoiceColumns = (grainMode, template, currency, unit) => {
  const base = (INVOICE_COLUMNS[grainMode] || INVOICE_COLUMNS.PER_STYLE_SIZE_RANGE)
    .filter((c) => !c.packaging || template?.invoiceLineGrain?.showPackagingAttributes);
  return [...base, ...TAIL_COLUMNS(currency, unit)];
};

const lineRows = (lines, columns, ctx) => lines.map((line, i) => `<tr>${columns.map((col) => {
  // A per-document value (marks, package count) prints once, against the first line.
  if (col.firstOnly && i > 0) return `<td class="${col.align || ''}"></td>`;
  const value = col.get(line, ctx);
  // A template whose descriptionTemplate already names the composition must not have
  // it repeated underneath — the JOMO layout does exactly that.
  const rawSub = col.sub ? col.sub(line) : null;
  const sub = rawSub && String(value ?? '').includes(rawSub) ? null : rawSub;
  const body = `${col.strong ? `<strong>${esc(value)}</strong>` : esc(value)}${
    sub ? `<br/><span class="muted">${esc(sub)}</span>` : ''}`;
  return `<td class="${col.align || ''}">${esc(value) === '' && !sub ? '' : body}</td>`;
}).join('')}</tr>`).join('');

/** A charge or discount, printed as its own line (§8.4). */
const chargeRow = (label, value, span, currency, negative = false) => (value
  ? `<tr>
      <td colspan="${span}" class="n">${esc(label)}</td>
      <td class="n">${negative ? '-' : ''}${money(value, 2)}</td>
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
  const snapshot = inv.approvalSnapshot?.payload;
  const source = snapshot ? { ...inv, ...snapshot } : inv;
  const template = inv.template || {};
  const exporter = options.exporter || {};
  const shipment = options.shipment || {};
  const band = bandFor(inv.status, Boolean(inv.approvalSnapshot), options.draft);
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

  const ctx = {
    marksAndNos: source.marksAndNos || '',
    packages: plTotals.cartons ? `${int(plTotals.cartons)} CARTONS` : '',
    exporter,
  };

  const headerTable = `
  <table>
    <tr>
      ${cell('Exporter', exporter.block || '', { colspan: 2, bold: true })}
      ${cell('Invoice No. & Date', `${source.invoiceNo || source.provisionalNo || 'DRAFT'}   Dt. ${formatDocDate(source.invoiceDate, template.formatting)}`, { bold: true })}
      ${cell("Exporter's Ref. (IEC No.)", exporter.iecNumber || '')}
    </tr>
    <tr>
      ${cell('Consignee', source.consignee?.block || '', { colspan: 2, bold: true })}
      ${cell("Buyer's Order No. & Date", [source.buyerOrderNo, source.buyerOrderDate].filter(Boolean).join('   Dt. '))}
      ${cell('Buyer (if other than Consignee)', source.buyerName || '')}
    </tr>
    <tr>
      ${cell('Other References', [
    exporter.adCode ? `AD CODE: ${exporter.adCode}` : null,
    exporter.gstStateCode ? `GST STATE CODE: ${exporter.gstStateCode}` : null,
    exporter.panNumber ? `PAN: ${exporter.panNumber}` : null,
    exporter.lutNumber ? `LUT: ${exporter.lutNumber}` : null,
    exporter.aepcRegnNo ? `AEPC: ${exporter.aepcRegnNo}` : null,
    exporter.rexNumber ? `REX: ${exporter.rexNumber}` : null,
    exporter.starExportHouse || null,
  ].filter(Boolean).join('\n'), { colspan: 2 })}
      ${cell('Notify Party', source.notify?.block || '', { colspan: 2 })}
    </tr>
    <tr>
      ${cell('Pre-Carriage by', shipment.preCarriageBy || 'N.A.')}
      ${cell('Place of Receipt by Pre-Carrier', shipment.placeOfReceipt || 'N.A.')}
      ${cell('Country of Origin of Goods', source.countryOfOrigin || 'INDIA', { bold: true })}
      ${cell('Country of Final Destination', source.countryOfFinalDestination || '', { bold: true })}
    </tr>
    <tr>
      ${cell('Vessel / Flight No.', shipment.vesselFlightNo || '')}
      ${cell('Port of Loading', shipment.portOfLoading || '')}
      ${cell('Terms of Delivery & Payment', [
    [source.incoterm, source.incotermPlace].filter(Boolean).join(' '),
    source.paymentTerms ? `PAYMENT: ${source.paymentTerms}` : null,
  ].filter(Boolean).join('\n'), { colspan: 2 })}
    </tr>
    <tr>
      ${cell('Port of Discharge', shipment.portOfDischarge || '')}
      ${cell('Final Destination', shipment.finalDestination || source.countryOfFinalDestination || '')}
      ${cell('Container / Seal No.', [
    (shipment.containerNos || []).join(', '),
    shipment.sealNo ? `SEAL: ${shipment.sealNo}` : null,
  ].filter(Boolean).join('\n'), { colspan: 2 })}
    </tr>
  </table>`;

  // The IGST block prints only when the template enables it; a blank tax panel on a
  // document that carries no tax reads as a missing figure rather than an absent one.
  const igstBlockHtml = igst && template.igst?.enabled !== false ? `
    <tr>
      <td colspan="${span - 1}" class="n">Exchange rate (1 ${esc(currency)} = INR)</td>
      <td class="n">${money(igst.fxRate, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span - 1}" class="n">Taxable value (INR)</td>
      <td class="n">${money(igst.taxableInr, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span - 1}" class="n">${esc(`IGST @ ${igst.igstRatePct}%`)} (INR)</td>
      <td class="n">${money(igst.igstValue, 2)}</td>
    </tr>
    <tr class="b">
      <td colspan="${span - 1}" class="n">Total taxable value (INR)</td>
      <td class="n">${money(igst.totalTaxableInr, 2)}</td>
    </tr>` : '';

  const plBlock = `
    <tr>
      <td colspan="${span}" class="muted">
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
      const cols = invoiceColumns(a.grainMode, template, currency, unit);
      // `num` in this file FORMATS; summing with it would concatenate strings.
      const qty = a.lines.filter((l) => !l.nonMerchandise).reduce((t, l) => t + (Number(l.quantity) || 0), 0);
      const amount = a.lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);
      return `
  <div class="annexe">
    <div class="title"><span>${esc(a.title)}</span></div>
    <table>
      <tr>${cols.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''} class="${c.align === 'n' ? 'n' : 'c'}">${c.label}</th>`).join('')}</tr>
      ${lineRows(a.lines, cols, ctx)}
      <tr class="b">
        <td colspan="${cols.length - 3}" class="n">Total</td>
        <td class="n">${int(qty)} ${esc(unit)}</td>
        <td></td>
        <td class="n">${money(amount, 2)}</td>
      </tr>
    </table>
  </div>`;
    })
    .join('');

  const body = `
  ${masthead(template, ctx)}
  <div class="title"><span>${esc(template.identity?.titleText || 'COMMERCIAL INVOICE')}</span></div>
  ${headerTable}
  <table>
    <tr>${columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''} class="${c.align === 'n' ? 'n' : 'c'}">${c.label}</th>`).join('')}</tr>
    ${lineRows(lines, columns, ctx)}
    <tr class="b">
      <td colspan="${span - 3}" class="n">Total</td>
      <td class="n">${int(totals.quantity)} ${esc(unit)}</td>
      <td></td>
      <td class="n">${money(totals.linesTotal, 2)}</td>
    </tr>
    ${chargeRow(totals.discountPercent ? `Less: Discount @ ${totals.discountPercent}%` : 'Less: Discount', totals.discount, span - 1, currency, true)}
    ${chargeRow('Add: Freight', totals.freight, span - 1, currency)}
    ${chargeRow('Add: Insurance', totals.insurance, span - 1, currency)}
    ${chargeRow('Add: Other charges', totals.other, span - 1, currency)}
    <tr class="b">
      <td colspan="${span - 1}" class="n">${esc(`Total ${currency}`)}</td>
      <td class="n">${money(totals.netTotal, 2)}</td>
    </tr>
    <tr>
      <td colspan="${span}" class="b">AMOUNT ${esc(amountInWords(totals.netTotal, currency))}</td>
    </tr>
    ${igstBlockHtml}
    ${plBlock}
    <tr>
      <td colspan="${Math.max(1, span - 2)}" style="font-size:9.5px;">
        ${template.bankBlock === false ? '' : `<em>Our Bankers</em><br/>${esc(exporter.bankBlock || '')}<br/><br/>`}
        ${ediBlock(template, exporter)}
        <strong>Declaration:</strong><br/>
        ${declarations || `<div class="muted">${esc(exporter.declarationText || '')}</div>`}
      </td>
      <td colspan="2" class="c">
        <em class="muted">Signature &amp; Date</em>
        <br/><br/><br/><strong>For ${esc(String(exporter.name || '').toUpperCase())}</strong>
        <br/><br/><br/>${esc(exporter.signatory || 'Authorised Signatory')}
      </td>
    </tr>
  </table>
  ${annexeHtml}
  <div class="muted" style="margin-top:6px;">${esc(band === 'DRAFT'
    ? 'DRAFT — not yet approved. This document has no allocated invoice number.'
    : (band
      ? `${band} — this version is no longer valid.`
      : `Approved ${inv.approvalSnapshot?.at || ''} by ${inv.approvalSnapshot?.by || ''}.`))}</div>`;

  return documentShell({
    title: options.fileName || `${source.invoiceNo || source.provisionalNo || 'DRAFT'} — Commercial Invoice`,
    bodyCss: `${pageCss(pageBox(template.identity, false))}${INV_CSS}${fontCss(template.formatting, 10)}`,
    watermark: band,
    draft,
    body,
  });
};
