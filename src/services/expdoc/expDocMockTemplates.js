/**
 * Buyer document templates — mock service (PRD §10).
 *
 * A template row is IMMUTABLE ONCE PUBLISHED. A new version is a new row sharing the
 * template code, so a document that stored `templateId` keeps rendering exactly the
 * layout it was approved against, however many times the buyer's format later
 * changes (§10 opening paragraph, BR-08).
 *
 * The one invariant worth stating out loud: exactly one ACTIVE template per
 * (buyer, sub-client, document type). Publishing is the only act that can break it,
 * so publishing is also what repairs it — the previous active is retired in the same
 * operation rather than left for someone to notice.
 */
import { loadDb, saveDb } from './expDocMockStore';
import {
  delay, clone, fail, failConflict, pageOf, matchesText, pushAudit, nowStamp,
  todayStr, currentUserName,
} from './expDocMockCommon';
import { TEMPLATE_STATUS, DOC_TYPE } from '../../utils/expDocConstants';
import {
  resolveTemplate, findActiveConflicts, isBindable, templateLabel,
} from '../../utils/expDocTemplateSchema';

const find = (db, id) => (db.templates || []).find((t) => t.id === Number(id));

/** The tuple the "one active" invariant is keyed on. */
const keyOf = (t) => `${t.buyerCode || '*'}|${t.subClientCode || '*'}|${t.docType}`;

const nextId = (db) => Math.max(0, ...(db.templates || []).map((t) => t.id)) + 1;

const nextVersion = (db, templateCode) => Math.max(
  0,
  ...(db.templates || []).filter((t) => t.templateCode === templateCode).map((t) => t.version || 0),
) + 1;

// ─── Decoration ─────────────────────────────────────────────────────────────────

/** How many live documents render from this exact row — what makes it undeletable. */
const usageOf = (db, t) => {
  const pls = (db.packingLists || []).filter((d) => d.templateId === t.id).length;
  const invoices = (db.invoices || []).filter((d) => d.templateId === t.id).length;
  const stickers = (db.stickerRuns || []).filter((d) => d.templateId === t.id).length;
  return { packingLists: pls, invoices, stickerRuns: stickers, total: pls + invoices + stickers };
};

const decorate = (t, db) => {
  const out = clone(t);
  const siblings = (db.templates || []).filter((x) => x.templateCode === t.templateCode);
  out.versions = siblings
    .map((x) => ({ id: x.id, version: x.version, status: x.status, publishedAt: x.publishedAt }))
    .sort((a, b) => b.version - a.version);
  out.latestVersion = Math.max(...siblings.map((x) => x.version || 0));
  out.hasNewerVersion = out.latestVersion > (t.version || 0);
  out.usage = usageOf(db, t);
  out.label = templateLabel(t);

  // Bindings an admin cannot have chosen from the catalogue (§10.3). Reported rather
  // than rejected: a `fixed:` literal is legitimate, and so is a path the catalogue
  // has not caught up with — but the admin should see which is which.
  out.unknownBindings = collectBindings(t).filter((b) => !isBindable(b));

  out.editable = t.status === TEMPLATE_STATUS.DRAFT;
  out.canPublish = t.status === TEMPLATE_STATUS.DRAFT;
  out.canRetire = t.status === TEMPLATE_STATUS.ACTIVE && out.usage.total === 0;
  out.canDelete = t.status === TEMPLATE_STATUS.DRAFT && out.usage.total === 0;
  return out;
};

/** Every binding a template references, wherever it lives in the shape. */
export const collectBindings = (t) => {
  const out = [];
  const push = (b) => { if (b && typeof b === 'string' && !b.startsWith('fixed:')) out.push(b); };
  (t.headerFields || []).forEach((f) => push(f.binding));
  (t.addressBlocks || []).forEach((f) => push(f.binding));
  (t.columns || []).forEach((c) => push(c.binding));
  (t.stickerLayout?.faces || []).forEach((face) => {
    (face.lines || []).forEach((l) => push(l.binding));
    push(face.barcode?.binding);
  });
  return [...new Set(out)];
};

// ─── Reads ──────────────────────────────────────────────────────────────────────

