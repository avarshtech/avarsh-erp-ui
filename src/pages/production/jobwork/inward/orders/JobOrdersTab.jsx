import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Empty, Space, Table,
} from 'antd';
import {
  ClockCircleOutlined, ExclamationCircleOutlined, HourglassOutlined, InboxOutlined, PlusOutlined, SendOutlined, ToolOutlined,
} from '@ant-design/icons';
import SearchFilterBar from '../../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../../../utils/paginationConfig';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { getJobOrderKpis, listInwardFilterOptions, searchJobOrders } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { JO_STATUS_LABEL, SCOPE_LABEL, toOptions } from '../../../../../utils/jobWorkInward/inwardConstants';
import { RISK_LABEL } from '../../../../../utils/jobWorkTracker/constants';
import JobKpiCards from '../../tracker/JobKpiCards';
import jobOrderColumns from './jobOrderColumns';

const CARDS = [
  { key: 'open', title: 'Open job orders', icon: <InboxOutlined />, color: 'var(--primary-color)' },
  { key: 'toMake', title: 'Pieces still to return', icon: <ToolOutlined />, color: '#1677ff' },
  { key: 'waiting', title: 'Waiting for material', icon: <HourglassOutlined />, color: '#d4380d', filter: { waiting: true } },
  { key: 'dueSoon', title: 'Due in 7 days', icon: <ClockCircleOutlined />, color: '#d46b08', filter: { dueSoon: true } },
  { key: 'overdue', title: 'Overdue', icon: <ExclamationCircleOutlined />, color: '#cf1322', filter: { risk: 'OVERDUE' } },
  { key: 'readyToReturn', title: 'Pieces ready to return', icon: <SendOutlined />, color: '#08979c', filter: { readyToReturn: true } },
];
const STATUS_OPTIONS = [{ value: 'OPEN', label: 'Open' }, { value: 'ALL', label: 'All' }, ...toOptions(JO_STATUS_LABEL)];
const EMPTY = { status: 'OPEN' };

/** The principals' orders on our lines, riskiest first; a KPI card applies its filter, a row opens the order. */
const JobOrdersTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [filters, setFilters] = useState(EMPTY);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25 });
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [kpis, setKpis] = useState(null);
  const [principals, setPrincipals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listInwardFilterOptions().then((o) => setPrincipals(o.principals)).catch(() => {}); }, [refresh]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [page, k] = await Promise.all([
          searchJobOrders({ ...filters, q: debouncedSearch, page: pagination.current - 1, size: pagination.pageSize }),
          getJobOrderKpis({ principalId: filters.principalId }),
        ]);
        if (!alive) return;
        setData(page);
        setKpis(k);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load the job orders.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [filters, debouncedSearch, pagination, refresh, message]);

  const patch = useCallback((p) => {
    setFilters((f) => ({ ...EMPTY, principalId: f.principalId, ...p }));
    setPagination((pg) => ({ ...pg, current: 1 }));
  }, []);
  const columns = useMemo(() => jobOrderColumns(), []);
  const canAdd = hasPermission('production-job-work', 'add');

  return (
    <>
      <JobKpiCards kpis={kpis} loading={loading} onFilter={patch} cards={CARDS} />
      <Card size="small">
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
          searchPlaceholder="Search order, their ref, style, principal"
          filters={[
            { type: 'select', key: 'p', props: { placeholder: 'Principal', value: filters.principalId, options: principals, onChange: (v) => patch({ ...filters, principalId: v }) } },
            { type: 'select', key: 's', span: { lg: 4 }, props: { value: filters.status, allowClear: false, options: STATUS_OPTIONS, onChange: (v) => patch({ ...filters, status: v }) } },
            { type: 'select', key: 'c', span: { lg: 4 }, props: { placeholder: 'Scope', value: filters.scope, options: toOptions(SCOPE_LABEL), onChange: (v) => patch({ ...filters, scope: v }) } },
            { type: 'select', key: 'r', span: { lg: 3 }, props: { placeholder: 'Risk', value: filters.risk, options: toOptions(RISK_LABEL), onChange: (v) => patch({ ...filters, risk: v }) } },
          ]}
          extra={(
            <Space>
              <Button icon={<InboxOutlined />} disabled={!hasPermission('production-job-work', 'receive')} onClick={() => actions.recordInward(null)}>Record material in</Button>
              <Button type="primary" icon={<PlusOutlined />} disabled={!canAdd} onClick={actions.newJobOrder}>New job order</Button>
            </Space>
          )}
          onClear={() => { setSearchText(''); patch(EMPTY); }}
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={data.content}
          scroll={{ x: 1620, y: 'calc(100vh - 450px)' }}
          onRow={(r) => ({ onClick: () => actions.openJobOrder(r.id), style: { cursor: 'pointer' } })}
          pagination={getTablePagination({ ...pagination, total: data.totalElements }, 'job orders')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <Empty description="No job orders match." /> }}
        />
      </Card>
    </>
  );
};

export default JobOrdersTab;
