import { useCallback, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import {
  autosaveCostSheet, createCostSheet, submitCostSheet, updateCostSheet, withdrawCostSheet,
} from '../../../../services/costing/costingService';
import { COSTING_STATUS } from '../../../../utils/costingConstants';
import { toPayload } from '../model/payloadMapper';

/** The withdraw command needs a reason; saving a submitted sheet as a draft here asks for none. */
const REVISE_REASON = 'Changed in the cost sheet editor after it was submitted';

/**
 * The one save path — Save Draft, Submit and autosave all go through it. Saves are queued, so an
 * autosave in flight and a click on Save never race each other with the same version; each
 * save sends the version the previous one returned (the server flushes before answering).
 *
 * An existing sheet changes status by its own commands, not by the save: Submit saves the edits
 * with the status the sheet has, then sends it for approval with the version the save answered;
 * Save Draft on a submitted sheet first takes it back to Draft (the withdraw), then saves the
 * edits. A new sheet is still created as Draft or Final.
 */
export default function useSheetPersist({ form, sheet, dispatch, totals, meta, setMeta, todaysRate, labelsOf }) {
  const metaRef = useRef(meta);
  const inflight = useRef(null);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  return useCallback(async (status, { autosave = false } = {}) => {
    if (inflight.current) await inflight.current.catch(() => {});
    const run = (async () => {
      const adopt = (base, saved) => {
        const next = {
          ...base, id: saved.id, costingId: saved.costingId, version: saved.version,
          status: saved.status, date: saved.date ? dayjs(saved.date) : base.date,
        };
        metaRef.current = next;
        setMeta(next);
        return next;
      };

      let current = metaRef.current;
      const existing = !!current.id && !autosave;
      const submitting = existing && status === COSTING_STATUS.FINAL && current.status !== COSTING_STATUS.FINAL;
      if (existing && status === COSTING_STATUS.DRAFT && current.status === COSTING_STATUS.FINAL) {
        current = adopt(current, await withdrawCostSheet(current.id, current.version, REVISE_REASON));
      }

      const values = form.getFieldsValue(true);
      const payload = toPayload({
        values, sheet, totals, meta: current, todaysRate, labels: labelsOf(values),
        status: submitting ? current.status : status,
      });
      const saved = autosave
        ? await autosaveCostSheet(current.id, payload)
        : current.id ? await updateCostSheet(current.id, payload) : await createCostSheet(payload);
      current = adopt(current, saved);
      dispatch({ type: 'MARK_SAVED', rev: sheet.rev });
      if (!submitting) return saved;

      const submitted = await submitCostSheet(saved.id, saved.version);
      adopt(current, submitted);
      return submitted;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }, [form, sheet, totals, todaysRate, labelsOf, setMeta, dispatch]);
}
