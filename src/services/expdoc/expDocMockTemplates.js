/**
 * Carton-sticker templates — mock service (PRD §10).
 *
 * STICKERS ONLY. Packing-list and invoice templates live in the API
 * (/api/v1/export-docs/templates); stickers stay here until their buyer layouts are
 * shared and moved too. `expDocTemplateStore` routes each call to the right place,
 * and the ids here are strings ("STK-3") so a sticker can never be mistaken for an
 * API template on the same screen.
 *
 * A template row is IMMUTABLE ONCE PUBLISHED. A new version is a new row sharing the
 * template code, so a sticker run that stored `templateId` keeps rendering exactly
 * the layout it was printed with (§10 opening paragraph, BR-08). A buyer may keep
 * several active sticker layouts — staff pick one per sticker run — and publishing a
 * version retires the previous active version of the same template code.
 */
import { loadDb, saveDb } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pushAudit, nowStamp, todayStr, currentUserName,
} from './expDocMockCommon';
import { getBuyerCommercial } from './expDocMockMasters';
import { decorate as decorateShipment } from './expDocMockShipments';
import { TEMPLATE_STATUS, DOC_TYPE } from '../../utils/expDocConstants';
import { isBindable } from '../../utils/expDocTemplateSchema';
import { TEMPLATE_SOURCE } from '../../utils/expDocSystemTemplates';

export const isMockTemplateId = (id) => String(id ?? '').startsWith('STK-');

const stickers = (db) => (db.templates || []).filter((t) => t.docType === DOC_TYPE.STICKER);
const find = (db, id) => stickers(db).find((t) => String(t.id) === String(id));

const nextId = (db) => `STK-${Math.max(0, ...(db.templates || [])
  .map((t) => Number(String(t.id).replace(/^STK-/, '')) || 0)) + 1}`;

const nextVersion = (db, templateCode) => Math.max(
  0,
  ...stickers(db).filter((t) => t.templateCode === templateCode).map((t) => t.version || 0),
) + 1;

// ─── Decoration ─────────────────────────────────────────────────────────────────

const usageOf = (db, t) => {
  const runs = (db.stickerRuns || []).filter((d) => String(d.templateId) === String(t.id)).length;
  return { packingLists: 0, invoices: 0, stickerRuns: runs, total: runs };
};

const collectBindings = (t) => {
  const out = [];
  (t.stickerLayout?.faces || []).forEach((face) => {
    (face.lines || []).forEach((l) => { if (l.binding && !l.binding.startsWith('fixed:')) out.push(l.binding); });
    if (face.barcode?.binding) out.push(face.barcode.binding);
  });
  return [...new Set(out)];
};

const decorate = (t, db) => {
  const out = clone(t);
  const siblings = stickers(db).filter((x) => x.templateCode === t.templateCode);
  out.source = TEMPLATE_SOURCE.MOCK;
  out.buyerName = t.buyerCode ? getBuyerCommercial({ buyerCode: t.buyerCode }).buyerName || t.buyerCode : null;
  out.versions = siblings
    .map((x) => ({ id: x.id, version: x.version, status: x.status, publishedAt: x.publishedAt }))
    .sort((a, b) => b.version - a.version);
  out.latestVersion = Math.max(...siblings.map((x) => x.version || 0));
  out.hasNewerVersion = out.latestVersion > (t.version || 0);
  out.hasDraft = siblings.some((x) => x.status === TEMPLATE_STATUS.DRAFT);
  out.usage = usageOf(db, t);
  out.unknownBindings = collectBindings(t).filter((b) => !isBindable(b));
  out.editable = t.status === TEMPLATE_STATUS.DRAFT;
  out.canPublish = t.status === TEMPLATE_STATUS.DRAFT;
  out.canRetire = t.status === TEMPLATE_STATUS.ACTIVE && out.usage.total === 0;
  out.canDelete = t.status === TEMPLATE_STATUS.DRAFT && out.usage.total === 0;
  return out;
};

const audit = (db, t, action, extra = {}) => pushAudit(db, {
  entityType: 'DOC_TEMPLATE', entityId: t.id, entityNo: t.templateCode, action, ...extra,
});

// ─── Reads ──────────────────────────────────────────────────────────────────────

export const listStickerTemplates = async () => {
  await delay(60);
  const db = loadDb();
  return stickers(db).map((t) => decorate(t, db));
};