export const searchTemplates = async (params = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.templates || [])
    .filter((t) => (!params.docType || t.docType === params.docType))
    .filter((t) => (!params.status || t.status === params.status))
    .filter((t) => (!params.buyerCode || t.buyerCode === params.buyerCode))
    .filter((t) => matchesText(t.templateCode, params.search)
      || matchesText(t.name, params.search)
      || matchesText(t.buyerCode, params.search)
      || matchesText(t.subClientCode, params.search))
    .map((t) => decorate(t, db))
    .sort((a, b) => (a.docType.localeCompare(b.docType))
      || String(a.buyerCode || '').localeCompare(String(b.buyerCode || ''))
      || (b.version - a.version));
  return pageOf(rows, params);
};

export const getTemplate = async (id) => {
  await delay(80);
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  return decorate(t, db);
};

/**
 * The "exactly one active" invariant, surfaced rather than discovered at render
 * time — and its opposite: a buyer with no template at all, which silently falls
 * back to the generic set (§15).
 */
export const getTemplateHealth = async () => {
  await delay(80);
  const db = loadDb();
  const conflicts = findActiveConflicts(db.templates || []).map((c) => ({
    key: c.key,
    templates: c.templates.map((t) => ({ id: t.id, templateCode: t.templateCode, version: t.version })),
  }));

  // Every buyer that has any template, checked for the full set of three.
  const buyers = [...new Set((db.masters?.buyerCommercial || []).map((b) => b.buyerCode))];
  const gaps = [];
  buyers.forEach((buyerCode) => {
    Object.values(DOC_TYPE).forEach((docType) => {
      const { template, isFallback } = resolveTemplate(db.templates || [], { buyerCode, docType, onDate: todayStr() });
      if (!template || isFallback) gaps.push({ buyerCode, docType, usingGeneric: Boolean(template) });
    });
  });
  return { conflicts, gaps };
};

export const listTemplateBuyers = async () => {
  await delay(60);
  const db = loadDb();
  return (db.masters?.buyerCommercial || []).map((b) => ({
    value: b.buyerCode,
    label: b.buyerName,
    subClients: (b.subClients || []).map((s) => ({ value: s.code, label: s.name })),
  }));
};

// ─── Writes ─────────────────────────────────────────────────────────────────────

const BLANK = {
  headerFields: [], addressBlocks: [], columns: [], sheets: [],
  invoiceLineGrain: null, charges: null, igst: null, bankBlock: true, ediAccounts: false,
  declarations: [], annexeSheets: [], stickerLayout: null,
  formatting: { font: 'Arial', baseFontPt: 9, dateFormat: 'DD-MMM-YYYY' },
  printWeights: true, printDimensions: true,
  mandatoryForSubmit: [], mandatoryForDocGen: [],
  identity: { titleText: '', showLogo: true, paper: 'A4', orientation: 'PORTRAIT' },
};

/**
 * Clone-and-edit — a first-class action, not a convenience (§10.2). Adding a buyer
 * is meant to be "copy the nearest set and change the deltas", so the clone keeps
 * every block and only the identity changes.
 */
export const cloneTemplate = async (sourceId, payload = {}) => {
  await delay();
  const db = loadDb();
  const source = find(db, sourceId);
  if (!source) fail('NOT_FOUND', `Template ${sourceId} not found`);
  if (!payload.templateCode) fail('VALIDATION', 'Give the new template a code.');
  if ((db.templates || []).some((t) => t.templateCode === payload.templateCode)) {
    fail('CONFLICT', `A template with the code ${payload.templateCode} already exists.`);
  }

  const id = nextId(db);
  const row = {
    ...clone(source),
    id,
    templateCode: payload.templateCode,
    name: payload.name || `${source.name} (copy)`,
    buyerCode: payload.buyerCode ?? source.buyerCode,
    subClientCode: payload.subClientCode ?? null,
    docType: payload.docType || source.docType,
    version: 1,
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    clonedFromId: source.id,
    publishedAt: null,
    publishedBy: null,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };
  db.templates.push(row);
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE',
    entityId: id,
    entityNo: row.templateCode,
    action: 'Template cloned',
    details: `From ${source.templateCode} v${source.version}`,
  });
  saveDb(db);
  return decorate(row, db);
};

