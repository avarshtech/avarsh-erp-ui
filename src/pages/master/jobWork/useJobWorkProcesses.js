import { useEffect, useMemo, useState } from 'react';
import { getAllProcesses } from '../../../services/master/processService';
import { hasPermission } from '../../../utils/permissions';
import { JOB_WORK_CATEGORIES, isJobWorkCategory } from '../../../utils/jobWorkConstants';

const NONE = [];

/**
 * The 'Cut Panel' and 'Garment' processes a job worker can be tied to, as Select options
 * grouped by category (inactive ones disabled, so a supplier that still has one shows it)
 * plus an id → name lookup. Reading them needs Processes (view); without it `denied` is set
 * and nothing is requested, so the supplier screen raises no 403 toast.
 */
const useJobWorkProcesses = () => {
  const denied = !hasPermission('process-master', 'view');
  const [processes, setProcesses] = useState(NONE);
  const [loading, setLoading] = useState(!denied);

  useEffect(() => {
    if (denied) return undefined;
    let alive = true;
    getAllProcesses()
      .then((list) => { if (alive) setProcesses((Array.isArray(list) ? list : []).filter((p) => isJobWorkCategory(p.category))); })
      .catch(() => { /* the interceptor has shown the error; the picker stays empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [denied]);

  return useMemo(() => {
    const names = new Map(processes.map((p) => [p.id, p.processName]));
    const options = JOB_WORK_CATEGORIES.map((category) => ({
      label: category,
      title: category,
      options: processes
        .filter((p) => p.category === category)
        .sort((a, b) => a.processName.localeCompare(b.processName))
        .map((p) => ({
          value: p.id,
          label: p.isActive === false ? `${p.processName} (inactive)` : p.processName,
          disabled: p.isActive === false,
        })),
    })).filter((group) => group.options.length > 0);
    const nameOf = (id) => names.get(id) ?? `Process #${id}`;
    return { options, nameOf, loading, denied };
  }, [processes, loading, denied]);
};

export default useJobWorkProcesses;