export const getStickerTemplate = async (id) => {
  await delay(60);
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  return decorate(t, db);
};

/** Sticker templates still name buyers by the mock's commercial-profile code. */
export const listStickerBuyers = () => (loadDb().masters?.buyerCommercial || []).map((b) => ({
  value: b.buyerCode,
  label: b.buyerName,
}));

// ─── Writes ─────────────────────────────────────────────────────────────────────

const stamp = () => ({
  createdAt: nowStamp(), createdBy: currentUserName(), updatedAt: nowStamp(), updatedBy: currentUserName(),
});

const assertFreeCode = (db, code) => {
  if (!code) fail('VALIDATION', 'Give the template a code.');
  if ((db.templates || []).some((t) => t.templateCode === code)) {
    fail('CONFLICT', `A template with the code ${code} already exists.`);
  }
};

/** A new sticker template from a layout (blank, cloned or imported), as a draft. */
export const createStickerTemplate = async (payload = {}) => {
  await delay();
  const db = loadDb();
  assertFreeCode(db, payload.templateCode);
  const row = {
    identity: { titleText: '', showLogo: true, paper: 'A4', orientation: 'PORTRAIT' },
    formatting: { font: 'Arial' },
    printWeights: true,
    printDimensions: true,
    mandatoryForSubmit: [],
    mandatoryForDocGen: [],
    ...clone(payload.layout || {}),
    stickerLayout: clone(payload.stickerLayout) || { layoutId: payload.templateCode, paperDefault: 'A4_1UP', faces: [] },
    id: nextId(db),
    templateCode: payload.templateCode,
    name: payload.name || payload.templateCode,
    buyerId: null,
    buyerCode: payload.buyerCode || null,
    docType: DOC_TYPE.STICKER,
    version: 1,
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    clonedFromId: payload.clonedFromId ?? null,
    publishedAt: null,
    publishedBy: null,
    ...stamp(),
  };
  db.templates.push(row);
  audit(db, row, payload.clonedFromId ? 'Template cloned' : 'Template created', { details: row.name });
  saveDb(db);
  return decorate(row, db);
};

/** A new DRAFT version of a published sticker template — the only way to change one. */
export const newStickerTemplateVersion = async (id) => {
  await delay();
  const db = loadDb();
  const source = find(db, id);
  if (!source) fail('NOT_FOUND', `Template ${id} not found`);
  const draft = stickers(db).find((t) => t.templateCode === source.templateCode && t.status === TEMPLATE_STATUS.DRAFT);
  if (draft) fail('CONFLICT', `${source.templateCode} already has an unpublished draft (v${draft.version}).`);

  const row = {
    ...clone(source),
    id: nextId(db),
    version: nextVersion(db, source.templateCode),
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
    clonedFromId: source.id,
    ...stamp(),
  };
  db.templates.push(row);
  audit(db, row, `Draft v${row.version} started`, { details: `From v${source.version}` });
  saveDb(db);
  return decorate(row, db);
};

const EDITABLE_FIELDS = [
  'name', 'buyerCode', 'identity', 'stickerLayout', 'formatting',
  'printWeights', 'printDimensions', 'mandatoryForSubmit', 'mandatoryForDocGen',
];

export const updateStickerTemplate = async (id, payload = {}) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.DRAFT) {
    fail('CONFLICT', `v${t.version} is ${t.status.toLowerCase()} and cannot be edited. Start a new version instead.`);
  }
  if (payload.lockVersion !== undefined && payload.lockVersion !== t.lockVersion) failConflict('Template', t.templateCode);

  EDITABLE_FIELDS.forEach((k) => { if (payload[k] !== undefined) t[k] = clone(payload[k]); });
  t.lockVersion = (t.lockVersion || 0) + 1;
  t.updatedAt = nowStamp();
  t.updatedBy = currentUserName();
  saveDb(db);
  return decorate(t, db);
};

/**
 * Publishing retires the previous active version of the same template code — never
 * another layout of the same buyer, which stays available to pick per run.
 */
