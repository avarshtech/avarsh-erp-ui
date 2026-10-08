/**
 * What documents need from templates, while packing lists and invoices are still
 * mock documents and their templates live in the API.
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

export const loadTemplateSnapshot = async (id) => (id ? snapshotOf(await getTemplate(id)) : null);

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
