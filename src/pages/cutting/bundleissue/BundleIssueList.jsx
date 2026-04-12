import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchBundleIssues } from '../../../services/cutting/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import { getBundleIssueLabel, getBundleIssueColor } from '../../../utils/cuttingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partial' },
  { value: 'RECEIVED', label: 'Received' },
];

const BundleIssueList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('bundle-issue', 'add');

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
      const response = await searchBundleIssues(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load bundle issues');
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
      title: 'Issue No',
      dataIndex: 'issueNo',
      key: 'issueNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Order', dataIndex: 'orderNo', key: 'orderNo', width: 140, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Issued To Line', dataIndex: 'issuedToLine', key: 'issuedToLine', width: 130 },
    { title: 'Total Bundles', dataIndex: 'totalBundles', key: 'totalBundles', width: 110, align: 'right' },
    { title: 'Total Pieces', dataIndex: 'totalPieces', key: 'totalPieces', width: 110, align: 'right' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getBundleIssueColor(s)}>{getBundleIssueLabel(s)}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'issueDate',
      key: 'issueDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <ActionButton action="view" onClick={() => navigate(`/cutting/bundle-issue/new?view=${record.id}`)} tooltip="View" />
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
        title="Bundle Issues"
        onAdd={canAdd ? () => navigate('/cutting/bundle-issue/new') : undefined}
        addLabel="New Issue"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search issue no, style, order, line..."
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: <EmptyState description="No bundle issues found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default BundleIssueList;