export const publishStickerTemplate = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft can be published.');

  const from = options.effectiveFrom || todayStr();
  const superseded = stickers(db).filter(
    (x) => x.id !== t.id && x.status === TEMPLATE_STATUS.ACTIVE && x.templateCode === t.templateCode,
  );
  superseded.forEach((x) => {
    x.status = TEMPLATE_STATUS.RETIRED;
    x.effectiveTo = from;
    x.updatedAt = nowStamp();
    x.updatedBy = currentUserName();
  });
  Object.assign(t, {
    status: TEMPLATE_STATUS.ACTIVE, effectiveFrom: from, effectiveTo: null,
    publishedAt: nowStamp(), publishedBy: currentUserName(), updatedAt: nowStamp(), updatedBy: currentUserName(),
  });
  audit(db, t, `Published v${t.version}`, {
    details: superseded.length
      ? `Retired ${superseded.map((x) => `v${x.version}`).join(', ')}`
      : `Active for ${t.buyerCode || 'every buyer'}`,
    reason: options.reason || null,
  });
  saveDb(db);
  return decorate(t, db);
};

export const retireStickerTemplate = async (id, reason) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.ACTIVE) fail('CONFLICT', 'Only an active template can be retired.');
  const usage = usageOf(db, t);
  if (usage.total) fail('CONFLICT', `${usage.total} sticker run(s) print from this version. Publish a replacement instead.`);
  Object.assign(t, { status: TEMPLATE_STATUS.RETIRED, effectiveTo: todayStr(), updatedAt: nowStamp(), updatedBy: currentUserName() });
  audit(db, t, `Retired v${t.version}`, { reason: reason || null });
  saveDb(db);
  return decorate(t, db);
};

export const deleteStickerTemplate = async (id) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft template can be deleted.');
  db.templates = db.templates.filter((x) => x.id !== t.id);
  audit(db, t, 'Draft template deleted');
  saveDb(db);
  return { id: t.id };
};

// ─── Live preview with sample data (§10.3) ──────────────────────────────────────

/**
 * A sample document for previewing ANY template — sticker, packing list or invoice,
 * saved or still being reviewed — built from the SEEDED packing data rather than
 * invented values, so what the admin sees is a real document in their layout.
 *
 * Returns the pieces; the caller renders them, because document HTML is built
 * client-side by `expDocHtml` and this service must not import it.
 */
export const getTemplateSample = async (template) => {
  await delay(80);
  const db = loadDb();
  const t = clone(template);
  const entries = db.packingEntries || [];
  const entry = entries.find((e) => e.buyerCode && e.buyerCode === t.buyerCode)
    || entries.find((e) => t.buyerName && e.buyerName === t.buyerName)
    || entries[0] || null;
  const shipment = entry
    ? (db.shipments || []).find((s) => s.id === entry.shipmentId) || null
    : (db.shipments || [])[0] || null;

  if (!entry) return { docType: t.docType, template: t, empty: true };

  const rows = (entry.groups || []).map((g) => ({
    ...clone(g), sourceEntryId: entry.id, sourceEntryNo: entry.packingNo,
  }));
  const main = rows.filter((r) => r.sectionKey !== 'EXTRA');
  const extra = rows.filter((r) => r.sectionKey === 'EXTRA');

  const samplePl = {
    id: 0,
    plNo: 'PKL/SAMPLE/0001',
    plDate: todayStr(),
    status: 'DRAFT',
    buyerCode: entry.buyerCode,
    buyerName: entry.buyerName,
    shipmentNo: shipment?.shipmentNo || null,
    shipmentId: shipment?.id ?? null,
    sizes: entry.sizes || [],
    orderNos: [entry.orderNo].filter(Boolean),
    orderBreakdown: clone(entry.orderBreakdown || []),
    sections: [
      { key: 'MAIN', title: 'Main cartons', order: 0, rows: main },
      ...(extra.length ? [{ key: 'EXTRA', title: 'Extra cartons', order: 1, rows: extra }] : []),
    ],
    finalSnapshot: null,
    // The template under edit, not the one the document would use — that is what
    // makes this a preview of THIS draft.
    template: t,
    templateId: t.id,
    templateVersion: t.version,
  };

  return {
    docType: t.docType,
    template: t,
    pl: samplePl,
    // Decorated, so the preview prints the consignee, notify party and orders.
    shipment: shipment ? decorateShipment(shipment, db) : null,
    entry: { garmentName: entry.garmentName, compositionText: entry.compositionText, orderNo: entry.orderNo },
    empty: false,
  };
};
