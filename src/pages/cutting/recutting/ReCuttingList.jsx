import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchReCutEntries } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
];

const ReCuttingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('recutting', 'add');

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
      const response = await searchReCutEntries(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load re-cutting registers');
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

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: true },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Order', dataIndex: 'orderNo', key: 'orderNo', width: 140, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={s === 'ACTIVE' ? 'processing' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <ActionButton action="view" onClick={() => navigate(`/cutting/recutting/new?view=${record.id}`)} tooltip="View / Add Entries" />
      ),
    },
  ], [navigate]);

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
        title="Re-Cutting Register"
        onAdd={canAdd ? () => navigate('/cutting/recutting/new') : undefined}
        addLabel="New Register"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search style, order..."
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
          scroll={{ x: 600 }}
          locale={{ emptyText: <EmptyState description="No re-cutting registers found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default ReCuttingList;
