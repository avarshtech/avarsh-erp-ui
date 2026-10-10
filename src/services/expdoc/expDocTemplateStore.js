/**
 * Buyer document templates as the screens see them: the API's packing-list, invoice and
 * carton-sticker templates, plus the built-in standard layouts.
 *
 * Every write names the template it acts on (not just an id). Screens reach this
 * through expDocService.
 */
import * as api from './exportTemplateApi';
import { uploadFile } from '../core/fileService';
import { loadDb } from './expDocMockStore';
import { TEMPLATE_STATUS } from '../../utils/expDocConstants';
import {
  SYSTEM_TEMPLATES, isSystemTemplateId, TEMPLATE_SOURCE, pickLayout,
} from '../../utils/expDocSystemTemplates';
import { diffTemplates } from '../../utils/expDocTemplateDiff';

export { getTemplateSample } from './expDocMockSamples';

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

/** Packing lists, invoices and sticker runs that pinned this template revision — all still mock. */
const usageOf = (db, id) => {
  const count = (rows) => (rows || []).filter((d) => String(d.templateId) === String(id)).length;
  const pls = count(db.packingLists);
  const invoices = count(db.invoices);
  const stickerRuns = count(db.stickerRuns);
  return { packingLists: pls, invoices, stickerRuns, total: pls + invoices + stickerRuns };
};

/**
 * Documents keep a snapshot of their layout and a sticker run names a revision that
 * never changes, so an API template can always be retired.
 */
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
  const rows = await apiTemplateSummaries({ force });
  const db = loadDb();
  return rows.map((t) => decorateApi(t, db));
};

export const getTemplate = async (id) => {
  if (isSystemTemplateId(id)) {
    const standard = Object.values(SYSTEM_TEMPLATES).find((t) => t.id === id);
    if (!standard) throw new Error(`Template ${id} not found`);
    return { ...clone(standard), versions: [], usage: { total: 0 }, editable: false };
  }
  return decorateApi(await api.getApiTemplate(id));
};

export const compareTemplates = async (idA, idB) =>
  diffTemplates(await getTemplate(idA), await getTemplate(idB));

// ─── Writes ─────────────────────────────────────────────────────────────────────

export const createTemplate = (template) => write(async () => decorateApi(await api.createApiTemplate(template)));

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

export const updateTemplate = (template) => write(async () =>
  decorateApi(await api.updateApiTemplate(template.id, template)));

/** A new template from any existing one, including a built-in standard layout. */
export const cloneTemplate = (source, target) => write(async () => {
  const identity = {
    templateCode: target.templateCode, name: target.name,
    buyerId: target.buyerId ?? null,
  };
  if (source.source === TEMPLATE_SOURCE.API) return decorateApi(await api.cloneApiTemplate(source.id, identity));
  // The standard layout has no API row to clone: its layout becomes a new template.
  return decorateApi(await api.createApiTemplate({ ...pickLayout(source), docType: source.docType, ...identity }));
});

export const newTemplateVersion = (template) => write(async () => decorateApi(await api.reviseApiTemplate(template.id)));

export const publishTemplate = (template, options = {}) => write(async () => decorateApi(await api.publishApiTemplate(
  template.id, { version: template.lockVersion, effectiveFrom: options.effectiveFrom, reason: options.reason },
)));

export const retireTemplate = (template, reason) => write(async () =>
  decorateApi(await api.retireApiTemplate(template.id, { version: template.lockVersion, reason })));

export const deleteTemplate = (template) => write(() => api.deleteApiTemplate(template.id));
