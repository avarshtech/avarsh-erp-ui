import { useEffect, useMemo, useState } from 'react';
import { getVendorProcessOptions } from '../services/master/vendorService';

const NONE = [];
const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : NONE);

/**
 * The processes a vendor can be tagged with — every active process, of any category — as Select
 * options grouped by category, plus an id → name lookup for lists and tags. Served under vendor-info
 * (GET /vendors/process-options), so the Vendor master needs no Processes permission.
 */
const useVendorProcesses = () => {
  const [processes, setProcesses] = useState(NONE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getVendorProcessOptions()
      .then((res) => { if (alive) setProcesses(listOf(res)); })
      .catch(() => { /* the interceptor has shown the error; the picker stays empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    const names = new Map(processes.map((p) => [p.id, p.name]));
    const categories = [...new Set(processes.map((p) => p.category))].sort();
    const options = categories.map((category) => ({
      label: category,
      title: category,
      options: processes
        .filter((p) => p.category === category)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: p.id, label: p.name })),
    }));
    const nameOf = (id) => names.get(id) ?? `Process #${id}`;
    return { options, nameOf, loading };
  }, [processes, loading]);
};

export default useVendorProcesses;