export const createTemplate = async (payload = {}) => {
  await delay();
  const db = loadDb();
  if (!payload.templateCode) fail('VALIDATION', 'Give the template a code.');
  if (!payload.docType) fail('VALIDATION', 'Choose a document type.');
  if ((db.templates || []).some((t) => t.templateCode === payload.templateCode)) {
    fail('CONFLICT', `A template with the code ${payload.templateCode} already exists.`);
  }
  const id = nextId(db);
  const row = {
    ...clone(BLANK),
    id,
    templateCode: payload.templateCode,
    name: payload.name || payload.templateCode,
    buyerId: null,
    buyerCode: payload.buyerCode || null,
    subClientCode: payload.subClientCode || null,
    docType: payload.docType,
    version: 1,
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    clonedFromId: null,
    publishedAt: null,
    publishedBy: null,
    series: null,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };
  db.templates.push(row);
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: id, entityNo: row.templateCode,
    action: 'Template created', details: row.name,
  });
  saveDb(db);
  return decorate(row, db);
};

/** A new DRAFT version of a published template — the only way to change one. */
export const newTemplateVersion = async (id) => {
  await delay();
  const db = loadDb();
  const source = find(db, id);
  if (!source) fail('NOT_FOUND', `Template ${id} not found`);
  const existingDraft = (db.templates || []).find(
    (t) => t.templateCode === source.templateCode && t.status === TEMPLATE_STATUS.DRAFT,
  );
  if (existingDraft) {
    fail('CONFLICT', `${source.templateCode} already has an unpublished draft (v${existingDraft.version}).`);
  }

  const newId = nextId(db);
  const row = {
    ...clone(source),
    id: newId,
    version: nextVersion(db, source.templateCode),
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
    clonedFromId: source.id,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };
  db.templates.push(row);
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: newId, entityNo: row.templateCode,
    action: `Draft v${row.version} started`, details: `From v${source.version}`,
  });
  saveDb(db);
  return decorate(row, db);
};

const EDITABLE_FIELDS = [
  'name', 'buyerCode', 'subClientCode', 'identity', 'headerFields', 'addressBlocks',
  'columns', 'sheets', 'invoiceLineGrain', 'charges', 'igst', 'bankBlock',
  'ediAccounts', 'declarations', 'annexeSheets', 'stickerLayout', 'formatting',
  'printWeights', 'printDimensions', 'mandatoryForSubmit', 'mandatoryForDocGen',
  'effectiveFrom', 'effectiveTo', 'series',
];

export const updateTemplate = async (id, payload = {}) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  // Published rows are frozen: a document that stored this id must keep rendering
  // the layout it was approved against.
  if (t.status !== TEMPLATE_STATUS.DRAFT) {
    fail('CONFLICT', `v${t.version} is ${t.status.toLowerCase()} and cannot be edited. Start a new version instead.`);
  }
  if (payload.version !== undefined && payload.version !== t.version) failConflict('Template', t.templateCode);

  EDITABLE_FIELDS.forEach((k) => { if (payload[k] !== undefined) t[k] = clone(payload[k]); });
  t.updatedAt = nowStamp();
  t.updatedBy = currentUserName();
  saveDb(db);
  return decorate(t, db);
};

/**
 * Publish a draft (§10.2).
 *
 * Activating retires the previous active for the same buyer / sub-client / doc type
 * in the SAME operation — the invariant is maintained by the act that would
 * otherwise break it, not by a later clean-up.
 */
export const publishTemplate = async (id, options = {}) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft can be published.');
  if (!t.docType) fail('VALIDATION', 'The template has no document type.');

  const from = options.effectiveFrom || todayStr();
  const superseded = (db.templates || []).filter(
    (x) => x.id !== t.id && x.status === TEMPLATE_STATUS.ACTIVE && keyOf(x) === keyOf(t),
  );
  superseded.forEach((x) => {
    x.status = TEMPLATE_STATUS.RETIRED;
    x.effectiveTo = from;
    x.updatedAt = nowStamp();
    x.updatedBy = currentUserName();
  });

  t.status = TEMPLATE_STATUS.ACTIVE;
  t.effectiveFrom = from;
  t.effectiveTo = null;
  t.publishedAt = nowStamp();
  t.publishedBy = currentUserName();
  t.updatedAt = nowStamp();
  t.updatedBy = currentUserName();

  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: t.id, entityNo: t.templateCode,
    action: `Published v${t.version}`,
    details: superseded.length
      ? `Retired ${superseded.map((x) => `v${x.version}`).join(', ')} for ${keyOf(t)}`
      : `Active for ${keyOf(t)}`,
    reason: options.reason || null,
  });
  saveDb(db);
  return decorate(t, db);
};

