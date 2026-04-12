import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchOperators, deleteOperator, getAllActiveLines } from '../../../services/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { getOperatorStatusLabel, getOperatorStatusColor } from '../../../utils/sewingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const OperatorList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [lineFilter, setLineFilter] = useState(undefined);
  const [lineOptions, setLineOptions] = useState([]);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('sewing-operators', 'add');
  const canUpdate = hasPermission('sewing-operators', 'update');
  const canDelete = hasPermission('sewing-operators', 'delete');

  // Load active lines for filter dropdown
  useEffect(() => {
    getAllActiveLines()
      .then((lines) => {
        setLineOptions((lines || []).map((l) => ({ value: l.id, label: l.lineName || l.lineCode })));
      })
      .catch(() => { /* ignore */ });
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
      if (lineFilter) params.lineId = lineFilter;
      const response = await searchOperators(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load operators');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, lineFilter]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, statusFilter, lineFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await deleteOperator(record.id);
      message.success(`${record.empCode} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Emp Code',
      dataIndex: 'empCode',
      key: 'empCode',
      sorter: true,
      width: 130,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Name', dataIndex: 'operatorName', key: 'operatorName', width: 180, ellipsis: true, sorter: true },
    { title: 'Line', dataIndex: 'lineName', key: 'lineName', width: 140, ellipsis: true },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 140, ellipsis: true },
    { title: 'Primary Skill', dataIndex: 'primarySkill', key: 'primarySkill', width: 140 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => <Tag color={getOperatorStatusColor(s)}>{getOperatorStatusLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/sewing/operators/edit/${record.id}`)} />
          {canUpdate && (
            <ActionButton action="edit" onClick={() => navigate(`/sewing/operators/edit/${record.id}`)} />
          )}
          {canDelete && (
            <DeleteConfirm onConfirm={() => handleDelete(record)} loading={deletingId === record.id} />
          )}
        </span>
      ),
    },
  ], [canUpdate, canDelete, deletingId, navigate, handleDelete]);

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
    {
      key: 'line',
      type: 'select',
      placeholder: 'Line',
      value: lineFilter,
      onChange: setLineFilter,
      options: lineOptions,
      width: 180,
    },
  ], [statusFilter, lineFilter, lineOptions]);

  return (
    <>
      <PageHeader
        title="Sewing Operators"
        onAdd={canAdd ? () => navigate('/sewing/operators/new') : undefined}
        addLabel="New Operator"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search emp code, name, skill..."
          filters={filters}
          onReset={() => { setSearchText(''); setStatusFilter(undefined); setLineFilter(undefined); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description="No operators found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default OperatorList;
