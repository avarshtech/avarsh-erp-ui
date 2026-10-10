/**
 * Export Documentation — carton stickers (PRD §9), as printable HTML.
 *
 * One renderer for the sticker workspace's preview, its print window and the template
 * preview, so what is checked on screen is what prints. A sticker layout
 * (`stickerLayout`) is a list of faces — a main mark, a side mark — and each face a list
 * of lines, printed in one of five modes:
 *   LINES       "LABEL: value", the label in the line's own font (Dropy)
 *   TEXT_BLOCK  LINES in a monospace font
 *   COLON_LIST  label, colon and value in aligned columns (Van Gennip, JOMO SCA)
 *   TABLE       a bordered label | value table (Vingino)
 *   STACK       a small grey label beside each value
 * A size grid prints where its line stands; a barcode in its line's value area. What a
 * line prints is expDocStickerParts'; this module lays the lines, faces and sheets out.
 * A carton sticker never carries the exporter's logo (owner, 2026-10-09).
 */
import { esc, documentShell, pageCss } from './printDoc';
import { FACE_RENDER, PAPER_SPECS } from './expDocConstants';
import {
  lineContent, lineStyle, labelOf, alignOf,
} from './expDocStickerParts';

const STICKER_CSS = `
  .label { padding: 4mm; display: flex; flex-direction: column; justify-content: flex-start; }
  .label.box { border: 1.5pt solid #000; }
  .face-tag { position: absolute; top: 1mm; right: 2mm; font-size: 6pt; color: #999; letter-spacing: 1pt; }
  .face-caption { text-align: center; font-weight: 700; letter-spacing: 1pt; margin-bottom: 2mm; }
  .tsu { display: flex; gap: 2mm; margin-bottom: 2mm; }
  .tsu svg { width: 7mm; height: 9mm; }
  /* LINES: "LABEL: value" in the line's own font. TEXT_BLOCK is the same in monospace. */
  .lines .line { margin-bottom: 1.2mm; overflow-wrap: break-word; }
  .lines.mono { font-family: 'Courier New', monospace; font-size: 11pt; line-height: 1.55; white-space: pre-wrap; }
  .ln { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 1.2mm; }
  .ln .lbl { font-size: 8pt; color: #333; min-width: 22mm; letter-spacing: 0.4pt; }
  .ln .val { font-weight: 600; }
  .stack .center { justify-content: center; }
  .stack .right { justify-content: flex-end; }
  .tbl { width: 100%; border-collapse: collapse; }
  .tbl td { border: 0.8pt solid #000; padding: 1mm 2mm; font-size: 9pt; }
  .tbl td.k { width: 34%; font-size: 7.5pt; color: #333; text-transform: uppercase; }
  /* The colon list: label, colon and value in three columns so every colon lines
     up down the label. A label wider than half the face wraps rather than pushing
     its value off the label. */
  .clist { display: grid; grid-template-columns: fit-content(50%) max-content 1fr; column-gap: 2mm; row-gap: 1.2mm; align-items: baseline; }
  .clist .lbl { font-weight: 700; }
  .clist .val { font-weight: 400; }
  .clist .span3 { grid-column: 1 / -1; }
  /* The size grid prints at 9pt unless its line sets a size. After .tbl, so its cells
     keep their own padding inside a table's value cell. */
  .grid { width: 100%; border-collapse: collapse; margin: 1.5mm 0; font-size: 9pt; white-space: normal; overflow-wrap: normal; }
  .grid td, .grid th { border: 0.8pt solid #000; padding: 0.8mm; font-size: inherit; text-align: center; }
  .grid .c { text-align: left; }
  .grid .tot { font-weight: 700; }
  .tbl .grid { margin: 0; }
  .bcs { display: inline-flex; flex-wrap: wrap; gap: 1.5mm 4mm; align-items: flex-end; vertical-align: middle; }
  .bc svg { display: block; }
  .bc-err, .bc-na { font-size: 7pt; color: #a00; }
  .bc-na { font-style: italic; }
  /* Space left for hand-writing: an unbound line, or barcodes switched off. */
  .blank { display: inline-block; min-width: 35mm; min-height: 1.1em; vertical-align: baseline; }
`;

/**
 * The ISO 780 "this way up" mark. Inline SVG rather than an arrow character,
 * because the glyph a print driver substitutes for one is not predictable.
 */
const THIS_SIDE_UP_SVG = `<svg viewBox="0 0 24 32" aria-hidden="true">
  <path d="M12 2 L21 13 H16 V30 H8 V13 H3 Z" fill="#000" />
</svg>`;

const faceChrome = (face) => [
  face.caption ? `<div class="face-caption">${esc(face.caption)}</div>` : '',
  face.symbol === 'THIS_SIDE_UP' ? `<div class="tsu">${THIS_SIDE_UP_SVG}${THIS_SIDE_UP_SVG}</div>` : '',
].join('');

/** A style attribute, or nothing when the line sets no style of its own. */
const styled = (css) => (css ? ` style="${css}"` : '');

/** LINES and TEXT_BLOCK: a row per line; a headline (no label) prints its value alone. */
const linesHtml = (lines, full, opts, mono = false) => `<div class="lines${mono ? ' mono' : ''}">${lines.map((line) => {
  const label = labelOf(line, { bare: true });
  const style = styled(lineStyle(line, { align: true }));
  const { html, block } = lineContent(line, full, opts);
  if (block) return `${label ? `<div class="line"${style}>${esc(label)}</div>` : ''}<div class="line"${style}>${html}</div>`;
  return `<div class="line"${style}>${label ? `<span class="k">${esc(label)}:</span> ` : ''}${html}</div>`;
}).join('')}</div>`;