export const retireTemplate = async (id, reason) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.ACTIVE) fail('CONFLICT', 'Only an active template can be retired.');
  const usage = usageOf(db, t);
  if (usage.total) {
    fail('CONFLICT', `${usage.total} document(s) render from this version. Publish a replacement instead of retiring it.`);
  }
  t.status = TEMPLATE_STATUS.RETIRED;
  t.effectiveTo = todayStr();
  t.updatedAt = nowStamp();
  t.updatedBy = currentUserName();
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: t.id, entityNo: t.templateCode,
    action: `Retired v${t.version}`, reason: reason || null,
  });
  saveDb(db);
  return decorate(t, db);
};

export const deleteTemplate = async (id) => {
  await delay();
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  if (t.status !== TEMPLATE_STATUS.DRAFT) fail('CONFLICT', 'Only a draft template can be deleted.');
  const usage = usageOf(db, t);
  if (usage.total) fail('CONFLICT', `${usage.total} document(s) reference this template.`);
  db.templates = db.templates.filter((x) => x.id !== t.id);
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: t.id, entityNo: t.templateCode,
    action: 'Draft template deleted',
  });
  saveDb(db);
  return { id: t.id };
};

// ─── Export / import (§10.3) ────────────────────────────────────────────────────

/** Identity that belongs to THIS tenant's row, not to the layout being moved. */
const TRANSIENT = [
  'id', 'buyerId', 'status', 'version', 'effectiveFrom', 'effectiveTo', 'publishedAt',
  'publishedBy', 'clonedFromId', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
];

export const exportTemplateJson = async (id) => {
  await delay(60);
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);
  const payload = clone(t);
  TRANSIENT.forEach((k) => delete payload[k]);
  return {
    // Stamped so an import can refuse a shape it does not understand rather than
    // silently dropping half a layout.
    _format: 'avarsh.expdoc.template',
    _formatVersion: 1,
    _exportedFrom: { templateCode: t.templateCode, version: t.version, status: t.status },
    template: payload,
  };
};

export const importTemplateJson = async (json, options = {}) => {
  await delay();
  const db = loadDb();
  let parsed = json;
  if (typeof json === 'string') {
    try { parsed = JSON.parse(json); } catch { fail('VALIDATION', 'That is not valid JSON.'); }
  }
  if (parsed?._format !== 'avarsh.expdoc.template') {
    fail('VALIDATION', 'This file is not an Avarsh document template export.');
  }
  if (Number(parsed._formatVersion) !== 1) {
    fail('VALIDATION', `Unsupported template format version ${parsed._formatVersion}.`);
  }
  const body = parsed.template || {};
  if (!body.docType) fail('VALIDATION', 'The imported template has no document type.');

  const templateCode = options.templateCode || body.templateCode;
  if (!templateCode) fail('VALIDATION', 'The imported template has no code.');
  if ((db.templates || []).some((t) => t.templateCode === templateCode)) {
    fail('CONFLICT', `A template with the code ${templateCode} already exists. Give the import a different code.`);
  }

  const id = nextId(db);
  const row = {
    ...clone(BLANK),
    ...clone(body),
    id,
    templateCode,
    buyerId: null,
    buyerCode: options.buyerCode ?? body.buyerCode ?? null,
    subClientCode: options.subClientCode ?? body.subClientCode ?? null,
    // An import always lands as a draft: a layout from another tenant has not been
    // reviewed here, and publishing it would silently retire a live template.
    version: 1,
    status: TEMPLATE_STATUS.DRAFT,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
    clonedFromId: null,
    createdAt: nowStamp(),
    createdBy: currentUserName(),
    updatedAt: nowStamp(),
    updatedBy: currentUserName(),
  };
  db.templates.push(row);
  pushAudit(db, {
    entityType: 'DOC_TEMPLATE', entityId: id, entityNo: templateCode,
    action: 'Template imported',
    details: parsed._exportedFrom
      ? `From ${parsed._exportedFrom.templateCode} v${parsed._exportedFrom.version}`
      : null,
  });
  saveDb(db);
  return decorate(row, db);
};

// ─── Version compare (§10.3) ────────────────────────────────────────────────────

const COMPARABLE = EDITABLE_FIELDS.filter((k) => !['effectiveFrom', 'effectiveTo'].includes(k));

const flatten = (value, prefix, out) => {
  if (value === null || value === undefined) { out[prefix] = null; return; }
  if (Array.isArray(value)) {
    out[`${prefix}.length`] = value.length;
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).sort().forEach((k) => flatten(value[k], `${prefix}.${k}`, out));
    return;
  }
  out[prefix] = value;
};

