import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchBundlingRecords } from '../../../services/cutting/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import { BUNDLE_STATUS, getBundleStatusLabel, getBundleStatusColor } from '../../../utils/cuttingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'BUNDLED', label: 'Bundled' },
];

const BundlingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('cut-bundling', 'add');

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
      const response = await searchBundlingRecords(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load bundling records');
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
    {
      title: 'Style',
      dataIndex: 'styleNo',
      key: 'styleNo',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Order',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      width: 100,
    },
    {
      title: 'Bundle Size',
      dataIndex: 'bundleSize',
      key: 'bundleSize',
      width: 110,
      align: 'right',
      render: (val) => `${val} pcs`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => {
        const label = s === 'DRAFT' ? 'Draft' : s === 'BUNDLED' ? 'Bundled' : s;
        const color = s === 'DRAFT' ? 'default' : s === 'BUNDLED' ? 'success' : 'default';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/cutting/bundling/edit/${record.id}`)} tooltip="View / Manage" />
        </span>
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
        title="Bundling"
        onAdd={canAdd ? () => navigate('/cutting/bundling/new') : undefined}
        addLabel="New Bundling"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search style, order, color..."
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
          scroll={{ x: 800 }}
          locale={{ emptyText: <EmptyState description="No bundling records found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default BundlingList;
