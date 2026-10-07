import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Empty, Table } from 'antd';
import dayjs from 'dayjs';
import SearchFilterBar from '../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../../utils/paginationConfig';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { getJobKpis, listFilterOptions, searchJobs } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { JOB_STATUS_LABEL, RISK_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';
import JobKpiCards from './JobKpiCards';
import jobTrackerColumns from './jobTrackerColumns';

const STATUS_OPTIONS = [{ value: 'OPEN', label: 'Open (in progress)' }, { value: 'ALL', label: 'All' }, ...toOptions(JOB_STATUS_LABEL)];
const EMPTY = { status: 'OPEN' };

/** Every outsourced job, riskiest first. A KPI card applies its filter; a row opens the job drawer. */
const JobTrackerTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [filters, setFilters] = useState(EMPTY);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25 });
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [kpis, setKpis] = useState(null);
  const [options, setOptions] = useState({ vendors: [], orders: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { listFilterOptions().then(setOptions).catch(() => {}); }, []);

  const query = useMemo(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [page, k] = await Promise.all([
          searchJobs({ ...query, page: pagination.current - 1, size: pagination.pageSize }),
          getJobKpis({ vendorId: query.vendorId, orderId: query.orderId }),
        ]);
        if (!alive) return;
        setData(page);
        setKpis(k);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load the jobs.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [query, pagination, refresh, message]);

  const patch = useCallback((p) => {
    setFilters((f) => ({ ...EMPTY, vendorId: f.vendorId, orderId: f.orderId, ...p }));
    setPagination((pg) => ({ ...pg, current: 1 }));
  }, []);

  const columns = useMemo(() => jobTrackerColumns({ onOpenPullBack: (id) => actions.openPullBack({ id }) }), [actions]);

  const filterItems = [
    { type: 'select', key: 'vendor', props: { placeholder: 'Vendor', value: filters.vendorId, options: options.vendors, onChange: (v) => patch({ ...filters, vendorId: v }) } },
    { type: 'select', key: 'order', props: { placeholder: 'Order / style', value: filters.orderId, options: options.orders, onChange: (v) => patch({ ...filters, orderId: v }) } },
    { type: 'select', key: 'status', span: { lg: 4 }, props: { placeholder: 'Status', value: filters.status, allowClear: false, options: STATUS_OPTIONS, onChange: (v) => patch({ ...filters, status: v }) } },
    { type: 'select', key: 'risk', span: { lg: 4 }, props: { placeholder: 'Risk', value: filters.risk, options: toOptions(RISK_LABEL), onChange: (v) => patch({ ...filters, risk: v }) } },
    {
      type: 'rangePicker', key: 'due', props: {
        placeholder: ['Due from', 'Due to'], value: filters.dueFrom ? [dayjs(filters.dueFrom), dayjs(filters.dueTo)] : null,
        onChange: (r) => patch({ ...filters, dueFrom: r?.[0]?.format('YYYY-MM-DD'), dueTo: r?.[1]?.format('YYYY-MM-DD') }),
      },
    },
  ];

  return (
    <>
      <JobKpiCards kpis={kpis} loading={loading} onFilter={patch} />
      <Card size="small">
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
          searchPlaceholder="Search job, order, style, vendor, buyer"
          filters={filterItems}
          onClear={() => { setSearchText(''); patch(EMPTY); }}
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={data.content}
          scroll={{ x: 1560, y: 'calc(100vh - 430px)' }}
          onRow={(r) => ({ onClick: () => actions.openJob(r.id), style: { cursor: 'pointer' } })}
          pagination={getTablePagination({ ...pagination, total: data.totalElements }, 'jobs')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <Empty description="No outsourced jobs match. Jobs appear when a vendor PO is approved." /> }}
        />
      </Card>
    </>
  );
};

export default JobTrackerTab;
