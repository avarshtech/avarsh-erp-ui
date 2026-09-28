/**
 * Export Documentation — the layout pieces a buyer's own format adds to the standard
 * documents: column groups, section blocks, per-sheet column sets, a totals list,
 * fixed text blocks, and the invoice's relabelled header boxes and own line columns.
 *
 * Every function here returns '' (or null, or its input) when the layout does not use
 * it, so a template without these keys prints exactly what it printed before. Every
 * string that came from a layout — and so possibly from an uploaded document read by
 * the AI — goes through `esc`.
 */
import { esc, cell } from './printDoc';
import { resolveBinding, formatBound } from './expDocTemplateSchema';
import { dimensionsLabel } from './expDocCalc';

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

// ─── Packing list ───────────────────────────────────────────────────────────────

/** Fixed sentences the buyer's document prints, at one placement. */
export const textBlocksHtml = (template, placement) => {
  const blocks = (template?.textBlocks || []).filter((b) => b?.text && (b.placement || 'AFTER_TABLE') === placement);
  if (!blocks.length) return '';
  return blocks.map((b) => `<div style="margin:6px 0;white-space:pre-wrap;">${
    b.title ? `<div style="font-weight:700;">${esc(b.title)}</div>` : ''}${esc(b.text)}</div>`).join('');
};

/**
 * Two header rows when a column sits under a spanning group ("units" over the sizes,
 * "measurement (cm)" over L B H); null when none does, so the caller keeps its one row.
 */
export const groupedHeadRows = (spec, thAttrs) => {
  if (!spec.some((c) => c.group)) return null;
  const top = [];
  const bottom = [];
  for (let i = 0; i < spec.length;) {
    const col = spec[i];
    if (!col.group) {
      top.push(`<th rowspan="2"${thAttrs(col)}>${esc(col.label)}</th>`);
      i += 1;
    } else {
      let j = i;
      while (j < spec.length && spec[j].group === col.group) j += 1;
      top.push(`<th colspan="${j - i}" class="c">${esc(col.group)}</th>`);
      for (let k = i; k < j; k += 1) bottom.push(`<th${thAttrs(spec[k])}>${esc(spec[k].label)}</th>`);
      i = j;
    }
  }
  return `<tr>${top.join('')}</tr><tr>${bottom.join('')}</tr>`;
};

/**
 * The sections each grid sheet prints.
 *
 * With no sheet naming packing types, a sheet prints every section it includes — the
 * original behaviour, kept exactly. Once sheets split by packing type (solid packs /
 * ratio packs), each row goes to the first sheet of its section that takes its type,
 * and a row no sheet takes falls to the first sheet of its section: a carton is never
 * silently left off the document.
 */
export const sheetSections = (sheets, sections) => {
  const list = sections || [];
  if (!sheets.some((s) => s.packingTypes?.length)) {
    return sheets.map((sheet) => list.filter((s) => (sheet.include || []).includes(s.key)));
  }
  const out = sheets.map(() => new Map());
  list.forEach((section) => {
    const eligible = sheets
      .map((sheet, i) => ((sheet.include || []).includes(section.key) ? i : -1))
      .filter((i) => i >= 0);
    if (!eligible.length) return;
    (section.rows || []).forEach((row) => {
      const takes = (i) => !sheets[i].packingTypes?.length || sheets[i].packingTypes.includes(row.packingType);
      const target = eligible.find(takes) ?? eligible[0];
      if (!out[target].has(section.key)) out[target].set(section.key, { ...section, rows: [] });
      out[target].get(section.key).rows.push(row);
    });
  });
  return out.map((m) => [...m.values()]);
};

/** Rows grouped by the sheet's block fields (order no, style …), in first-seen order. */
export const blocksOf = (rows, blockBy) => {
  const blocks = new Map();
  (rows || []).forEach((row) => {
    const key = blockBy.map((f) => row[f] ?? '').join('\u0001');
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(row);
  });
  return [...blocks.values()];
};

