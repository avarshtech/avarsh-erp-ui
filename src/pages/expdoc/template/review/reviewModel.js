/**
 * The review of an uploaded buyer document, as data: the reader's result turned into
 * editable template drafts, what stops each one from saving, and adding a line of the
 * document the reader did not use to a template. What the review asks the user about
 * is in attentionModel.
 */
import { DOC_TYPE, TEMPLATE_STATUS } from '../../../../utils/expDocConstants';
import { TEMPLATE_SOURCE, completeLayout } from '../../../../utils/expDocSystemTemplates';
import { newRowKey } from '../editor/rowKeys';
import { appendStickerLinePatch, hasStickerLine } from './stickerReviewModel';

/** One editable template per document the reader found, filled out to a full layout. */
export const draftsFromResult = (result, { buyerId, buyerName } = {}) =>
  (result?.documents || []).map((doc, i) => ({
    uid: `doc-${i}`,
    index: i,
    include: true,
    where: doc.where,
    meta: doc.elementMeta || {},
    template: {
      ...completeLayout(doc.docType, doc.layout || {}),
      id: `import-${i}`,
      source: TEMPLATE_SOURCE.API,
      docType: doc.docType,
      templateCode: doc.suggestedCode || '',
      name: doc.suggestedName || '',
      buyerId: buyerId ?? null,
      buyerName: buyerName ?? null,
      version: 1,
      status: TEMPLATE_STATUS.DRAFT,
    },
  }));

const hasAnyColumn = (t) => Boolean(t.columns?.length) || (t.sheets || []).some((s) => s.columns?.length);

/**
 * What stops one document from being saved — empty means it can be — each with the
 * layout editor tab that fixes it.
 */
export const blockingIssues = (draft) => {
  const t = draft.template;
  const out = [];
  if (!String(t.name || '').trim()) out.push({ text: 'Give the template a name.', tab: 'identity' });
  if (!String(t.templateCode || '').trim()) out.push({ text: 'Give the template a code.', tab: 'identity' });
  if (t.docType === DOC_TYPE.PACKING_LIST && !hasAnyColumn(t)) {
    out.push({ text: 'A packing list needs at least one table column.', tab: 'columns' });
  }
  if (t.docType === DOC_TYPE.STICKER && !hasStickerLine(t)) {
    out.push({ text: 'A carton sticker needs at least one face with a line.', tab: 'sticker' });
  }
  return out;
};

/** What travels with a saved template so its builder can still show the reader's notes. */
export const extractionMetaOf = (draft, result) => ({
  model: result?.model || null,
  fileName: result?.fileName || null,
  readAt: new Date().toISOString(),
  where: draft.where || null,
  elementMeta: draft.meta || {},
});

/**
 * Add a line of the document the reader did not account for, as the kind of element
 * the user says it is. Returns the patch for the template.
 */
export const ADD_AS = {
  HEADER_FIELD: 'Header field',
  TEXT_BLOCK: 'Fixed text',
  DECLARATION: 'Declaration',
  COLUMN: 'Column',
  STICKER_LINE: 'Sticker line',
  STICKER_TEXT: 'Sticker text',
};

/** How the review offers each choice, in the user's words rather than the layout's. */
export const ADD_AS_LABEL = {
  [ADD_AS.HEADER_FIELD]: 'As a field (a label with a value)',
  [ADD_AS.TEXT_BLOCK]: 'As a note (the same text on every document)',
  [ADD_AS.DECLARATION]: 'As a declaration',
  [ADD_AS.COLUMN]: 'As a table column',
  [ADD_AS.STICKER_LINE]: 'As a sticker line (a label with a value)',
  [ADD_AS.STICKER_TEXT]: 'As fixed text on the sticker',
};

export const addMissedPatch = (template, text, as) => {
  const clean = String(text || '').replace(/[:\s]+$/, '').trim();
  switch (as) {
    case ADD_AS.HEADER_FIELD:
      return { headerFields: [...(template.headerFields || []), { key: newRowKey('f'), label: clean, binding: undefined }] };
    case ADD_AS.TEXT_BLOCK:
      return { textBlocks: [...(template.textBlocks || []), { key: newRowKey('t'), title: '', text: String(text).trim(), placement: 'AFTER_TABLE' }] };
    case ADD_AS.DECLARATION: {
      const list = template.declarations || [];
      return { declarations: [...list, { order: list.length + 1, code: `D${list.length + 1}`, text: String(text).trim() }] };
    }
    case ADD_AS.COLUMN:
      if (template.docType === DOC_TYPE.INVOICE) {
        return { invoiceColumns: [...(template.invoiceColumns || []), { key: newRowKey('c'), label: clean, type: 'TEXT', width: 100 }] };
      }
      return { columns: [...(template.columns || []), { key: newRowKey('c'), label: clean, type: 'TEXT', width: 100 }] };
    // On the first face, as the sticker editor adds a line: a label with nothing filling it
    // yet (the review then asks what does), or the text itself, printed as it is.
    case ADD_AS.STICKER_LINE:
      return appendStickerLinePatch(template, { label: clean, binding: null });
    case ADD_AS.STICKER_TEXT:
      return appendStickerLinePatch(template, { label: null, binding: `fixed:${String(text).trim()}` });
    default:
      return {};
  }
};

/** Stable key for a line of left-over text, so ignoring it holds across documents. */
export const missedKey = (m) => `missed|${m.location}|${m.text}`;

/** Which "add as" choices make sense for a document type. */
export const addChoicesFor = (docType) => {
  if (docType === DOC_TYPE.STICKER) return [ADD_AS.STICKER_LINE, ADD_AS.STICKER_TEXT];
  return docType === DOC_TYPE.INVOICE
    ? [ADD_AS.HEADER_FIELD, ADD_AS.TEXT_BLOCK, ADD_AS.DECLARATION, ADD_AS.COLUMN]
    : [ADD_AS.HEADER_FIELD, ADD_AS.TEXT_BLOCK, ADD_AS.COLUMN];
};
