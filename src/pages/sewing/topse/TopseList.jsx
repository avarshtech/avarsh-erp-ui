import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchEndlineTopse } from '../../../services/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { DHU_THRESHOLD } from '../../../utils/sewingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate, formatPercentage } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const TopseList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('endline-topse', 'add');

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
      const response = await searchEndlineTopse(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load TOPSE records');
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
      title: 'Check No',
      dataIndex: 'checkNo',
      key: 'checkNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Line', dataIndex: 'lineCode', key: 'lineCode', width: 100 },
    {
      title: 'Date',
      dataIndex: 'inspectionDate',
      key: 'inspectionDate',
      width: 120,
      sorter: true,
      render: (d) => formatDate(d),
    },
    { title: 'Inspected', dataIndex: 'totalInspected', key: 'totalInspected', width: 100, align: 'right' },
    { title: 'Defects', dataIndex: 'totalDefects', key: 'totalDefects', width: 90, align: 'right' },
    {
      title: 'DHU %',
      dataIndex: 'dhuPct',
      key: 'dhuPct',
      width: 90,
      align: 'right',
      render: (val) => (
        <span style={{ color: val > DHU_THRESHOLD ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
          {formatPercentage(val)}
        </span>
      ),
    },
    {
      title: 'Pass Rate %',
      dataIndex: 'passRatePct',
      key: 'passRatePct',
      width: 110,
      align: 'right',
      render: (val) => formatPercentage(val),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/sewing/topse/view/${record.id}`)} />
        </span>
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="End-line TOPSE"
        onAdd={canAdd ? () => navigate('/sewing/topse/new') : undefined}
        addLabel="New Check"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search check no, style, line..."
          onReset={() => { setSearchText(''); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description="No TOPSE records found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default TopseList;
