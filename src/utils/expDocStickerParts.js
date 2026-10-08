/**
 * Carton stickers — what one line of a face prints. expDocStickerHtml lays the lines out.
 *
 * A line is a FIELD (a binding, formatted), a SIZE_GRID (the carton's colour × size
 * quantities) or a BARCODE. Each function here returns the HTML of a line's value area.
 *
 * A layout may come from a buyer's document read by the AI, so every string from a
 * layout or from data goes through `esc`, and a number a layout gives a style is coerced
 * to a number first.
 *
 * The `.v` rule (owner): the "Template only" preview hides every element of class `v`,
 * so ONLY a resolved document value is wrapped in one. Prefix, suffix and pattern
 * literals stay outside it (`<span class="v">12</span> OF <span class="v">61</span>`);
 * text fixed in the layout and the exporter's and buyer's details belong to the template
 * and never carry it, and neither does a label.
 */
import { esc } from './printDoc';
import { resolveBinding, formatBound } from './expDocTemplateSchema';
import { round, readPath } from './expDocCalc';
import { isTemplateBinding } from './expDocHtmlBlocks';
import { barcodeSvg } from './barcode1d';
import { BARCODE_SYMBOLOGY, STICKER_LINE_KIND } from './expDocConstants';

/** A document value, as the "Template only" preview can hide it. */
const data = (html) => `<span class="v">${html}</span>`;

const EMPTY = '—';

/** The value area left for hand-writing: an unbound line, or a barcode line with barcodes off. */
const BLANK = '<span class="blank"></span>';

const isUnbound = (line) => line.binding == null || line.binding === '';

/** A number from a layout, kept within bounds; null when it is not a positive number. */
const bounded = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : null;
};

const decimalsOf = (line) => (Number.isInteger(line.decimals) && line.decimals >= 0 && line.decimals <= 6
  ? line.decimals
  : undefined);

/** A line's printed label, or null for a headline. A mode that prints its own colon drops the label's. */
export const labelOf = (line, { bare = false } = {}) => {
  const text = String(line.label ?? '').trim();
  return (bare ? text.replace(/\s*:$/, '') : text) || null;
};

/** 'center' or 'right'; null keeps the default left. */
export const alignOf = (line) => ({ CENTER: 'center', RIGHT: 'right' })[String(line.align || '').toUpperCase()] || null;

/** The line's own font — size, weight, capitals — and its alignment where the mode lets a line align itself. */
export const lineStyle = (line, { align = false } = {}) => {
  const pt = bounded(line.fontPt, 4, 72);
  const side = align ? alignOf(line) : null;
  return [
    pt ? `font-size:${pt}pt` : '',
    line.bold ? 'font-weight:700' : '',
    line.caps ? 'text-transform:uppercase' : '',
    side ? `text-align:${side}` : '',
  ].filter(Boolean).join(';');
};

// ─── FIELD ──────────────────────────────────────────────────────────────────────

/** "60", "60.5": a centimetre figure as the measurement prints it, without a trailing ".0". */
const cm = (v) => (Number(v) > 0 ? String(round(v, 1)) : null);

/** What a pattern's tokens stand for on this carton; null for a binding that takes no pattern. */
const patternTokens = (binding, carton = {}) => {
  if (binding === 'carton.cartonNo' || binding === 'carton.nOfN') return { n: carton.cartonNo, N: carton.total };
  if (binding === 'carton.dimensions') return { L: cm(carton.lengthCm), B: cm(carton.breadthCm), H: cm(carton.heightCm) };
  return null;
};

/**
 * The pattern with each token's value as data and the text around them as the
 * template's own. Null when a token it uses has no value, so the line prints "—"
 * rather than half a measurement.
 */
const patternHtml = (pattern, tokens) => {
  let complete = true;
  const html = String(pattern).split(/(\{[nNLBH]\})/).map((part) => {
    const key = /^\{([nNLBH])\}$/.exec(part)?.[1];
    if (!key || !(key in tokens)) return esc(part);
    if (tokens[key] == null || tokens[key] === '') complete = false;
    return data(esc(tokens[key]));
  }).join('');
  return complete ? html : null;
};

/** A binding's value. A list is joined as the line says (" / " unless it says otherwise), a map as "M: 10 / L: 20". */
const boundValue = (line, full) => {
  const binding = String(line.binding);
  const raw = /^(fixed|ask):/.test(binding) ? undefined : readPath(full, binding);
  const join = String(line.join ?? ' / ');
  const present = (v) => v != null && v !== '';
  if (Array.isArray(raw)) return raw.filter(present).join(join);
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).filter(([, v]) => present(v) && v !== 0).map(([k, v]) => `${k}: ${v}`).join(join);
  }
  return resolveBinding(binding, full, { decimals: decimalsOf(line) });
};

/**
 * A FIELD line's value area. Unbound, it is space to write in. A bound value that
 * resolves to nothing prints "—". The carton number and the measurement follow the
 * line's pattern ("{n} OF {N}", "{L}x{B}x{H}CMS"); prefix and suffix frame the value.
 */
const fieldHtml = (line, full) => {
  if (isUnbound(line)) return BLANK;
  const binding = String(line.binding);
  const wrap = isTemplateBinding(binding) ? (html) => html : data;
  const tokens = line.pattern ? patternTokens(binding, full.carton) : null;
  let value;
  if (tokens) {
    value = patternHtml(line.pattern, tokens);
  } else {
    const raw = boundValue(line, full);
    value = raw == null || raw === '' ? null : wrap(esc(formatBound(raw, { decimals: decimalsOf(line), emptyText: '' })));
  }
  if (value == null) return wrap(EMPTY);
  return `${esc(line.prefix ?? '')}${value}${esc(line.suffix ?? '')}`;
};

