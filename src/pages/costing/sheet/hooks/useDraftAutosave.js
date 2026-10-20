import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { COSTING_STATUS } from '../../../../utils/costingConstants';

const DELAY_MS = 4000;

/**
 * Saves an existing Draft by itself a few seconds after the last change. Never a new sheet (that
 * would claim the style for a costing the user may abandon — it is kept in the browser instead)
 * and never a submitted or approved one, where a save would revert it to Draft. After a failure
 * it pauses rather than retrying; a version conflict raises the usual conflict dialog.
 */
export default function useDraftAutosave({ meta, dirty, rev, busy, persist, canSave }) {
  const [state, setState] = useState({ phase: 'idle', at: null });
  const enabled = !!meta.id && meta.status === COSTING_STATUS.DRAFT && dirty && !busy && state.phase !== 'paused';

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(async () => {
      if (!canSave()) return;
      setState({ phase: 'saving', at: null });
      try {
        await persist(COSTING_STATUS.DRAFT, { autosave: true });
        setState({ phase: 'saved', at: dayjs() });
      } catch {
        setState({ phase: 'paused', at: null });
      }
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, rev, persist, canSave]);

  return state;
}
