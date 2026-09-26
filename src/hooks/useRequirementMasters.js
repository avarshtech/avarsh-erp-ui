import { useEffect, useState } from 'react';
import { getActiveProcesses } from '../services/master/processService';
import { getActiveParts } from '../services/master/partsService';

const EMPTY = { processes: [], parts: [], loading: false, forbidden: false, failed: false };

/**
 * Masters for the process requirement screens — always the real API:
 * Processes of one category ('Cut Panel' | 'Garment') and, for Cut Panel, Parts with
 * panels per garment.
 *
 * Loaded only while the screen is editable (`enabled`): a viewer never needs the
 * dropdowns and may not hold Processes / Parts view. A 403 is reported as
 * `forbidden` so the screen can say which permission is missing.
 */
const useRequirementMasters = (processCategory, { enabled, withParts = false }) => {
  const requestKey = enabled ? `${processCategory}|${withParts}` : null;
  const [result, setResult] = useState({ key: null, ...EMPTY });

  useEffect(() => {
    if (!requestKey) return undefined;
    let alive = true;
    Promise.all([
      getActiveProcesses(processCategory),
      withParts ? getActiveParts() : Promise.resolve([]),
    ])
      .then(([processes, parts]) => {
        if (alive) setResult({ ...EMPTY, key: requestKey, processes: processes || [], parts: parts || [] });
      })
      .catch((e) => {
        const forbidden = e?.response?.status === 403;
        if (alive) setResult({ ...EMPTY, key: requestKey, forbidden, failed: !forbidden });
      });
    return () => { alive = false; };
  }, [requestKey, processCategory, withParts]);

  if (!requestKey) return EMPTY;
  return result.key === requestKey ? result : { ...EMPTY, loading: true };
};

export default useRequirementMasters;
