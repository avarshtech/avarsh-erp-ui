import { useState, useEffect, useCallback } from 'react';
import { hasModuleAccess } from '../../utils/permissions';
import { getExpDocDashboard } from '../../services/expdoc/expDocService';

/**
 * Permission-gated Export Documentation dashboard fetch.
 *
 * Returns null data when the user cannot see packing lists, so every export widget
 * renders nothing and the Dashboard is byte-for-byte what it was before this module
 * existed — the same contract `useSampleDashboard` holds.
 */
const useExpDocDashboard = () => {
  const enabled = hasModuleAccess('export-packing-list');
  const [state, setState] = useState({ data: null, loading: enabled });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getExpDocDashboard()
      .then((data) => { if (!cancelled) setState({ data, loading: false }); })
      .catch(() => { if (!cancelled) setState({ data: null, loading: false }); });
    return () => { cancelled = true; };
  }, [enabled, tick]);

  return { enabled, data: state.data, loading: state.loading, reload };
};

export default useExpDocDashboard;
