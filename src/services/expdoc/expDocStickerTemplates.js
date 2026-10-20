/**
 * The carton-sticker template a run prints with. Templates live in the API and sticker
 * runs in the mock, so expDocService resolves the template here and hands the mock its
 * layout — the mock never calls the API.
 */
import { listTemplateCandidates, loadTemplateSnapshot } from './expDocTemplateBridge';
import { DOC_TYPE } from '../../utils/expDocConstants';
import { stickerTemplateChoice, templateLabel } from '../../utils/expDocTemplateSchema';

/**
 * `request` is the packing list's buyer and the code its latest run printed with; the
 * choice itself is `stickerTemplateChoice`. A picked id that is no longer a candidate was
 * superseded, so its own snapshot names the family it stands for. The options are every
 * candidate, the standard one marked so the screen does not count it as the buyer's.
 */
export const resolveStickerTemplate = async ({ buyerName, latestTemplateCode }, templateId) => {
  const ranked = await listTemplateCandidates({ buyerName, docType: DOC_TYPE.STICKER });
  const stale = templateId != null && !ranked.candidates.some((c) => String(c.id) === String(templateId));
  const pickedCode = stale ? (await loadTemplateSnapshot(templateId))?.templateCode : null;
  return {
    layout: await loadTemplateSnapshot(stickerTemplateChoice(ranked, { templateId, pickedCode, latestTemplateCode })),
    layoutOptions: ranked.candidates.map((c) => ({ value: c.id, label: templateLabel(c), isSystem: Boolean(c.isSystem) })),
  };
};
