import { useEffect, useMemo, useState } from 'react';
import { allocationRows } from '../../../utils/jobWorkAllocation';

/**
 * Loads a requirement's PO allocation — `load(id)` resolves to { doc, usage, pos } — and
 * shapes it for the view. Fetches on mount: the drawer destroys its content on close, so
 * every opening shows the ledger as it is now.
 */
const useRequirementAllocation = (source, docId, load) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    load(docId)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [docId, load]);

  const rows = useMemo(() => (data ? allocationRows(source, data.doc, data.usage) : []), [source, data]);
  return { data, rows, failed, loading: !data && !failed };
};

export default useRequirementAllocation;
