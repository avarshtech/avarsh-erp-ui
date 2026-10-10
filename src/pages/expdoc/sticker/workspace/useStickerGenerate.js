import { useState } from 'react';
import { App } from 'antd';
import { MAX_LABELS_PER_JOB, num } from './stickerWorkspaceModel';
import { OVERRIDE_REASON, confirmLargeJob, reprintReason } from './generateDialogs';
import useStickerRun from './useStickerRun';

/**
 * Generate & print. A job too large for the browser is offered a first batch; then a draft
 * packing list asks for the override reason, cartons printed before for a reprint reason
 * (`reason`, which AckReasonModal shows), and anything else for a plain confirm.
 */
const useStickerGenerate = ({
  ctx, preview, check, printedOverlap, onBatch, ...run
}) => {
  const { modal } = App.useApp();
  const { busy, generate } = useStickerRun({ ...run, ctx, renderCtx: preview.renderCtx });
  const [reason, setReason] = useState(null);
  const { spec } = preview;

  const proceed = () => {
    if (check?.requiresOverride) {
      // From a draft one reason serves both: cartons printed before are still recorded as a reprint.
      const reprint = (text) => (printedOverlap.length ? { isReprint: true, reprintReason: text } : {});
      setReason({ ...OVERRIDE_REASON, extra: (text) => ({ overrideReason: text, ...reprint(text) }) });
    } else if (printedOverlap.length) {
      setReason({ ...reprintReason(printedOverlap), extra: (text) => ({ isReprint: true, reprintReason: text }) });
    } else {
      modal.confirm({
        title: 'Generate carton stickers?',
        content: `${num(spec?.labels)} label(s) across ${num(spec?.sheets)} sheet(s) for cartons ${ctx.selectedLabel}.`,
        okText: 'Generate & print',
        onOk: () => generate(),
      });
    }
  };

  const start = () => {
    if ((spec?.labels || 0) <= MAX_LABELS_PER_JOB) {
      proceed();
      return;
    }
    // "Use the first batch" switches to a range covering it, so the offer is one click.
    const batch = Math.max(1, Math.floor(MAX_LABELS_PER_JOB / Math.max(1, spec.faces)));
    const first = ctx.selectedRanges?.[0]?.from ?? 1;
    confirmLargeJob(modal, { spec, batch, onBatch: () => onBatch(first, first + batch - 1), onAnyway: proceed });
  };

  // The dialog closes as the run starts; the header button spins until it is printed.
  const submitReason = (text) => {
    const { extra } = reason;
    setReason(null);
    return generate(extra(text));
  };

  return {
    busy, start, reason, submitReason, cancelReason: () => setReason(null),
  };
};

export default useStickerGenerate;
