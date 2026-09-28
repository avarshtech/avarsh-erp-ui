import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractTemplate, templateAiErrorMessage, isAiNotConfigured, isNotATemplateDocument,
} from '../../../../services/expdoc/expDocService';

/** Why a reading gave nothing to review — each gets its own wording in the dialog. */
export const READ_FAILURE = {
  NOT_CONFIGURED: 'NOT_CONFIGURED', // no AI on this deployment
  REFUSED: 'REFUSED', // the file is not a packing list / invoice (or not the type chosen)
  FAILED: 'FAILED', // the AI or the network failed
};

const NOTHING_TO_REVIEW = 'No packing list or invoice could be read from this file.';

/**
 * Reading an uploaded buyer document with the AI: `{busy, failure, read, cancel,
 * clearError}`, where `failure` is `{kind, message}` or null. A new read aborts the
 * previous one, and leaving the screen aborts whatever is running — the costing
 * capture's pattern. A reading with no document is a refusal, never an empty review.
 */
const useTemplateExtraction = () => {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const ctrl = useRef(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const read = useCallback(async (file, options) => {
    ctrl.current?.abort();
    const controller = new AbortController();
    ctrl.current = controller;
    setBusy(true);
    setFailure(null);
    try {
      const result = await extractTemplate(file, { ...options, signal: controller.signal });
      if (!result?.documents?.length) {
        setFailure({ kind: READ_FAILURE.REFUSED, message: NOTHING_TO_REVIEW });
        return null;
      }
      return result;
    } catch (e) {
      if (controller.signal.aborted) return null;
      let kind = READ_FAILURE.FAILED;
      if (isAiNotConfigured(e)) kind = READ_FAILURE.NOT_CONFIGURED;
      else if (isNotATemplateDocument(e)) kind = READ_FAILURE.REFUSED;
      setFailure({ kind, message: templateAiErrorMessage(e) });
      return null;
    } finally {
      if (ctrl.current === controller) {
        ctrl.current = null;
        setBusy(false);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
    setBusy(false);
  }, []);

  const clearError = useCallback(() => setFailure(null), []);

  return { busy, failure, read, cancel, clearError };
};

export default useTemplateExtraction;
