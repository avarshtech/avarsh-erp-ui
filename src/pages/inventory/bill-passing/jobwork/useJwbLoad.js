import { useCallback, useEffect, useState } from 'react';
import { getJobWorkBill } from '../../../../services/inventory/jobWorkBill/jobWorkBillService';
import { fetchAndCacheOrganisation, getCachedOrganisation } from '../../../../services/admin/organisationService';

/**
 * Loads a job-work bill for its workspace. Loading is derived (the loaded id is not yet the route's), so the
 * effect only ever sets state from the answer. The company letterhead is fetched up front too, so the Vendor
 * Debit Note opens its print window inside the click (a window opened after an await is a blocked pop-up).
 */
export default function useJwbLoad(id) {
  const [state, setState] = useState({ id: null, bill: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    getJobWorkBill(id)
      .then((bill) => { if (!cancelled) setState({ id, bill, error: '' }); })
      .catch((e) => { if (!cancelled) setState({ id, bill: null, error: e.response?.data?.message || e.message || 'Failed to load this bill' }); });
    if (!getCachedOrganisation()) fetchAndCacheOrganisation().catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const setBill = useCallback((next) => {
    setState((s) => ({ ...s, bill: typeof next === 'function' ? next(s.bill) : next }));
  }, []);

  const current = state.id === id;
  return { bill: current ? state.bill : null, setBill, loading: !current, loadError: current ? state.error : '' };
}
