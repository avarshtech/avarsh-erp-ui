/**
 * The upload review's "Needs your attention" list, worked out from the template as it
 * stands — so fixing an item takes it off the list — together with the reader's notes
 * about the document: labels it could not find, rows it was unsure of, and text it did
 * not use.
 *
 * Elements are named by the ids the reader's notes use ("headerFields:licenceNo",
 * "sheets:SOLID.columns:qty", "invoiceHeader.boxes:consignee"), so a note and the row
 * it is about always meet.
 */
import { DOC_TYPE, INVOICE_BOXES } from '../../../../utils/expDocConstants';
import { blockingIssues, missedKey } from './reviewModel';
import { parseEvidence } from './sourceRefs';

export const ATTENTION = {
  BLOCKER: 'BLOCKER',
  NOT_FOUND: 'NOT_FOUND',
  UNBOUND: 'UNBOUND',
  UNSURE: 'UNSURE',
  LEFT_OVER: 'LEFT_OVER',
};

const BOX_LABEL = Object.fromEntries(INVOICE_BOXES.map((b) => [b.key, b.label]));
const NOT_FOUND_CODES = new Set(['NOT_IN_DOCUMENT', 'FIXED_NOT_IN_DOCUMENT']);
/** Reader notes the list asks about itself, or that the template now answers live. */
const ASKED_CODES = new Set([...NOT_FOUND_CODES, 'UNBOUND', 'UNKNOWN_BINDING', 'NO_TABLE']);

/** Which ERP data suits a field, by where it prints — the same split the layout editor offers. */
const HEADER_DATA = ['EXPORTER', 'BUYER', 'INVOICE', 'SHIPMENT', 'PL'];
const ROW_DATA = ['ROW', 'CALC', 'STYLE', 'PL'];
const LINE_DATA = ['LINE', 'INVOICE', 'STYLE'];

/** Every printed element of a template, by the id the reader's notes use for it. */
export const elementsOf = (t = {}) => {
  const out = [];
  const add = (id, label, extra = {}) => out.push({
    id, label, binding: null, bindable: false, removable: true, ...extra,
  });
  (t.headerFields || []).forEach((f) => add(`headerFields:${f.key}`, f.label, { binding: f.binding, bindable: true, data: HEADER_DATA }));
  (t.addressBlocks || []).forEach((f) => add(`addressBlocks:${f.key}`, f.label, { binding: f.binding, bindable: true, data: HEADER_DATA }));
  const columns = (list, prefix, data) => (list || []).forEach((c) => add(`${prefix}:${c.key}`, c.label, {
    binding: c.binding, bindable: c.type !== 'SIZE_GRID', data,
  }));
  columns(t.columns, 'columns', ROW_DATA);
  (t.sheets || []).forEach((s) => {
    // A section is never removed from here: the cartons it prints would stop printing.
    add(`sheets:${s.key}`, s.title || s.key, { removable: false });
    columns(s.columns, `sheets:${s.key}.columns`, ROW_DATA);
  });
  columns(t.invoiceColumns, 'invoiceColumns', LINE_DATA);
  Object.entries(t.invoiceHeader?.boxes || {}).forEach(([key, b]) => {
    if (!b?.hidden) add(`invoiceHeader.boxes:${key}`, b?.label || BOX_LABEL[key] || key);
  });
  (t.textBlocks || []).forEach((b) => add(`textBlocks:${b.key}`, b.title || b.text));
  (t.declarations || []).forEach((d) => add(`declarations:${d.code}`, d.text));
  return out;
};

const parseId = (id) => {
  const sheetColumn = /^sheets:([^.]+)\.columns:(.+)$/.exec(id);
  if (sheetColumn) return { list: 'sheetColumns', sheet: sheetColumn[1], key: sheetColumn[2] };
  const at = id.indexOf(':');
  return { list: id.slice(0, at), key: id.slice(at + 1) };
};

const mapSheet = (t, sheetKey, fn) => ({
  sheets: (t.sheets || []).map((s) => (s.key === sheetKey ? fn(s) : s)),
});

/** The template patch that takes one element out of what prints. */
export const removeElementPatch = (t, id) => {
  const { list, sheet, key } = parseId(id);
  switch (list) {
    case 'headerFields':
    case 'addressBlocks':
    case 'columns':
    case 'textBlocks':
      return { [list]: (t[list] || []).filter((x) => x.key !== key) };
    case 'invoiceColumns': {
      // No columns of its own means the standard goods columns — never an empty table.
      const left = (t.invoiceColumns || []).filter((c) => c.key !== key);
      return { invoiceColumns: left.length ? left : null };
    }
    case 'declarations':
      return {
        declarations: (t.declarations || []).filter((d) => d.code !== key).map((d, i) => ({ ...d, order: i + 1 })),
      };
    case 'sheetColumns':
      return mapSheet(t, sheet, (s) => {
        const { columns: own, ...rest } = s;
        const left = (own || []).filter((c) => c.key !== key);
        // Without its own columns a section prints the main ones, rather than none.
        return left.length ? { ...rest, columns: left } : rest;
      });
    case 'invoiceHeader.boxes': {
      const boxes = { ...(t.invoiceHeader?.boxes || {}) };
      boxes[key] = { ...(boxes[key] || {}), hidden: true };
      return { invoiceHeader: { ...(t.invoiceHeader || {}), boxes } };
    }
    default:
      return {};
  }
};

