import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildStickerSheetHtml, stickerCounts } from '../../../../utils/expDocStickerHtml';
import { PL_STATUS } from '../../../../utils/expDocConstants';
import { previewCartons } from '../../../../services/expdoc/expDocService';
import { pageGeometry, renderContext } from './stickerWorkspaceModel';

/** A sticker prints clean only from a packing list that is actually final. */
const FINAL_PL_STATUSES = [PL_STATUS.FINAL, PL_STATUS.EXPORTED];

/**
 * The preview: ONE page of cartons at a time behind a pager, so a shipment of any size
 * previews at once — only the visible page's cartons are ever materialised. Also the
 * label counts and the render context the print shares with it.
 */
const useStickerPreview = (plId, { ctx, scope, settings, exporter, ask }) => {
  const { paper, faceKeys, printBarcodes } = settings;
  const layout = ctx?.layout;
  const spec = useMemo(
    () => (layout ? stickerCounts(ctx.selectedCount, layout.stickerLayout, paper, faceKeys) : null),
    [ctx, layout, paper, faceKeys],
  );
  const geometry = pageGeometry(paper, spec?.faces, ctx?.selectedCount);

  // Back to the first page whenever what is paged changes — also on a round trip back to
  // an earlier layout or paper; a page past the end clamps.
  const paged = JSON.stringify([layout?.id, paper, faceKeys, scope]);
  const [at, setAt] = useState({ paged, index: 0 });
  if (at.paged !== paged) setAt({ paged, index: 0 });
  const pageIndex = Math.min(at.paged === paged ? at.index : 0, geometry.pageCount - 1);
  const setPage = useCallback((index) => setAt({ paged, index }), [paged]);

  const [cartons, setCartons] = useState([]);
  useEffect(() => {
    if (!layout) return undefined;
    let latest = true;
    previewCartons(plId, { scope, page: pageIndex, pageSize: geometry.cartonsPerPage })
      .then((r) => { if (latest) setCartons(r.cartons); })
      .catch(() => { if (latest) setCartons([]); });
    return () => { latest = false; };
  }, [plId, scope, pageIndex, geometry.cartonsPerPage, layout]);

  const renderCtx = useMemo(() => renderContext(ctx, exporter, ask), [ctx, exporter, ask]);
  // §16: a sticker inherits the packing list's state; anything short of final is watermarked.
  const draft = !FINAL_PL_STATUSES.includes(ctx?.pl?.status);
  const html = useMemo(() => (layout && cartons.length
    ? buildStickerSheetHtml(cartons, {
      layout: layout.stickerLayout, paper, faceKeys, printBarcodes, draft, ctx: renderCtx,
    })
    : ''), [layout, cartons, paper, faceKeys, printBarcodes, draft, renderCtx]);

  return {
    spec, ...geometry, pageIndex, setPage, cartons, html, renderCtx,
  };
};

export default useStickerPreview;
