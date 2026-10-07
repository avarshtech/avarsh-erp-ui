import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { searchBillLines } from '../../../services/inventory/billPassingService';
import { listAllBills, untype } from '../../../services/inventory/billListService';

/**
 * One page of the Bill Passing list for the current filters: bills (supplier and job-work, see listAllBills)
 * or the supplier line register. Only the newest request may paint — a filter change also resets the page,
 * so two fetches can be in flight and land out of order.
 */
export default function useBillListData({ isBills, filters, pagination, refreshKey }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    const page = pagination.current - 1;
    const size = pagination.pageSize;
    try {
      if (isBills) {
        const res = await listAllBills({ ...filters, page, size });
        if (seq !== reqRef.current) return;
        setRows(res.content || []);
        setTotal(res.totalElements || 0);
        setStats(res.stats || null);
      } else {
        // The line register is the supplier bills' (GRN lines); a job-work filter value does not apply to it.
        const [partySide, supplierId] = untype(filters.party);
        const [poSide, poId] = untype(filters.po);
        const res = await searchBillLines({
          search: filters.search,
          supplierId: partySide === 'S' ? supplierId : undefined,
          poId: poSide === 'S' ? poId : undefined,
          page,
          size,
        });
        if (seq !== reqRef.current) return;
        // Keep the last KPI values while the user browses the register.
        setRows(res.content || []);
        setTotal(res.totalElements || 0);
      }
    } catch (e) {
      if (seq !== reqRef.current) return;
      // The interceptor has already shown the server's message; this is for the failure it cannot see.
      if (!e.response) message.error(e.message || 'Failed to load bill passing records');
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [isBills, filters, pagination, message, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- refreshKey re-runs it (branch switch, demo reset)

  useEffect(() => { fetchData(); }, [fetchData]);

  return { rows, total, stats, loading, refetch: fetchData };
}
