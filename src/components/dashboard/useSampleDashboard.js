import { useState, useEffect, useCallback } from 'react';
import { hasModuleAccess } from '../../utils/permissions';
import { getSampleDashboard } from '../../services/sr/srService';

/**
 * Permission-gated sample dashboard fetch. Returns null data when the user
 * lacks the sample-requests module — every SR widget then renders nothing and
 * the Dashboard is byte-for-byte what it was before this module existed.
 */
const useSampleDashboard = () => {
  const enabled = hasModuleAccess('sample-requests');
  const [state, setState] = useState({ data: null, loading: enabled });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getSampleDashboard()
      .then((data) => { if (!cancelled) setState({ data, loading: false }); })
      .catch(() => { if (!cancelled) setState({ data: null, loading: false }); });
    return () => { cancelled = true; };
  }, [enabled, tick]);

  return { enabled, data: state.data, loading: state.loading, reload };
};

export default useSampleDashboard;
