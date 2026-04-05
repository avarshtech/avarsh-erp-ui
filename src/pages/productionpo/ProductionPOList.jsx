import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Tag, Typography, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchProductionPOs, deleteProductionPO, changeProductionPOStatus } from '../../services/productionPoService';
import { hasPermission } from '../../utils/permissions';
import { getPPOStatusLabel, getPPOStatusColor, PPO_STATUS, PPO_STATUS_OPTIONS } from '../../utils/productionPoConstants';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import ProductionPOView from './ProductionPOView';

const { Text } = Typography;

const ProductionPOList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  const canAdd = hasPermission('production-po', 'add');
  const canUpdate = hasPermission('production-po', 'update');
  const canDelete = hasPermission('production-po', 'delete');

  const fetchData = useCallback(async (page, pageSize, sort, direction) => {
    setLoading(true);
    try {
      const params = { page: (page || pagination.current) - 1, size: pageSize || pagination.pageSize,
        sort: sort || sortField, direction: direction || sortDirection };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (dateRange?.length === 2) { params.dateStart = dateRange[0].format('YYYY-MM-DD'); params.dateEnd = dateRange[1].format('YYYY-MM-DD'); }
      const res = await searchProductionPOs(params);
      setData(res.content || []);
      setPagination(prev => ({ ...prev, current: page || prev.current, pageSize: pageSize || prev.pageSize, total: res.totalElements || 0 }));
    } catch { message.error('Failed to load production POs'); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, dateRange]);

  useEffect(() => { fetchData(1, pagination.pageSize); }, [debouncedSearch, statusFilter, dateRange]); // eslint-disable-line

  const handleTableChange = (pag, _, sorter) => {
    const s = sorter.field || sortField, d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s); setSortDirection(d); fetchData(pag.current, pag.pageSize, s, d);
  };

  const handleDelete = useCallback(async (r) => {
    setDeletingId(r.id);
    try { await deleteProductionPO(r.id); message.success(`${r.ppoNumber} deleted`); fetchData(pagination.current, pagination.pageSize); }
    catch { message.error('Failed to delete'); } finally { setDeletingId(null); }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleStart = useCallback(async (r) => {
    try { await changeProductionPOStatus(r.id, { status: PPO_STATUS.IN_PROGRESS }); message.success(`${r.ppoNumber} started`); fetchData(pagination.current, pagination.pageSize); }
    catch { message.error('Failed to start'); }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleView = useCallback((r) => { setViewingRecord(r); setViewOpen(true); }, []);

  const columns = useMemo(() => [
    { title: 'PPO No', dataIndex: 'ppoNumber', key: 'ppoNumber', fixed: 'left', width: 140, sorter: true,
      render: (t, r) => <RecordLink text={t} onClick={() => handleView(r)} /> },
    { title: 'Order No', dataIndex: 'orderNo', key: 'orderNo', width: 130, render: t => t || '-' },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 110, ellipsis: true },
    { title: 'Season', dataIndex: 'season', key: 'season', width: 80 },
    { title: 'Order Qty', dataIndex: 'totalOrderQty', key: 'totalOrderQty', width: 100, align: 'right', sorter: true,
      render: q => <Text strong>{(q || 0).toLocaleString()}</Text> },
    { title: 'FG Qty', dataIndex: 'fgProducedQty', key: 'fgProducedQty', width: 90, align: 'right',
      render: q => (q || 0).toLocaleString() },
    { title: 'Progress', key: 'progress', width: 100,
      render: (_, r) => { const pct = r.totalOrderQty ? Math.round((r.fgProducedQty || 0) / r.totalOrderQty * 100) : 0;
        return <Progress percent={pct} size="small" />; } },
    { title: 'Start', dataIndex: 'startDate', key: 'startDate', width: 100, render: d => formatDate(d) },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: s => <Tag color={getPPOStatusColor(s)}>{getPPOStatusLabel(s)}</Tag> },
    { title: 'Actions', key: 'actions', fixed: 'right', width: 140,
      render: (_, r) => (
        <Space size="small" wrap>
          <ActionButton action="view" size="small" onClick={() => handleView(r)} />
          {r.status === PPO_STATUS.OPEN && canUpdate && (
            <ActionButton action="edit" size="small" onClick={() => navigate(`/production-po/edit/${r.id}`)} />
          )}
          {r.status === PPO_STATUS.OPEN && canUpdate && (
            <ActionButton action="submit" size="small" text="Start" onClick={() => handleStart(r)} />
          )}
          {r.status === PPO_STATUS.OPEN && canDelete && (
            <DeleteConfirm title="Delete Production PO" recordLabel={r.ppoNumber}
              onConfirm={() => handleDelete(r)} loading={deletingId === r.id}>
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
          )}
        </Space>
      ) },
  ], [handleView, handleDelete, handleStart, navigate, deletingId, canUpdate, canDelete]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Production PO">
        {canAdd && <ActionButton action="create" text="New Production PO" onClick={() => navigate('/production-po/new')} />}
      </PageHeader>
      <Card>
        <SearchFilterBar searchText={searchText} onSearchChange={e => setSearchText(e.target.value)}
          searchPlaceholder="Search PPO No, Style..."
          filters={[
            { type: 'select', placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: PPO_STATUS_OPTIONS, allowClear: true, style: { width: 150 } },
            { type: 'dateRange', value: dateRange, onChange: setDateRange, placeholder: ['Start', 'End'] },
          ]} />
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          onChange={handleTableChange} pagination={getTablePagination(pagination)}
          scroll={{ x: 1200 }} locale={{ emptyText: <EmptyState description="No production POs found" /> }} size="middle" />
      </Card>
      <ProductionPOView open={viewOpen} record={viewingRecord}
        onClose={() => { setViewOpen(false); setViewingRecord(null); }}
        onStatusChange={() => { setViewOpen(false); setViewingRecord(null); fetchData(pagination.current, pagination.pageSize); }} />
    </div>
  );
};

export default ProductionPOList;
