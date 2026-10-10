import { useEffect, useState } from 'react';
import { checkStickerGeneration } from '../../../../services/expdoc/expDocService';

/**
 * The pre-flight for a generate: cartons blocked, cartons to reprint, and whether the
 * button may be pressed. It checks the layout on screen with the barcode choice and the
 * organisation the labels print, so it waits for the exporter, which resolves after the
 * page. Only the latest check lands, and `checking` holds until it has.
 */
const useStickerCheck = (plId, { scope, ctx, printBarcodes, exporter }) => {
  const [done, setDone] = useState({ check: null });

  useEffect(() => {
    if (!ctx || !exporter) return undefined;
    let latest = true;
    const land = (check) => { if (latest) setDone({ scope, ctx, printBarcodes, exporter, check }); };
    checkStickerGeneration(plId, { scope, templateId: ctx.layout?.id, printBarcodes, exporter })
      .then(land)
      // A check that cannot run blocks the button with its reason rather than failing the page.
      .catch((e) => land({ canGenerate: false, blockedReason: e.message || 'The print check could not run.' }));
    return () => { latest = false; };
  }, [plId, scope, ctx, printBarcodes, exporter]);

  const current = done.scope === scope && done.ctx === ctx
    && done.printBarcodes === printBarcodes && done.exporter === exporter;
  return { check: done.check, checking: !current };
};

export default useStickerCheck;
