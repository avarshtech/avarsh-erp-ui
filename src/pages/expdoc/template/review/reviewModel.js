/**
 * The review of an uploaded buyer document, as data: the reader's result turned into
 * editable template drafts, what stops each one from saving, and adding a line the
 * reader did not account for ("possibly missed") to a template.
 */
import { DOC_TYPE, TEMPLATE_STATUS } from '../../../../utils/expDocConstants';
import { TEMPLATE_SOURCE, completeLayout } from '../../../../utils/expDocSystemTemplates';
import { newRowKey } from '../editor/editorKit';

/** One editable template per document the reader found, filled out to a full layout. */
export const draftsFromResult = (result, { buyerId, buyerName, subClientCode } = {}) =>
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
      subClientCode: subClientCode || null,
      version: 1,
      status: TEMPLATE_STATUS.DRAFT,
    },
  }));

const hasAnyColumn = (t) => Boolean(t.columns?.length) || (t.sheets || []).some((s) => s.columns?.length);

/** What stops one document from being saved; empty means it can be. */
export const blockingIssues = (draft) => {
  const t = draft.template;
  const out = [];
  if (!String(t.templateCode || '').trim()) out.push('Give it a template code.');
  if (!String(t.name || '').trim()) out.push('Give it a name.');
  if (t.docType === DOC_TYPE.PACKING_LIST && !hasAnyColumn(t)) out.push('A packing list needs at least one column.');
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
    default:
      return {};
  }
};

/** Stable keys for dismissing a finding or a "possibly missed" line on the review page. */
export const findingKey = (f) => `${f.code}|${f.document ?? ''}|${f.element ?? ''}|${f.message}`;
export const missedKey = (m) => `missed|${m.location}|${m.text}`;

/** Which "add as" choices make sense for a document type. */
export const addChoicesFor = (docType) => (docType === DOC_TYPE.INVOICE
  ? [ADD_AS.HEADER_FIELD, ADD_AS.TEXT_BLOCK, ADD_AS.DECLARATION, ADD_AS.COLUMN]
  : [ADD_AS.HEADER_FIELD, ADD_AS.TEXT_BLOCK, ADD_AS.COLUMN]);
