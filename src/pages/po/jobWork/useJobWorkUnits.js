import { useEffect, useState } from 'react';
import { getActiveUnits } from '../../../services/master/unitService';

const EMPTY = { list: [], loading: false, failed: false };
const asList = (r) => (Array.isArray(r) ? r : r?.data || []);

/**
 * The active units of a branch (HR › Units) for a job-work PO's return unit, while its
 * delivery place is editable. Fetched silently: the API guards units with HR Masters (view),
 * so a refusal shows on the field (`failed`) instead of as an error toast.
 */
const useJobWorkUnits = (branchId, { enabled }) => {
  const [result, setResult] = useState({ key: null, ...EMPTY });
  const key = enabled ? String(branchId ?? 'any') : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    getActiveUnits(branchId ?? undefined, { silent: true })
      .then((r) => { if (alive) setResult({ key, list: asList(r), loading: false, failed: false }); })
      .catch(() => { if (alive) setResult({ key, ...EMPTY, failed: true }); });
    return () => { alive = false; };
  }, [key, branchId]);

  if (!key) return EMPTY;
  return result.key === key ? result : { ...EMPTY, loading: true };
};

export default useJobWorkUnits;
