/**
 * API <-> screen shape for buyer document templates.
 *
 * The API keeps the layout in one `layout` object; every screen, renderer and
 * validator reads it flat off the template (`tpl.columns`, `tpl.identity` …), so it is
 * flattened here and nowhere else.
 *
 * Versions: the API's `revision` is the template version the screens print as "v2"
 * and keep calling `version`; the API's own `version` is only the optimistic lock and
 * travels as `lockVersion`. The mock used one field for both, which is how a template
 * save could fail with a false conflict.
 */
import { TEMPLATE_SOURCE, pickLayout } from '../../utils/expDocSystemTemplates';

export const fromApi = (dto) => {
  if (!dto) return dto;
  // The API still stores a sub-client code; the business has no such concept, so no
  // screen is handed one (the column goes in the API phase).
  const { layout, revision, version, revisions, subClientCode: _subClient, ...rest } = dto;
  return {
    ...(layout || {}),
    ...rest,
    source: TEMPLATE_SOURCE.API,
    version: revision,
    lockVersion: version,
    buyerCode: null,
    versions: (revisions || []).map((r) => ({
      id: r.id, version: r.revision, status: r.status, publishedAt: r.publishedAt,
    })),
    latestVersion: dto.latestRevision ?? revision,
    hasNewerVersion: (dto.latestRevision ?? revision) > revision,
    isSystem: false,
  };
};

/** Summaries carry no layout; they still get the same field names. */
export const summaryFromApi = (dto) => fromApi({ ...dto, layout: {} });

export const toApi = (template) => ({
  templateCode: template.templateCode,
  name: (template.name || '').trim(),
  docType: template.docType,
  buyerId: template.buyerId ?? null,
  layout: pickLayout(template),
  extractionMeta: template.extractionMeta ?? undefined,
  version: template.lockVersion ?? undefined,
});