/** "ORDER NO {{row.buyerPoNo}}" filled from the block's first row. */
export const blockTitleOf = (sheet, row) => {
  if (sheet.blockTitle) {
    return sheet.blockTitle.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => String(resolveBinding(path, { row }) ?? ''));
  }
  return (sheet.blockBy || []).map((f) => row[f]).filter(Boolean).join('  ·  ');
};

/** The vertical footer list some buyers print instead of (or beside) the totals grid. */
export const totalsListHtml = (pl, totals) => {
  const rows = (pl.sections || []).flatMap((s) => s.rows || []);
  const dims = [...new Set(rows.map(dimensionsLabel).filter(Boolean))];
  const items = [
    ['TOTAL QTY', `${num(totals.pieces)} PCS`],
    ['TOTAL CARTONS', `${num(totals.cartons)} CTNS`],
    ['TOTAL NETT WEIGHT', `${num(totals.netWeightKg, 3)} KGS`],
    ['TOTAL GROSS WEIGHT', `${num(totals.grossWeightKg, 3)} KGS`],
    ['TOTAL CBM', `${num(totals.cbm, 3)} M3`],
    ...(dims.length ? [['CARTON DIMENSION', `${dims.join(', ')} CMS`]] : []),
  ];
  return `<table class="summary" style="width:auto;margin-top:6px;">${items
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>:</td><td class="grand">${esc(v)}</td></tr>`).join('')}</table>`;
};

// ─── Invoice ────────────────────────────────────────────────────────────────────

/**
 * The invoice header box printer: the standard box unless the template relabels,
 * rebinds or hides it (Prénatal's "SELLER", a bank named as consignee, a box the
 * buyer's form does not have).
 */
export const invoiceBoxPrinter = (template, bindCtx) => (key, label, value, opts = {}) => {
  const override = template?.invoiceHeader?.boxes?.[key];
  if (!override) return cell(label, value, opts);
  if (override.hidden) return `<td colspan="${opts.colspan || 1}" style="border:1px solid #333;"></td>`;
  const bound = override.binding
    ? formatBound(resolveBinding(override.binding, bindCtx), { emptyText: '' })
    : value;
  return cell(override.label ?? label, bound, opts);
};

/** Header values outside the standard boxes, four to a row, under the box grid. */
export const invoiceExtraFieldsHtml = (template, bindCtx) => {
  const fields = (template?.headerFields || []).filter((f) => f?.label);
  if (!fields.length) return '';
  const rows = [];
  for (let i = 0; i < fields.length; i += 4) rows.push(fields.slice(i, i + 4));
  return `<table>${rows.map((row) => `<tr>${row.map((f) => cell(
    f.label, formatBound(resolveBinding(f.binding, bindCtx), { emptyText: '' }),
  )).join('')}</tr>`).join('')}</table>`;
};

/** Quantity, rate and amount always close the goods table, so they are never repeated. */
const LINE_TAIL = new Set(['line.quantity', 'line.rate', 'line.amount']);
const DOCUMENT_LEVEL = /^(invoice|pl|shipment|exporter|buyer)\./;

/**
 * The buyer's own goods-table columns, or null for the grain's standard set. A column
 * bound to a document-level value (the carton marks, say) prints once, on the first
 * line — the way the buyer's own invoice shows it.
 */
export const templateInvoiceColumns = (template) => {
  const cols = (template?.invoiceColumns || []).filter((c) => c && !LINE_TAIL.has(c.binding));
  if (!cols.length) return null;
  return cols.map((c) => ({
    key: c.key,
    // Standard column labels are markup; a template's label is text and is escaped.
    label: esc(c.label || ''),
    width: c.width ? `${Number(c.width)}px` : undefined,
    align: c.align === 'right' ? 'n' : (c.align === 'center' ? 'c' : undefined),
    firstOnly: DOCUMENT_LEVEL.test(c.binding || ''),
    get: (line, ctx) => formatBound(
      resolveBinding(c.binding, { ...(ctx.bind || {}), line }, { decimals: c.decimals }),
      { decimals: c.decimals, emptyText: '' },
    ),
  }));
};
