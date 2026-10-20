import { useState } from 'react';
import { App } from 'antd';
import { buildStickerSheetHtml } from '../../../../utils/expDocStickerHtml';
import { openPrintWindow, documentFileName } from '../../../../utils/printDoc';
import { generateStickerRun, previewCartons } from '../../../../services/expdoc/expDocService';
import { num } from './stickerWorkspaceModel';

/**
 * Records a run of the layout on screen and prints it. `busy` spins the Generate button
 * meanwhile; afterwards the workspace reloads, so the history shows the run.
 */
const useStickerRun = ({
  plId, ctx, scope, settings, exporter, askValues, renderCtx, reload,
}) => {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const { paper, faceKeys, printBarcodes } = settings;

  const generate = async (extra = {}) => {
    setBusy(true);
    try {
      // The layout on screen is the one recorded — not whatever the service would pick now.
      const run = await generateStickerRun(plId, {
        scope, paper, faceKeys, printBarcodes, askValues, exporter, templateId: ctx.layout.id, ...extra,
      });
      // The whole scope is built here, off the render path, and handed straight to the
      // print window as one document.
      const all = await previewCartons(plId, { scope, page: 0, pageSize: run.cartonCount });
      const html = buildStickerSheetHtml(all.cartons, {
        layout: ctx.layout.stickerLayout,
        paper,
        faceKeys,
        printBarcodes,
        draft: run.fromDraft,
        title: documentFileName({ docType: 'Stickers', buyer: ctx.pl.buyerName, docNo: run.runNo }),
        ctx: renderCtx,
      });
      if (!openPrintWindow(html)) {
        message.warning('Your browser blocked the print window. Allow pop-ups and use Reprint from the history.');
      }
      message.success(`${run.runNo} — ${num(run.labelCount)} label(s) for cartons ${ctx.selectedLabel}`);
      reload();
    } catch (e) {
      message.error(e.message || 'Could not generate stickers');
    } finally {
      setBusy(false);
    }
  };

  return { busy, generate };
};

export default useStickerRun;
