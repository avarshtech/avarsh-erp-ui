import { useCallback, useEffect, useRef, useState } from 'react';
import { aiErrorMessage, createAiDraft } from '../../../../services/costing/costingAiService';
import { useSheet } from '../CostingSheetContext';

/**
 * Sends a recording, files or text to the AI with the sheet's buyer and style as context, and
 * keeps the request cancellable. `read` resolves to the draft, or null when it failed (the
 * reason is in `error`) or was cancelled.
 */
export default function useAiCapture() {
  const { form } = useSheet();
  const [state, setState] = useState({ busy: false, error: null });
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  const read = useCallback(async ({ files = [], text }) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState({ busy: true, error: null });
    try {
      const draft = await createAiDraft({
        files, text, buyerId: form.getFieldValue('buyerId'), styleId: form.getFieldValue('styleNo'), signal: ctrl.signal,
      });
      setState({ busy: false, error: null });
      return draft;
    } catch (err) {
      setState({ busy: false, error: ctrl.signal.aborted ? null : aiErrorMessage(err) });
      return null;
    } finally {
      if (controller.current === ctrl) controller.current = null;
    }
  }, [form]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, read, cancel, clearError };
}