/** The template patch that makes one field or column print `binding`. */
export const bindElementPatch = (t, id, binding) => {
  const { list, sheet, key } = parseId(id);
  const bind = (rows) => (rows || []).map((x) => (x.key === key ? { ...x, binding } : x));
  switch (list) {
    case 'headerFields':
    case 'addressBlocks':
    case 'columns':
    case 'invoiceColumns':
      return { [list]: bind(t[list]) };
    case 'sheetColumns':
      return mapSheet(t, sheet, (s) => ({ ...s, columns: bind(s.columns) }));
    default:
      return {};
  }
};

const sheetOf = (text) => String(text || '').split('!')[0].replace(/^'|'$/g, '').trim().toUpperCase();

/**
 * The left-over text of this document. In a workbook it goes to the document read from
 * its sheet; text on a sheet no document came from, or in a PDF, is offered to every
 * document, and ignoring it once ignores it everywhere.
 */
const leftOversFor = (draft, result) => {
  const docSheets = new Set((result?.documents || []).map((d) => sheetOf(d.where)).filter(Boolean));
  const mine = sheetOf(draft.where);
  return (result?.missed || []).filter((m) => {
    const sheet = parseEvidence(m.location)?.sheet;
    if (!sheet || !docSheets.has(sheetOf(sheet))) return true;
    return sheetOf(sheet) === mine;
  });
};

const keyOf = (docUid, item) => (item.kind === ATTENTION.LEFT_OVER
  ? missedKey(item.missed)
  : `${docUid}|${item.kind}|${item.elementId || item.text}`);

/**
 * What answering an item settles: the item, and for an element also the reader's "not
 * sure" question about it — once the user has decided what a field prints, or to keep
 * it, asking whether it looks right is noise.
 */
export const answerKeys = (docUid, item) => [
  item.key,
  ...(item.elementId ? [keyOf(docUid, { kind: ATTENTION.UNSURE, elementId: item.elementId })] : []),
];

/**
 * What one document needs from the user, most important first: what stops it saving,
 * labels not in the file, fields nothing fills, rows the reader was unsure of, and
 * text it did not use. One item per element — the most pressing question about it.
 */
export const attentionItems = ({ draft, result, dismissed = new Set() }) => {
  const meta = draft.meta || {};
  const elements = elementsOf(draft.template);
  const byId = new Map(elements.map((e) => [e.id, e]));
  const items = [];
  const asked = new Set();
  const add = (item) => {
    const key = keyOf(draft.uid, item);
    if (dismissed.has(key)) return;
    items.push({ ...item, key });
    if (item.elementId) asked.add(item.elementId);
  };

  blockingIssues(draft).forEach((b) => add({ kind: ATTENTION.BLOCKER, text: b.text, tab: b.tab }));

  (result?.findings || [])
    .filter((f) => f.document === draft.index && NOT_FOUND_CODES.has(f.code) && byId.has(f.element))
    .forEach((f) => {
      const e = byId.get(f.element);
      if (asked.has(e.id)) return;
      add({
        kind: ATTENTION.NOT_FOUND, elementId: e.id, label: e.label, removable: e.removable,
        fixedText: f.code === 'FIXED_NOT_IN_DOCUMENT', evidence: f.evidence || meta[e.id]?.evidence,
      });
    });

  elements
    .filter((e) => e.bindable && e.label && !e.binding && !asked.has(e.id))
    .forEach((e) => add({
      kind: ATTENTION.UNBOUND, elementId: e.id, label: e.label, data: e.data, removable: e.removable,
      evidence: meta[e.id]?.evidence, sample: meta[e.id]?.sample, suggested: meta[e.id]?.suggestedBinding,
    }));

  Object.entries(meta)
    .filter(([id, m]) => m?.confidence === 'LOW' && byId.has(id) && !asked.has(id))
    .forEach(([id, m]) => add({
      kind: ATTENTION.UNSURE, elementId: id, label: byId.get(id).label, removable: byId.get(id).removable,
      evidence: m.evidence, sample: m.sample,
    }));

  leftOversFor(draft, result).forEach((m) => add({
    kind: ATTENTION.LEFT_OVER, text: m.text, missed: m, evidence: m.location,
  }));
  return items;
};

/** What the reader did or noticed about this document that needs no answer. */
export const readerNotes = (draft, result) => (result?.findings || [])
  .filter((f) => f.document === draft.index && !ASKED_CODES.has(f.code))
  .map((f) => f.message);

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "6 fields at the top · 14 table columns · 3 carton sections · 2 notes" */
export const whatWasRead = (t) => {
  const parts = [];
  const fields = (t.headerFields || []).length + (t.addressBlocks || []).length;
  if (fields) parts.push(count(fields, 'field at the top', 'fields at the top'));
  if (t.docType === DOC_TYPE.PACKING_LIST) {
    parts.push(count((t.columns || []).length, 'table column', 'table columns'));
    const sections = (t.sheets || []).filter((s) => s.type !== 'SUMMARY').length;
    if (sections) parts.push(count(sections, 'carton section', 'carton sections'));
  } else if (t.docType === DOC_TYPE.INVOICE) {
    const columns = (t.invoiceColumns || []).length;
    parts.push(columns ? count(columns, 'goods column', 'goods columns') : 'the standard goods columns');
    const boxes = Object.keys(t.invoiceHeader?.boxes || {}).length;
    if (boxes) parts.push(count(boxes, 'header box changed', 'header boxes changed'));
  }
  const notes = (t.textBlocks || []).length + (t.declarations || []).length;
  if (notes) parts.push(count(notes, 'note', 'notes'));
  return parts.join(' · ');
};