// ─── SIZE_GRID ──────────────────────────────────────────────────────────────────

const qty = (v) => Number(v) || 0;
const sum = (list) => list.reduce((t, v) => t + v, 0);

/**
 * The carton's colour × size grid. A row per colour: a mixed carton's colours, else the
 * carton's own. A column per size: every size of the packing list (`sizes: ALL`, so a
 * buyer's fixed columns print on a single-size carton too) or only the sizes in this
 * carton (`CARTON`). A cell is the quantity, or for a ratio pack the assortment ratio
 * (`cells: RATIO`). With `totals`, a TOTAL column and a TOTAL row: an empty data cell
 * prints blank, a total prints 0. The corner text is the template's.
 */
const sizeGridHtml = (line, full) => {
  const carton = full.carton || {};
  const cfg = line.grid || {};
  const ratio = cfg.cells === 'RATIO' && carton.ratio ? carton.ratio : null;
  const rows = carton.mixedRows?.length
    ? carton.mixedRows.map((r) => ({ colour: r?.colorName, cells: r?.sizeQty || {} }))
    : [{ colour: carton.colorName, cells: ratio || carton.sizeQty || {} }];

  const listed = (full.pl?.sizes || []).map(String);
  const found = [...new Set(rows.flatMap((r) => Object.keys(r.cells)))];
  const all = [...listed, ...found.filter((s) => !listed.includes(s))];
  const sizes = cfg.sizes === 'CARTON' ? all.filter((s) => rows.some((r) => qty(r.cells[s]) > 0)) : all;
  if (!sizes.length) return data(EMPTY);

  const rowTotal = (r) => sum(sizes.map((s) => qty(r.cells[s])));
  const cell = (n) => (n ? `<td class="v">${esc(n)}</td>` : '<td></td>');
  const total = (n) => `<td class="v tot">${esc(n)}</td>`;
  const head = `<tr><th class="c">${esc(cfg.corner ?? '')}</th>${sizes.map((s) => `<th class="v">${esc(s)}</th>`).join('')}${
    cfg.totals ? '<th class="tot">TOTAL</th>' : ''}</tr>`;
  const body = rows.map((r) => `<tr><td class="c${r.colour ? ' v' : ''}">${esc(r.colour ?? '')}</td>${
    sizes.map((s) => cell(qty(r.cells[s]))).join('')}${cfg.totals ? total(rowTotal(r)) : ''}</tr>`).join('');
  const foot = cfg.totals
    ? `<tr><td class="c tot">TOTAL</td>${sizes.map((s) => total(sum(rows.map((r) => qty(r.cells[s]))))).join('')}${
      total(sum(rows.map(rowTotal)))}</tr>`
    : '';
  const pt = bounded(line.fontPt, 4, 72);
  return `<table class="grid"${pt ? ` style="font-size:${pt}pt"` : ''}>${head}${body}${foot}</table>`;
};

// ─── BARCODE ────────────────────────────────────────────────────────────────────

/**
 * A BARCODE line's value area. With barcodes switched off for the run it is left blank,
 * like an unbound line. Bound to `carton.eanBySize` it prints one barcode per size in the
 * carton, side by side — a map of EANs can only print per size; bound to anything else
 * (the carton number, `fixed:` text), one. A symbology with no encoder yet prints a
 * visible notice, and a size with no usable EAN is named, rather than leaving a gap the
 * packer would only discover at the scanner.
 */
const barcodeHtml = (line, full, printBarcodes) => {
  if (!printBarcodes || isUnbound(line)) return BLANK;
  const binding = String(line.binding);
  const cfg = line.barcode || {};
  const perSize = binding === 'carton.eanBySize';
  const symbology = String(cfg.symbology || (perSize ? 'EAN13' : 'CODE128'));
  const known = Object.hasOwn(BARCODE_SYMBOLOGY, symbology) ? BARCODE_SYMBOLOGY[symbology] : null;
  if (!known?.printable) {
    return `<span class="bc-na">${esc(`${known?.label || symbology} barcodes are not printed yet`)}</span>`;
  }
  const opts = { heightMm: bounded(cfg.heightMm, 6, 40) || 12, showText: cfg.showText !== false };
  const one = (value, size) => {
    const svg = value == null || value === '' ? null : barcodeSvg(symbology, value, opts);
    if (svg) return `<span class="bc">${svg}</span>`;
    const what = size == null ? `"${value ?? ''}"` : `size ${size}${value ? ` ("${value}")` : ''}`;
    return `<span class="bc-err">${esc(`Barcode unavailable for ${what}`)}</span>`;
  };
  const eans = full.carton?.eanBySize || {};
  const html = perSize
    ? (full.carton?.sizes || []).map((size) => one(eans[size], size)).join('')
    : one(resolveBinding(binding, full));
  if (!html) return data(EMPTY);
  return `<span class="bcs${isTemplateBinding(binding) ? '' : ' v'}">${html}</span>`;
};

/**
 * A line's value area, and whether it is a block — the size grid, which spans the face
 * at its position rather than following its label. An unbound line is space to write in.
 */
export const lineContent = (line, full, { printBarcodes = true } = {}) => {
  switch (line.kind) {
    case STICKER_LINE_KIND.SIZE_GRID:
      return isUnbound(line) ? { html: BLANK, block: false } : { html: sizeGridHtml(line, full), block: true };
    case STICKER_LINE_KIND.BARCODE:
      return { html: barcodeHtml(line, full, printBarcodes), block: false };
    default:
      return { html: fieldHtml(line, full), block: false };
  }
};
