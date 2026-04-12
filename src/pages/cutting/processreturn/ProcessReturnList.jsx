import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchProcessReturns } from '../../../services/cutting/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const ProcessReturnList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('process-return', 'add');

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
      const response = await searchProcessReturns(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load process returns');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag, _f, sorter) => {
    const s = sorter.field || sortField;
    const d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s);
    setSortDirection(d);
    fetchData(pag.current, pag.pageSize, s, d);
  };

  const columns = useMemo(() => [
    {
      title: 'Return No',
      dataIndex: 'returnNo',
      key: 'returnNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Order', dataIndex: 'orderNo', key: 'orderNo', width: 140, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Total Returned', dataIndex: 'totalReturned', key: 'totalReturned', width: 120, align: 'right' },
    {
      title: 'Date',
      dataIndex: 'returnDate',
      key: 'returnDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={s === 'RETURNED' ? 'success' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <ActionButton action="view" onClick={() => navigate(`/cutting/process-return/new?view=${record.id}`)} tooltip="View" />
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="Process Returns"
        onAdd={canAdd ? () => navigate('/cutting/process-return/new') : undefined}
        addLabel="New Return"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search return no, style, order..."
          filters={[]}
          onReset={() => setSearchText('')}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description="No process returns found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default ProcessReturnList;
