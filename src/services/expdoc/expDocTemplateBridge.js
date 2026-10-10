/**
 * What documents need from templates, while packing lists, invoices and sticker runs
 * are still mock records and their templates live in the API.
 *
 * A document takes a SNAPSHOT of the layout it was made with (templates are frozen
 * once published, so the snapshot IS that revision). The mock document services never
 * call the API themselves: expDocService fetches the chosen template here and hands
 * the snapshot in.
 */
import { apiTemplateSummaries, getTemplate } from './expDocTemplateStore';
import { TEMPLATE_STATUS } from '../../utils/expDocConstants';
import { rankTemplateCandidates } from '../../utils/expDocTemplateSchema';
import { isSystemTemplateId, pickLayout } from '../../utils/expDocSystemTemplates';

/** The templates a new document of this buyer and type may use, and whether one is automatic. */
export const listTemplateCandidates = async (ctx) => rankTemplateCandidates(await apiTemplateSummaries(), ctx);

/** Identity plus layout: everything a document renders and validates from. */
export const snapshotOf = (t) => (t ? {
  id: t.id,
  templateCode: t.templateCode,
  name: t.name,
  version: t.version,
  docType: t.docType,
  status: t.status,
  buyerId: t.buyerId ?? null,
  buyerName: t.buyerName ?? null,
  isSystem: Boolean(t.isSystem),
  ...pickLayout(t),
} : null);

/**
 * Snapshots of published revisions and the standard layouts, by id. They never change,
 * so the sticker workspace does not refetch its layout on every scope or page change;
 * a draft is always read afresh. Small, and the oldest entry goes first.
 */
const SNAPSHOT_CACHE_SIZE = 20;
const snapshots = new Map();
const copy = (v) => JSON.parse(JSON.stringify(v));

export const loadTemplateSnapshot = async (id) => {
  if (!id) return null;
  const key = String(id);
  if (!snapshots.has(key)) {
    const snapshot = snapshotOf(await getTemplate(id));
    if (!snapshot?.isSystem && snapshot?.status !== TEMPLATE_STATUS.ACTIVE) return snapshot;
    snapshots.set(key, snapshot);
    if (snapshots.size > SNAPSHOT_CACHE_SIZE) snapshots.delete(snapshots.keys().next().value);
  }
  // A copy, so no caller can change what the next one is given.
  return copy(snapshots.get(key));
};

/**
 * The newer ACTIVE revision of the template a document uses, if one was published
 * after the document was made — what the "v2 is available" banner offers.
 */
export const findNewerTemplateRevision = async ({ templateId, templateCode, version } = {}) => {
  if (!templateCode || isSystemTemplateId(templateId)) return null;
  const rows = await apiTemplateSummaries();
  const active = rows.find((r) => r.templateCode === templateCode && r.status === TEMPLATE_STATUS.ACTIVE);
  return active && active.version > (version || 0) ? active : null;
};
