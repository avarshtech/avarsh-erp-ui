import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  searchSewingPlans, deleteSewingPlan, changeSewingPlanStatus,
} from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import {
  getSewPlanLabel, getSewPlanColor,
  SEW_PLAN_STATUS, SEW_PLAN_EDITABLE, SEW_PLAN_DELETABLE, SEW_PLAN_STATUS_OPTIONS,
} from '../../../utils/sewingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate, formatNumber, formatPercentage } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const SewingPlanList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('sewing-plan', 'add');
  const canUpdate = hasPermission('sewing-plan', 'update');
  const canDelete = hasPermission('sewing-plan', 'delete');

  const fetchData = useCallback(async (page, pageSize, sort, direction) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1,
        size: pageSize || pagination.pageSize,
        sort: sort || sortField,
        direction: direction || sortDirection,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      const response = await searchSewingPlans(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load sewing plans');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag, _f, sorter) => {
    const s = sorter.field || sortField;
    const d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s);
    setSortDirection(d);
    fetchData(pag.current, pag.pageSize, s, d);
  };

  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteSewingPlan(record.id);
      message.success(`${record.planNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const handleStatusChange = useCallback(async (record, status) => {
    try {
      await changeSewingPlanStatus(record.id, { status });
      message.success(`${record.planNo} → ${getSewPlanLabel(status)}`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Status change failed'); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Plan No',
      dataIndex: 'planNo',
      key: 'planNo',
      sorter: true,
      width: 150,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 130, ellipsis: true },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 140, ellipsis: true },
    { title: 'Line', dataIndex: 'lineName', key: 'lineName', width: 120, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    {
      title: 'Order Qty',
      dataIndex: 'orderQty',
      key: 'orderQty',
      width: 100,
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: 'SAM',
      dataIndex: 'samPerPiece',
      key: 'samPerPiece',
      width: 80,
      align: 'right',
      render: (v) => v != null ? Number(v).toFixed(2) : '',
    },
    {
      title: 'Target/Day',
      dataIndex: 'targetPerDay',
      key: 'targetPerDay',
      width: 100,
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: 'Efficiency %',
      dataIndex: 'targetEfficiencyPct',
      key: 'targetEfficiencyPct',
      width: 100,
      align: 'right',
      render: (v) => formatPercentage(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getSewPlanColor(s)}>{getSewPlanLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/sewing/plan/edit/${record.id}`)} />
          {canUpdate && SEW_PLAN_EDITABLE.includes(record.status) && (
            <ActionButton action="edit" onClick={() => navigate(`/sewing/plan/edit/${record.id}`)} />
          )}
          {record.status === SEW_PLAN_STATUS.DRAFT && (
            <ActionButton action="approve" onClick={() => handleStatusChange(record, 'APPROVED')} tooltip="Approve" />
          )}
          {canDelete && SEW_PLAN_DELETABLE.includes(record.status) && (
            <DeleteConfirm onConfirm={() => handleDelete(record)} loading={deletingId === record.id} />
          )}
        </span>
      ),
    },
  ], [canUpdate, canDelete, deletingId, navigate, handleDelete, handleStatusChange]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: SEW_PLAN_STATUS_OPTIONS,
      width: 150,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Sewing Production Plans"
        onAdd={canAdd ? () => navigate('/sewing/plan/new') : undefined}
        addLabel="New Plan"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search plan no, style, buyer..."
          filters={filters}
          onReset={() => { setSearchText(''); setStatusFilter(undefined); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <EmptyState description="No sewing plans found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default SewingPlanList;
