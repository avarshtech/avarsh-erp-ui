import { useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import {
  listDebitTypes, listChargeTypes, listIssueTypes,
} from '../services/inventory/billPassingService';

const EMPTY = Object.freeze({ debitTypes: [], chargeTypes: [], issueTypes: [] });

/**
 * Bill Passing configuration (StoreContext-cached, 5-min TTL): what can be
 * debited, what can be charged, and what can be raised as an issue.
 *
 * Fetched once and shared, rather than three calls every time a bill is opened.
 * Only active types are listed — the admin screens ask for the inactive ones
 * too, so a retired type still reads properly on the bills that used it.
 */
const useBillPassingMasters = () => {
  const { billPassingMasters, loading, setData, setLoading, isCacheValid } = useStore();

  useEffect(() => {
    if (isCacheValid('billPassingMasters') || loading.billPassingMasters) return;
    setLoading('billPassingMasters', true);
    Promise.all([listDebitTypes(), listChargeTypes(), listIssueTypes()])
      .then(([debitTypes, chargeTypes, issueTypes]) => setData('billPassingMasters', {
        debitTypes: debitTypes || [],
        chargeTypes: chargeTypes || [],
        issueTypes: issueTypes || [],
      }))
      .catch(() => setData('billPassingMasters', EMPTY))
      .finally(() => setLoading('billPassingMasters', false));
  }, [isCacheValid, loading.billPassingMasters, setData, setLoading]);

  const masters = billPassingMasters || EMPTY;

  /** Bills store the code, so a renamed type never rewrites history. */
  const debitTypeOptions = useMemo(
    () => masters.debitTypes.map((t) => ({ value: t.code, label: t.name })),
    [masters.debitTypes],
  );

  const chargeTypeOptions = useMemo(
    () => masters.chargeTypes.map((t) => ({ value: t.code, label: t.name })),
    [masters.chargeTypes],
  );

  const issueTypeOptions = useMemo(
    () => masters.issueTypes.map((t) => ({ value: t.code, label: t.name })),
    [masters.issueTypes],
  );

  return {
    ...masters,
    debitTypeOptions,
    chargeTypeOptions,
    issueTypeOptions,
    loading: loading.billPassingMasters,
  };
};

export default useBillPassingMasters;
