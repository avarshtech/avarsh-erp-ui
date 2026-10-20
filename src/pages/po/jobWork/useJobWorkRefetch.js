import { useCallback, useMemo } from 'react';
import { App } from 'antd';

/**
 * Re-fetch for a draft job-work PO whose requirement was edited in place — its POs are still
 * drafts, so it could be. `rebuild` is refetchCppLines or refetchGpoLines (utils/jobWorkRefetch).
 * Null unless `enabled` (a draft the user may edit), the requirement state is loaded and a
 * line changed; else { changes, rebuilt, dropped, onConfirm }. Dropped lines go through
 * LINES_REMOVED, which keeps the line-key high-water mark (overrides point at keys).
 */
const useJobWorkRefetch = ({ lines, ctx, dispatch, rebuild, enabled }) => {
  const { message } = App.useApp();
  const state = ctx?.state;
  const plan = useMemo(() => (enabled && state && lines ? rebuild(lines, state) : null), [enabled, state, lines, rebuild]);

  const onConfirm = useCallback(() => {
    if (plan.dropped.length) dispatch({ type: 'LINES_REMOVED', keys: plan.dropped });
    dispatch({ type: 'LINES_SET', lines: plan.lines });
    message.success(`${plan.rebuilt} line(s) re-fetched at the new balance${plan.dropped.length ? ` · ${plan.dropped.length} removed` : ''}`);
  }, [plan, dispatch, message]);

  if (!plan?.changes.length) return null;
  return { changes: plan.changes, rebuilt: plan.rebuilt, dropped: plan.dropped.length, onConfirm };
};

export default useJobWorkRefetch;
