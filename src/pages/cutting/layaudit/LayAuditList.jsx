import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchLayAudits, deleteLayAudit } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  LAY_AUDIT_STATUS, getLayAuditLabel, getLayAuditColor,
} from '../../../utils/cuttingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const LAY_AUDIT_EDITABLE = [LAY_AUDIT_STATUS.DRAFT];
const LAY_AUDIT_DELETABLE = [LAY_AUDIT_STATUS.DRAFT];

const LAY_AUDIT_STATUS_OPTIONS = [
  { value: LAY_AUDIT_STATUS.DRAFT, label: 'Draft' },
  { value: LAY_AUDIT_STATUS.AUDITED, label: 'Audited' },
  { value: LAY_AUDIT_STATUS.APPROVED, label: 'Approved' },
];

const LayAuditList = () => {
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

  const canAdd = hasPermission('lay-audit', 'add');
  const canUpdate = hasPermission('lay-audit', 'update');
  const canDelete = hasPermission('lay-audit', 'delete');

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
      const response = await searchLayAudits(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load lay audits');
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
      await deleteLayAudit(record.id);
      message.success(`${record.auditNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [pagination.current, pagination.pageSize, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Audit No',
      dataIndex: 'auditNo',
      key: 'auditNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Plan', dataIndex: 'planNo', key: 'planNo', width: 140, ellipsis: true },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Lay No', dataIndex: 'layNo', key: 'layNo', width: 80, align: 'right' },
    {
      title: 'Lay Date',
      dataIndex: 'layDate',
      key: 'layDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    { title: 'Plies', dataIndex: 'pliesRequired', key: 'pliesRequired', width: 80, align: 'right' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getLayAuditColor(s)}>{getLayAuditLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          {canUpdate && LAY_AUDIT_EDITABLE.includes(record.status) && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/lay-audit/edit/${record.id}`)} />
          )}
          {canDelete && LAY_AUDIT_DELETABLE.includes(record.status) && (
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
      options: LAY_AUDIT_STATUS_OPTIONS,
      width: 150,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Lay Audits"
        onAdd={canAdd ? () => navigate('/cutting/lay-audit/new') : undefined}
        addLabel="New Lay Audit"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search audit no, style, color..."
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
          locale={{ emptyText: <EmptyState description="No lay audits found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default LayAuditList;
