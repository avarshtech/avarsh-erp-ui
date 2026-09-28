import { useCallback, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { autosaveCostSheet, createCostSheet, updateCostSheet } from '../../../../services/costing/costingService';
import { toPayload } from '../model/payloadMapper';

/**
 * The one save path — Save Draft, Submit and autosave all go through it. Saves are queued, so an
 * autosave in flight and a click on Save never race each other with the same version; each
 * save sends the version the previous one returned (the server flushes before answering).
 */
export default function useSheetPersist({ form, sheet, dispatch, totals, meta, setMeta, todaysRate, labelsOf }) {
  const metaRef = useRef(meta);
  const inflight = useRef(null);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  return useCallback(async (status, { autosave = false } = {}) => {
    if (inflight.current) await inflight.current.catch(() => {});
    const run = (async () => {
      const current = metaRef.current;
      const values = form.getFieldsValue(true);
      const payload = toPayload({ values, sheet, totals, meta: current, todaysRate, labels: labelsOf(values), status });
      const saved = autosave
        ? await autosaveCostSheet(current.id, payload)
        : current.id ? await updateCostSheet(current.id, payload) : await createCostSheet(payload);
      const next = {
        ...current, id: saved.id, costingId: saved.costingId, version: saved.version,
        status: saved.status, date: saved.date ? dayjs(saved.date) : current.date,
      };
      metaRef.current = next;
      setMeta(next);
      dispatch({ type: 'MARK_SAVED', rev: sheet.rev });
      return saved;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }, [form, sheet, totals, todaysRate, labelsOf, setMeta, dispatch]);
}
