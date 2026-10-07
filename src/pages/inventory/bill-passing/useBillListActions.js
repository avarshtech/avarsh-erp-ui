import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { deleteBill } from '../../../services/inventory/billPassingService';
import { deleteJobWorkBill, resetJobWorkBillDemo } from '../../../services/inventory/jobWorkBill/jobWorkBillService';
import { BILL_SOURCE, isJobWorkSource } from '../../../utils/jobWorkBillConstants';
import { isQuickFilter } from './billListConstants';

export const billPath = (r) => (isJobWorkSource(r.source) ? `/inventory/bill-passing/job-work/${r.id}` : `/inventory/bill-passing/${r.id}`);

/**
 * The list's row actions (view, edit, delete — each kind of bill to its own screen and service), the demo
 * reset, and the deep links: ?viewId=X (a supplier bill) from approvals, notifications and the feed;
 * ?quick=PENDING from the dashboard's bill passing cards.
 */
export default function useBillListActions({ refetch, onQuickFilter, onDemoReset }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [viewing, setViewing] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const deepLinkId = searchParams.get('viewId');
    const quick = searchParams.get('quick');
    if (!deepLinkId && !quick) return;
    if (deepLinkId) setViewing({ source: BILL_SOURCE.SUPPLIER_PO, id: deepLinkId });
    if (quick && isQuickFilter(quick)) onQuickFilter(quick);
    searchParams.delete('viewId');
    searchParams.delete('quick');
    setSearchParams(searchParams, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleView = useCallback((r) => setViewing({ source: r.source, id: r.id }), []);
  const handleEdit = useCallback((r) => navigate(billPath(r)), [navigate]);
  const handleDelete = useCallback(async (r) => {
    try {
      await (isJobWorkSource(r.source) ? deleteJobWorkBill(r.id) : deleteBill(r.id));
      message.success(`${r.number} deleted`);
      refetch();
    } catch (e) {
      // The interceptor (or the demo facade) has already shown the refusal; this is for what it cannot see.
      if (!e.response) message.error(e.message || 'Failed to delete bill');
    }
  }, [message, refetch]);
  const handleResetDemo = useCallback(async () => {
    setResetting(true);
    try {
      await resetJobWorkBillDemo();
      onDemoReset();
      message.success('Job-work demo data reset');
    } finally {
      setResetting(false);
    }
  }, [message, onDemoReset]);

  return { viewing, setViewing, resetting, handleView, handleEdit, handleDelete, handleResetDemo };
}
