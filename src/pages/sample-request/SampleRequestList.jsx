import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  searchSampleRequests, deleteSampleRequest,
  listSampleTypes, listSrBuyers, getSampleDashboard, isOverseas,
} from '../../services/sr/srService';
import { hasPermission } from '../../utils/permissions';
import { SR_STATUS_LABELS } from '../../utils/sampleRequestConstants';
import { ActionButton } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import EmptyState from '../../components/EmptyState';
import SampleKpiRow from '../../components/sample/SampleKpiRow';
import SampleDeadlineAlert from '../../components/sample/SampleDeadlineAlert';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import { buildSrColumns } from './srListColumns';
import SampleRequestView from './SampleRequestView';

const SampleRequestList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [sampleTypes, setSampleTypes] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [buyerFilter, setBuyerFilter] = useState(undefined);
  const [deadlineRange, setDeadlineRange] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get('overdue') === '1');
  const [pendingApprovalOnly, setPendingApprovalOnly] = useState(() => searchParams.get('pendingApproval') === '1');
  const [viewId, setViewId] = useState(null);

  const canAdd = hasPermission('sample-requests', 'add');
  const canUpdate = hasPermission('sample-requests', 'update');
  const canDelete = hasPermission('sample-requests', 'delete');

  // Deep link ?viewId= (dashboard chips) — consume once
  useEffect(() => {
    const deepViewId = searchParams.get('viewId');
    if (deepViewId || searchParams.get('status') || searchParams.get('overdue') || searchParams.get('pendingApproval')) {
      setSearchParams({}, { replace: true });
    }
    if (deepViewId) setViewId(Number(deepViewId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([
      listSampleTypes().then(setSampleTypes).catch(() => {}),
      listSrBuyers().then(setBuyers).catch(() => {}),
    ]).finally(() => setMastersLoading(false));
  }, []);

  const refreshDashboard = useCallback(() => {
    getSampleDashboard().then(setDashboard).catch(() => {});
  }, []);
  useEffect(() => { refreshDashboard(); }, [refreshDashboard]);

  const fetchData = useCallback(async (page, pageSize) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1,
        size: pageSize || pagination.pageSize,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.sampleTypeId = typeFilter;
      if (buyerFilter) params.buyer = buyerFilter;
      if (overdueOnly) params.overdue = true;
      if (pendingApprovalOnly) params.pendingApproval = true;
      if (deadlineRange?.length === 2) {
        params.deadlineFrom = deadlineRange[0].format('YYYY-MM-DD');
        params.deadlineTo = deadlineRange[1].format('YYYY-MM-DD');
      }
      const response = await searchSampleRequests(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load sample requests');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedSearch, statusFilter, typeFilter, buyerFilter, overdueOnly, pendingApprovalOnly, deadlineRange, message]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, typeFilter, buyerFilter, overdueOnly, pendingApprovalOnly, deadlineRange]);

  const refreshAll = useCallback(() => {
    fetchData(pagination.current, pagination.pageSize);
    refreshDashboard();
  }, [fetchData, pagination.current, pagination.pageSize, refreshDashboard]);

  // KPI card click — filter in place (PRD §8.1 module strip)
  const applyKpiFilter = useCallback((query) => {
    const params = new URLSearchParams(query.replace('?', ''));
    setOverdueOnly(params.get('overdue') === '1');
    setPendingApprovalOnly(params.get('pendingApproval') === '1');
    setStatusFilter(params.get('status') || undefined);
  }, []);

  const handleDelete = useCallback((record) => {
    modal.confirm({
      title: 'Delete Sample Request',
      content: `Delete ${record.srNo}? Only Draft SRs can be deleted.`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSampleRequest(record.id);
          message.success(`${record.srNo} deleted`);
          refreshAll();
        } catch (e) {
          message.error(e.message || 'Failed to delete');
        }
      },
    });
  }, [modal, message, refreshAll]);

  const columns = useMemo(() => buildSrColumns({
    onView: (record) => setViewId(record.id),
    onEdit: (record) => navigate(`/sample-requests/edit/${record.id}`),
    onDelete: handleDelete,
    onGenerateInvoice: (record) => navigate(`/sample-requests/invoices/new?srId=${record.id}`),
    isOverseasRow: (record) => isOverseas(record),
    canUpdate,
    canDelete,
  }), [navigate, handleDelete, canUpdate, canDelete]);

  const statusOptions = useMemo(
    () => Object.entries(SR_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Sample Requests">
        {canAdd && (
          <ActionButton action="create" text="New Sample Request" onClick={() => navigate('/sample-requests/new')} />
        )}
      </PageHeader>

      <SampleKpiRow kpis={dashboard?.kpis} loading={!dashboard} onFilter={applyKpiFilter} style={{ marginBottom: 16 }} />
      <SampleDeadlineAlert alerts={dashboard?.alerts || []} />

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search SR No or Order No..."
          filters={[
            { type: 'select', span: { xs: 12, sm: 8, md: 4, lg: 3 }, props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: statusOptions } },
            { type: 'select', span: { xs: 12, sm: 8, md: 4, lg: 3 }, props: { placeholder: 'Sample Type', value: typeFilter, onChange: setTypeFilter, loading: mastersLoading, options: sampleTypes.map((t) => ({ value: t.id, label: t.name })) } },
            { type: 'select', span: { xs: 12, sm: 8, md: 4, lg: 3 }, props: { placeholder: 'Buyer', value: buyerFilter, onChange: setBuyerFilter, loading: mastersLoading, options: buyers.map((b) => ({ value: b, label: b })) } },
            { type: 'rangePicker', span: { xs: 24, sm: 12, md: 6, lg: 5 }, props: { placeholder: ['Dispatch From', 'Dispatch To'], value: deadlineRange, onChange: setDeadlineRange } },
          ]}
          onRefresh={refreshAll}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1530 }}
          onRow={(record) => ({
            // PRD §8.1 — row click opens SR Detail (actions column stops propagation)
            onClick: () => setViewId(record.id),
            style: { cursor: 'pointer' },
          })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'sample requests')}
          locale={{
            emptyText: (
              <EmptyState
                title="No sample requests found"
                description={canAdd ? 'Raise one from a confirmed BOM of a sample order, or create one here.' : 'Try adjusting your search or filters'}
              />
            ),
          }}
        />
      </Card>

      <SampleRequestView
        open={viewId != null}
        srId={viewId}
        onClose={() => setViewId(null)}
        onChanged={refreshAll}
      />
    </div>
  );
};

export default SampleRequestList;
