import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchWastageRecords } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RECONCILED', label: 'Reconciled' },
];

const WastageList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('wastage-reconciliation', 'add');
  const canUpdate = hasPermission('wastage-reconciliation', 'update');

  const fetchData = useCallback(async (page, pageSize, sort, direction) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1,
        size: pageSize || pagination.pageSize,
        sort: sort || sortField,
        direction: direction || sortDirection,
      };
      if (statusFilter) params.status = statusFilter;
      const response = await searchWastageRecords(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load wastage records');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, statusFilter]);

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

  const columns = useMemo(() => [
    { title: 'Plan ID', dataIndex: 'planId', key: 'planId', width: 90, sorter: true },
    { title: 'Received (kg)', dataIndex: 'fabricReceivedKg', key: 'fabricReceivedKg', width: 120, align: 'right' },
    { title: 'Used (kg)', dataIndex: 'fabricUsedKg', key: 'fabricUsedKg', width: 100, align: 'right' },
    { title: 'End Bits (kg)', dataIndex: 'endBitsKg', key: 'endBitsKg', width: 110, align: 'right' },
    { title: 'Waste (kg)', dataIndex: 'wasteKg', key: 'wasteKg', width: 100, align: 'right' },
    {
      title: 'Utilization %',
      dataIndex: 'utilizationPct',
      key: 'utilizationPct',
      width: 110,
      align: 'right',
      render: (v) => v != null ? `${v}%` : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => <Tag color={s === 'RECONCILED' ? 'success' : 'default'}>{s === 'RECONCILED' ? 'Reconciled' : 'Draft'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/cutting/wastage/edit/${record.id}`)} />
          {canUpdate && record.status === 'DRAFT' && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/wastage/edit/${record.id}`)} />
          )}
        </span>
      ),
    },
  ], [canUpdate, navigate]);

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
        title="Wastage Reconciliation"
        onAdd={canAdd ? () => navigate('/cutting/wastage/new') : undefined}
        addLabel="New Wastage Record"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search..."
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
          locale={{ emptyText: <EmptyState description="No wastage records found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default WastageList;
