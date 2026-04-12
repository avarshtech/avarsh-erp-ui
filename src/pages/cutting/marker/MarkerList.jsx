import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchMarkers, deleteMarker, approveMarker } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  MARKER_STATUS, getMarkerStatusLabel, getMarkerStatusColor,
} from '../../../utils/cuttingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const MARKER_STATUS_OPTIONS = [
  { value: MARKER_STATUS.DRAFT, label: 'Draft' },
  { value: MARKER_STATUS.APPROVED, label: 'Approved' },
];

const MarkerList = () => {
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

  const canAdd = hasPermission('marker-planning', 'add');
  const canUpdate = hasPermission('marker-planning', 'update');
  const canDelete = hasPermission('marker-planning', 'delete');

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
      const response = await searchMarkers(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load markers');
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
      await deleteMarker(record.id);
      message.success(`${record.markerNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const handleApprove = useCallback(async (record) => {
    try {
      await approveMarker(record.id);
      message.success(`${record.markerNo} approved`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Approve failed'); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Marker No',
      dataIndex: 'markerNo',
      key: 'markerNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    {
      title: 'Length (m)', dataIndex: 'markerLengthM', key: 'markerLengthM', width: 110, align: 'right',
      render: (v) => v != null ? Number(v).toFixed(3) : '-',
    },
    {
      title: 'Width (cm)', dataIndex: 'markerWidthCm', key: 'markerWidthCm', width: 110, align: 'right',
      render: (v) => v != null ? Number(v).toFixed(2) : '-',
    },
    {
      title: 'Efficiency %', dataIndex: 'efficiencyPct', key: 'efficiencyPct', width: 110, align: 'right',
      render: (v) => v != null ? `${Number(v).toFixed(2)}%` : '-',
    },
    { title: 'Plies', dataIndex: 'pliesRequired', key: 'pliesRequired', width: 80, align: 'right' },
    { title: 'Table No', dataIndex: 'tableNo', key: 'tableNo', width: 100, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getMarkerStatusColor(s)}>{getMarkerStatusLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/cutting/marker/edit/${record.id}`)} />
          {canUpdate && record.status === MARKER_STATUS.DRAFT && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/marker/edit/${record.id}`)} />
          )}
          {record.status === MARKER_STATUS.DRAFT && (
            <ActionButton action="submit" onClick={() => handleApprove(record)} tooltip="Approve" />
          )}
          {canDelete && record.status === MARKER_STATUS.DRAFT && (
            <DeleteConfirm onConfirm={() => handleDelete(record)} loading={deletingId === record.id} />
          )}
        </span>
      ),
    },
  ], [canUpdate, canDelete, deletingId, navigate, handleDelete, handleApprove]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: MARKER_STATUS_OPTIONS,
      width: 150,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Marker Planning"
        onAdd={canAdd ? () => navigate('/cutting/marker/new') : undefined}
        addLabel="New Marker"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search marker no, style, table..."
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
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description="No markers found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default MarkerList;