/** STACK: a small grey label beside each value. */
const stackHtml = (lines, full, opts) => `<div class="stack">${lines.map((line) => {
  const label = labelOf(line);
  const side = alignOf(line);
  const style = styled(lineStyle(line));
  const { html, block } = lineContent(line, full, opts);
  if (block) return `${label ? `<div class="ln"><span class="lbl">${esc(label)}</span></div>` : ''}<div${style}>${html}</div>`;
  return `<div class="ln${side ? ` ${side}` : ''}"${style}>${
    label ? `<span class="lbl">${esc(label)}</span>` : ''}<span class="val">${html}</span></div>`;
}).join('')}</div>`;

/**
 * COLON_LIST: a labelled row occupies all three columns; an unlabelled one (a
 * shipping-mark heading, say) and a size grid span them, so they start at the left
 * margin instead of being pushed into the value column by an empty label.
 */
const colonListHtml = (lines, full, opts) => `<div class="clist">${lines.map((line) => {
  const label = labelOf(line, { bare: true });
  const style = styled(lineStyle(line));
  const { html, block } = lineContent(line, full, opts);
  if (block) return `${label ? `<span class="span3 lbl"${style}>${esc(label)}</span>` : ''}<div class="span3"${style}>${html}</div>`;
  if (!label) return `<span class="span3 lbl"${styled(lineStyle(line, { align: true }))}>${html}</span>`;
  return `<span class="lbl"${style}>${esc(label)}</span><span class="lbl"${style}>:</span><span class="val"${style}>${html}</span>`;
}).join('')}</div>`;

/** TABLE: label cell | value cell; a line with no label spans both. A size grid sits in its value cell. */
const tableHtml = (lines, full, opts) => `<table class="tbl">${lines.map((line) => {
  const label = labelOf(line);
  const style = styled(lineStyle(line, { align: true }));
  const { html } = lineContent(line, full, opts);
  return label
    ? `<tr><td class="k">${esc(label)}</td><td${style}>${html}</td></tr>`
    : `<tr><td colspan="2"${style}>${html}</td></tr>`;
}).join('')}</table>`;

const RENDER = {
  [FACE_RENDER.LINES]: linesHtml,
  [FACE_RENDER.TEXT_BLOCK]: (lines, full, opts) => linesHtml(lines, full, opts, true),
  [FACE_RENDER.COLON_LIST]: colonListHtml,
  [FACE_RENDER.TABLE]: tableHtml,
  [FACE_RENDER.STACK]: stackHtml,
};

const paperSpec = (paper) => (Object.hasOwn(PAPER_SPECS, paper) ? PAPER_SPECS[paper] : PAPER_SPECS.A4_1UP);

/** The faces a run prints: the layout's, in order, narrowed to `faceKeys` when given. */
const selectFaces = (layout, faceKeys) => (layout?.faces || []).filter((f) => f && (!faceKeys || faceKeys.includes(f.key)));

/**
 * Render one sticker face for one carton.
 *
 * The carton prints against the run's context plus itself and its own packing entry's
 * style (`ctx.styleByEntry`, keyed by `carton.sourceEntryId`); `ask:` lines read the
 * run's answers (`ctx.ask`). `printBarcodes: false` leaves barcode lines blank.
 */
export const renderStickerFace = (face, carton, ctx = {}, { printBarcodes = true } = {}) => {
  const full = { ...ctx, carton, style: ctx.styleByEntry?.[carton?.sourceEntryId] ?? ctx.style ?? {} };
  const lines = (face.lines || []).filter(Boolean);
  const render = Object.hasOwn(RENDER, face.render) ? RENDER[face.render] : linesHtml;
  const box = face.border === true || face.render === FACE_RENDER.TABLE ? ' box' : '';
  return `<div class="label${box}" style="position:relative">${
    face.title ? `<span class="face-tag">${esc(face.title)}</span>` : ''}${faceChrome(face)}${
    render(lines, full, { printBarcodes })}</div>`;
};

/**
 * Lay expanded cartons out as printable sheets.
 *
 * Every carton produces one label per selected face, in face order, so a JOMO long
 * side and short side land on consecutive labels — or on the same 2-up sheet, which is
 * what the packer actually wants.
 */
export const buildStickerSheetHtml = (cartons, options = {}) => {
  const {
    layout, paper = 'A4_1UP', faceKeys, ctx = {}, draft = true, title, printBarcodes = true,
  } = options;
  const spec = paperSpec(paper);
  const faces = selectFaces(layout, faceKeys);
  const perSheet = spec.cols * spec.rows;

  const labels = [];
  cartons.forEach((carton) => {
    faces.forEach((face) => labels.push(renderStickerFace(face, carton, ctx, { printBarcodes })));
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
    body: sheets.join('')
      || `<div style="padding:10mm;font-family:Arial">${faces.length ? 'No cartons selected.' : 'No faces selected.'}</div>`,
  });
};

/**
 * Labels a given scope will produce — shown before generating, and used to chunk. The
 * same faces the sheet prints, so no face selected is no labels and no sheets.
 */
export const stickerCounts = (cartonCount, layout, paper, faceKeys) => {
  const spec = paperSpec(paper);
  const faces = selectFaces(layout, faceKeys).length;
  const labels = cartonCount * faces;
  return { faces, labels, sheets: Math.ceil(labels / (spec.cols * spec.rows)) };
};
