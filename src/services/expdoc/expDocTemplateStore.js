/**
 * Buyer document templates as the screens see them: one list and one set of actions
 * over two stores — packing-list and invoice templates in the API, carton-sticker
 * templates still in the export-docs mock — plus the built-in standard layouts.
 *
 * Every write names the template it acts on (not just an id), because the template's
 * `source` decides where the write goes. Screens reach this through expDocService.
 */
import * as api from './exportTemplateApi';
import * as mock from './expDocMockTemplates';
import { uploadFile } from '../core/fileService';
import { isApiDocType } from './exportTemplateAdapter';
import { loadDb } from './expDocMockStore';
import { TEMPLATE_STATUS } from '../../utils/expDocConstants';
import {
  SYSTEM_TEMPLATES, isSystemTemplateId, TEMPLATE_SOURCE, pickLayout,
} from '../../utils/expDocSystemTemplates';
import { diffTemplates } from '../../utils/expDocTemplateDiff';

const TTL_MS = 60 * 1000;
let cache = { at: 0, rows: null, pending: null };

export const invalidateTemplateCache = () => { cache = { at: 0, rows: null, pending: null }; };

/** API summaries, shared by the register and the document pickers for a minute. */
export const apiTemplateSummaries = ({ force } = {}) => {
  if (!force && cache.rows && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.rows);
  if (!force && cache.pending) return cache.pending;
  cache.pending = api.listApiTemplates()
    .then((rows) => { cache = { at: Date.now(), rows, pending: null }; return rows; })
    .catch((e) => { cache.pending = null; throw e; });
  return cache.pending;
};

/** Documents that pinned this template revision — packing lists and invoices are still mock. */
const usageOf = (db, id) => {
  const pls = (db.packingLists || []).filter((d) => String(d.templateId) === String(id)).length;
  const invoices = (db.invoices || []).filter((d) => String(d.templateId) === String(id)).length;
  return { packingLists: pls, invoices, stickerRuns: 0, total: pls + invoices };
};

/** Documents keep a snapshot of their layout, so an API template can always be retired. */
const decorateApi = (t, db = loadDb()) => ({
  ...t,
  usage: usageOf(db, t.id),
  editable: t.status === TEMPLATE_STATUS.DRAFT,
  canPublish: t.status === TEMPLATE_STATUS.DRAFT,
  canRetire: t.status === TEMPLATE_STATUS.ACTIVE,
  canDelete: t.status === TEMPLATE_STATUS.DRAFT,
});

const write = async (fn) => {
  const out = await fn();
  invalidateTemplateCache();
  return out;
};

const clone = (v) => JSON.parse(JSON.stringify(v));

// ─── Reads ──────────────────────────────────────────────────────────────────────

export const listAllTemplates = async ({ force } = {}) => {
  const [rows, stickers] = await Promise.all([apiTemplateSummaries({ force }), mock.listStickerTemplates()]);
  const db = loadDb();
  return [...rows.map((t) => decorateApi(t, db)), ...stickers];
};

export const getTemplate = async (id) => {
  if (isSystemTemplateId(id)) {
    const standard = Object.values(SYSTEM_TEMPLATES).find((t) => t.id === id);
    if (!standard) throw new Error(`Template ${id} not found`);
    return { ...clone(standard), versions: [], usage: { total: 0 }, editable: false };
  }
  if (mock.isMockTemplateId(id)) return mock.getStickerTemplate(id);
  return decorateApi(await api.getApiTemplate(id));
};

export const compareTemplates = async (idA, idB) =>
  diffTemplates(await getTemplate(idA), await getTemplate(idB));

export const getTemplateSample = (template) => mock.getTemplateSample(template);

export const listStickerBuyers = () => mock.listStickerBuyers();

// ─── Writes ─────────────────────────────────────────────────────────────────────

const stickerPayload = (t) => ({
  templateCode: t.templateCode,
  name: t.name,
  buyerCode: t.buyerCode || null,
  layout: pickLayout(t),
  stickerLayout: t.stickerLayout,
  clonedFromId: t.clonedFromId ?? null,
});

export const createTemplate = (template) => write(async () => (isApiDocType(template.docType)
  ? decorateApi(await api.createApiTemplate(template))
  : mock.createStickerTemplate(stickerPayload(template))));

/**
 * Save the reviewed templates read from one uploaded document. The file goes to
 * storage first so every template can name it as its source; if storage refuses it,
 * the templates are still saved — they are the work — and the caller says so.
 */
export const saveUploadedTemplates = (templates, file) => write(async () => {
  let stored = null;
  if (file) {
    try {
      stored = await uploadFile(file, {
        module: 'EXPORT_DOCS', entity: 'EXPORT_TEMPLATE', fileCategory: 'DOCUMENT',
        description: 'Buyer document the template was read from',
      });
    } catch (e) {
      // axiosInstance has already shown the storage error; the templates still save.
      stored = null;
      console.warn('Template source file was not stored', e?.message);
    }
  }
  const saved = await api.createApiTemplateBatch(templates, { fileId: stored?.fileId, fileName: file?.name });
  const db = loadDb();
  return { templates: saved.map((t) => decorateApi(t, db)), sourceStored: Boolean(stored) };
});

export const updateTemplate = (template) => write(async () => (template.source === TEMPLATE_SOURCE.API
  ? decorateApi(await api.updateApiTemplate(template.id, template))
  : mock.updateStickerTemplate(template.id, template)));

/** A new template from any existing one, including a built-in standard layout. */
export const cloneTemplate = (source, target) => write(async () => {
  const identity = {
    templateCode: target.templateCode, name: target.name,
    buyerId: target.buyerId ?? null,
  };
  if (source.source === TEMPLATE_SOURCE.API) return decorateApi(await api.cloneApiTemplate(source.id, identity));
  if (source.source === TEMPLATE_SOURCE.MOCK) {
    return mock.createStickerTemplate(stickerPayload({ ...source, ...identity, buyerCode: target.buyerCode, clonedFromId: source.id }));
  }
  // The standard layout has no API row to clone: its layout becomes a new template.
  return decorateApi(await api.createApiTemplate({ ...pickLayout(source), docType: source.docType, ...identity }));
});

export const newTemplateVersion = (template) => write(async () => (template.source === TEMPLATE_SOURCE.API
  ? decorateApi(await api.reviseApiTemplate(template.id))
  : mock.newStickerTemplateVersion(template.id)));

export const publishTemplate = (template, options = {}) => write(async () => (template.source === TEMPLATE_SOURCE.API
  ? decorateApi(await api.publishApiTemplate(template.id, {
    version: template.lockVersion, effectiveFrom: options.effectiveFrom, reason: options.reason,
  }))
  : mock.publishStickerTemplate(template.id, options)));

export const retireTemplate = (template, reason) => write(async () => (template.source === TEMPLATE_SOURCE.API
  ? decorateApi(await api.retireApiTemplate(template.id, { version: template.lockVersion, reason }))
  : mock.retireStickerTemplate(template.id, reason)));

export const deleteTemplate = (template) => write(() => (template.source === TEMPLATE_SOURCE.API
  ? api.deleteApiTemplate(template.id)
  : mock.deleteStickerTemplate(template.id)));