/**
 * Side-by-side compare of ANY two versions, not just consecutive ones (§10.3).
 *
 * Flattened to leaf paths so the answer is "these seven values differ", which an
 * admin can act on, rather than "these two objects are not equal".
 */
export const compareTemplates = async (idA, idB) => {
  await delay(80);
  const db = loadDb();
  const a = find(db, idA);
  const b = find(db, idB);
  if (!a || !b) fail('NOT_FOUND', 'One of the templates was not found.');

  const flatA = {};
  const flatB = {};
  COMPARABLE.forEach((k) => { flatten(a[k], k, flatA); flatten(b[k], k, flatB); });

  const paths = [...new Set([...Object.keys(flatA), ...Object.keys(flatB)])].sort();
  const changes = paths
    .filter((p) => JSON.stringify(flatA[p]) !== JSON.stringify(flatB[p]))
    .map((p) => ({
      path: p,
      from: flatA[p] === undefined ? null : flatA[p],
      to: flatB[p] === undefined ? null : flatB[p],
      kind: flatA[p] === undefined ? 'ADDED' : (flatB[p] === undefined ? 'REMOVED' : 'CHANGED'),
    }));

  return {
    a: { id: a.id, templateCode: a.templateCode, version: a.version, status: a.status },
    b: { id: b.id, templateCode: b.templateCode, version: b.version, status: b.status },
    changes,
    identical: changes.length === 0,
  };
};

// ─── Live preview with sample data (§10.3) ──────────────────────────────────────

/**
 * A sample document for previewing a template while it is being configured.
 *
 * Built from the SEEDED packing data rather than from invented values, so what the
 * admin sees is a real document in their layout — the whole point of a live preview
 * is that it tells you whether the layout works on actual data.
 *
 * Returns the pieces; the caller renders them, because document HTML is built
 * client-side by `expDocHtml` and this service must not import it.
 */
export const getTemplateSample = async (id) => {
  await delay(80);
  const db = loadDb();
  const t = find(db, id);
  if (!t) fail('NOT_FOUND', `Template ${id} not found`);

  // Prefer a packing entry for this buyer; any entry beats none.
  const entries = db.packingEntries || [];
  const entry = entries.find((e) => e.buyerCode === t.buyerCode) || entries[0] || null;
  const shipment = entry
    ? (db.shipments || []).find((s) => s.id === entry.shipmentId) || null
    : (db.shipments || [])[0] || null;

  if (!entry) return { docType: t.docType, template: clone(t), empty: true };

  const rows = (entry.groups || []).map((g) => ({
    ...clone(g), sourceEntryId: entry.id, sourceEntryNo: entry.packingNo,
  }));

  const samplePl = {
    id: 0,
    plNo: 'PKL/SAMPLE/0001',
    plDate: todayStr(),
    status: 'DRAFT',
    buyerCode: entry.buyerCode,
    buyerName: entry.buyerName,
    subClientCode: entry.subClientCode,
    shipmentNo: shipment?.shipmentNo || null,
    shipmentId: shipment?.id ?? null,
    sizes: entry.sizes || [],
    orderNos: [entry.orderNo].filter(Boolean),
    orderBreakdown: clone(entry.orderBreakdown || []),
    sections: [{ key: 'MAIN', title: 'Main cartons', order: 0, rows }],
    approvalSnapshot: null,
    // The template under edit, not the one the document would resolve to — that is
    // what makes this a preview of THIS draft.
    template: clone(t),
    templateId: t.id,
    templateVersion: t.version,
  };

  return {
    docType: t.docType,
    template: clone(t),
    pl: samplePl,
    shipment: shipment ? clone(shipment) : null,
    entry: { garmentName: entry.garmentName, compositionText: entry.compositionText, orderNo: entry.orderNo },
    empty: false,
  };
};

/**
 * The template a document of this kind WOULD resolve to, without creating one.
 *
 * Screens need this before a document exists — the packing entry narrows its pack
 * types by the buyer's packing-list template, and it has no document to ask.
 */
export const resolveTemplateFor = async ({ buyerCode, subClientCode, docType } = {}) => {
  await delay(60);
  const db = loadDb();
  const { template, matchedOn, isFallback } = resolveTemplate(db.templates || [], {
    buyerCode, subClientCode, docType, onDate: todayStr(),
  });
  return { template: template ? clone(template) : null, matchedOn, isFallback };
};
