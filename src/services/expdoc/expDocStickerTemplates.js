/**
 * The carton-sticker template a run prints with. Templates live in the API and sticker
 * runs in the mock, so expDocService resolves the template here and hands the mock its
 * layout — the mock never calls the API.
 */
import { listTemplateCandidates, loadTemplateSnapshot } from './expDocTemplateBridge';
import { DOC_TYPE, TEMPLATE_STATUS } from '../../utils/expDocConstants';
import { templateLabel } from '../../utils/expDocTemplateSchema';

/**
 * `request` is the packing list's buyer and the code its latest run printed with. The
 * layout is the template asked for while it is a candidate, else the current version of
 * the family last printed, else the only candidate (the standard one for a buyer with
 * none); null while the user still has to pick. The options are every candidate.
 */
export const resolveStickerTemplate = async ({ buyerName, latestTemplateCode }, templateId) => {
  const { candidates, autoSelectId } = await listTemplateCandidates({ buyerName, docType: DOC_TYPE.STICKER });
  const asked = templateId == null ? null : candidates.find((c) => String(c.id) === String(templateId));
  const previous = latestTemplateCode
    ? candidates.find((c) => c.status === TEMPLATE_STATUS.ACTIVE && c.templateCode === latestTemplateCode)
    : null;
  return {
    layout: await loadTemplateSnapshot(asked?.id ?? previous?.id ?? autoSelectId),
    layoutOptions: candidates.map((c) => ({ value: c.id, label: templateLabel(c) })),
  };
};
