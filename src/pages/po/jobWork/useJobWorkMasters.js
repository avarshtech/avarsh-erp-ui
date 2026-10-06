import { useEffect, useState } from 'react';
import { getVendorOptions } from '../../../services/master/vendorService';
import { getActiveProcesses } from '../../../services/master/processService';
import { getAllPaymentTerms } from '../../../services/master/paymentTermsService';
import { hasPermission } from '../../../utils/permissions';

const EMPTY = { jobWorkers: [], processes: [], paymentTerms: [], denied: [], loading: false };
const list = (r) => (Array.isArray(r) ? r : r?.data || []);

/**
 * The real masters a job-work PO form reads while it is editable: the vendors (inactive
 * included, so they show greyed with the reason), the category's processes and the payment
 * terms. The vendors come from GET /vendors/options, which the PO's own key may read, so they
 * always load. A master the user may not read is not requested — `denied` names it, so the
 * screen can say why a picker is empty instead of raising a 403 toast.
 */
const useJobWorkMasters = (category, { enabled }) => {
  const [result, setResult] = useState({ key: null, ...EMPTY });
  const key = enabled ? category : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const may = { Processes: hasPermission('process-master', 'view'), 'Payment Terms': hasPermission('payment-terms', 'view') };
    Promise.all([
      getVendorOptions({ includeInactive: true }).then(list),
      may.Processes ? getActiveProcesses(key).then(list) : [],
      may['Payment Terms'] ? getAllPaymentTerms().then(list).catch(() => []) : [],
    ]).then(([vendors, processes, paymentTerms]) => {
      if (!alive) return;
      setResult({
        key, loading: false, processes, paymentTerms, denied: Object.keys(may).filter((m) => !may[m]),
        jobWorkers: vendors,
      });
    }).catch(() => { if (alive) setResult({ key, ...EMPTY }); });
    return () => { alive = false; };
  }, [key]);

  if (!key) return EMPTY;
  return result.key === key ? result : { ...EMPTY, loading: true };
};

export default useJobWorkMasters;
