import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchSamStandards, deleteSamStandard } from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { MACHINE_TYPES, SAM_SOURCE_OPTIONS } from '../../../utils/sewingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const SamList = () => {
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

  const canAdd = hasPermission('sam-management', 'add');
  const canUpdate = hasPermission('sam-management', 'update');
  const canDelete = hasPermission('sam-management', 'delete');

  const machineLabel = useMemo(() => {
    const map = {};
    MACHINE_TYPES.forEach((m) => { map[m.value] = m.label; });
    return map;
  }, []);

  const sourceLabel = useMemo(() => {
    const map = {};
    SAM_SOURCE_OPTIONS.forEach((s) => { map[s.value] = s.label; });
    return map;
  }, []);

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
      const response = await searchSamStandards(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load SAM standards');
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
      await deleteSamStandard(record.id);
      message.success('SAM standard deleted');
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const columns = useMemo(() => [
    { title: 'Style No', dataIndex: 'styleNo', key: 'styleNo', width: 140, sorter: true, ellipsis: true },
    { title: 'Operation', dataIndex: 'operationName', key: 'operationName', width: 200, ellipsis: true },
    {
      title: 'Machine Type',
      dataIndex: 'machineType',
      key: 'machineType',
      width: 120,
      render: (v) => machineLabel[v] || v || '',
    },
    {
      title: 'SAM (min)',
      dataIndex: 'samMinutes',
      key: 'samMinutes',
      width: 100,
      align: 'right',
      sorter: true,
      render: (v) => v != null ? Number(v).toFixed(2) : '',
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (v) => sourceLabel[v] || v || '',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => (
        <Tag color={s === 'ACTIVE' ? 'success' : 'default'}>
          {s === 'ACTIVE' ? 'Active' : s === 'INACTIVE' ? 'Inactive' : s || ''}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          {canUpdate && (
            <ActionButton action="edit" onClick={() => navigate(`/sewing/sam/edit/${record.id}`)} />
          )}
          {canDelete && (
            <DeleteConfirm onConfirm={() => handleDelete(record)} loading={deletingId === record.id} />
          )}
        </span>
      ),
    },
  ], [canUpdate, canDelete, deletingId, navigate, handleDelete, machineLabel, sourceLabel]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: STATUS_OPTIONS,
      width: 150,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="SAM Standards"
        onAdd={canAdd ? () => navigate('/sewing/sam/new') : undefined}
        addLabel="New SAM"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search style, operation..."
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
          scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState description="No SAM standards found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default SamList;
